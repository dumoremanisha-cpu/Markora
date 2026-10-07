// F31/ADR-0005 §4 task 2 — the AST-to-OOXML mapper. Walks the same
// markdown-it token stream `renderMarkdown` renders from (never the DOM,
// never the rendered HTML string), emitting `docx` package API calls
// directly. Never evaluates or executes document content — it only reads
// token fields and constructs `docx` objects (security-privacy.md §1/§2).
//
// Two nesting mechanisms recur throughout: block tokens (`heading_open` ...
// `heading_close`) and inline tokens (`strong_open` ... `strong_close`) both
// carry a `.level` set by markdown-it's own tokenizer, so a matching close
// is always "the next token at the same level with `nesting === -1`" —
// {@link findMatchingClose} is the one place that scan lives.
import type { Token } from 'markdown-it';
import {
  AlignmentType,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  EndnoteReferenceRun,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  HighlightColor,
  LevelFormat,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import type {
  FileChild,
  ICommentOptions,
  ILevelsOptions,
  INumberingOptions,
  IParagraphOptions,
  ParagraphChild,
} from 'docx';
import type { Annotation } from '../../storage/schema';
import { fetchImageForDocx } from './images';
import { BLOCKED_SRC_ATTR } from '../../viewer/markdown/plugins/blockRemoteImages';
import { buildMathContent } from './math';
import type { MathRasterizer } from './math';
import { resolveAnnotationsForDocx, splitRunForAnnotations } from './annotations';
import type { DocxAnnotation } from './annotations';
import { buildTokenPlainText } from './tokenPlainText';
import type { TokenTextOptions } from './tokenPlainText';
import { parseHighlightedHtml } from './syntaxHighlightRuns';
import { highlightCode, languageLabel } from '../../viewer/syntax/highlight';
import { t } from '../../i18n';

const INDENT_STEP_TWIP = convertInchesToTwip(0.3);
const CODE_FONT = 'Consolas';
const HYPERLINK_COLOR = '0563C1';

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string;
  color?: string;
  underline?: { type: (typeof UnderlineType)[keyof typeof UnderlineType] };
}

type ListMarker =
  | { kind: 'bullet'; level: number }
  | { kind: 'ordered'; level: number; reference: string }
  | { kind: 'task'; level: number; checked: boolean };

/**
 * Matching-close scan shared by block and inline walking (see module
 * comment) — a running sum of `.nesting` (always a reliable +1/0/-1 per
 * token) back to zero, rather than comparing `.level`: `markdown-it-
 * footnote`'s `footnote_tail` core rule hand-builds its `footnote_open`/
 * `footnote_close` tokens without ever setting `.level` on them (it only
 * needs `.nesting` for its own renderer), so a `.level`-comparison scan
 * silently mismatches on exactly the footnote-body block this mapper needs
 * to isolate correctly.
 */
function findMatchingClose(tokens: Token[], openIndex: number): number {
  let depth = 0;
  for (let j = openIndex; j < tokens.length; j++) {
    depth += tokens[j]!.nesting;
    if (depth === 0) return j;
  }
  return tokens.length - 1;
}

/** Mirrors markdown-it's own `renderInlineAsText` (used internally by its default `image` rule to fill in `alt`) — reading raw tokens means that rule never runs, so `image` tokens never get their `alt` attribute populated; this recomputes the same string directly from `token.children`. */
function plainTextOf(tokens: Token[]): string {
  let out = '';
  for (const tok of tokens) {
    if (tok.type === 'text' || tok.type === 'code_inline') out += tok.content;
    else if (tok.type === 'image') out += plainTextOf(tok.children ?? []);
    else if (tok.type === 'html_inline' || tok.type === 'html_block') out += tok.content;
    else if (tok.type === 'softbreak' || tok.type === 'hardbreak') out += '\n';
  }
  return out;
}

function isAllowedLinkScheme(href: string): boolean {
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href);
}

/** Splits text on embedded newlines into alternating text/line-break runs — OOXML has no "newline inside a run" primitive; `<w:br/>` (a fresh `TextRun({ break: 1 })`) is the only way to force a line break within one paragraph. */
function splitOnNewlines(text: string, style: InlineStyle): ParagraphChild[] {
  const lines = text.split('\n');
  const out: ParagraphChild[] = [];
  lines.forEach((line, index) => {
    if (line.length > 0) out.push(new TextRun({ text: line, ...style }));
    if (index < lines.length - 1) out.push(new TextRun({ text: '', break: 1 }));
  });
  return out;
}

class MapperState {
  cursor = 0;
  readonly resolved: DocxAnnotation[];
  readonly includeAnnotations: boolean;
  readonly textOptions: TokenTextOptions;
  readonly rasterizeMath: MathRasterizer;

  private readonly commentDocxId = new Map<string, number>();
  private readonly commentSeenStart = new Set<string>();
  private readonly commentSeenEnd = new Set<string>();
  private nextCommentId = 1;

  private readonly footnoteDocxId = new Map<number, number>();
  private nextFootnoteId = 1;
  readonly footnotes: Record<string, { children: Paragraph[] }> = {};

  private nextEndnoteId = 1;
  readonly endnotes: Record<string, { children: Paragraph[] }> = {};

  readonly numberingConfig: { reference: string; levels: ILevelsOptions[] }[] = [];
  private nextOrderedListId = 1;

  constructor(
    annotations: Annotation[],
    includeAnnotations: boolean,
    tokenPlainText: string,
    textOptions: TokenTextOptions,
    rasterizeMath: MathRasterizer,
  ) {
    this.includeAnnotations = includeAnnotations;
    this.textOptions = textOptions;
    this.rasterizeMath = rasterizeMath;
    this.resolved = includeAnnotations
      ? resolveAnnotationsForDocx(annotations, tokenPlainText)
      : [];
  }

  commentIdFor(annotationId: string): number {
    let id = this.commentDocxId.get(annotationId);
    if (id === undefined) {
      id = this.nextCommentId++;
      this.commentDocxId.set(annotationId, id);
    }
    return id;
  }

  markCommentStartSeen(annotationId: string): void {
    this.commentSeenStart.add(annotationId);
  }

  markCommentEndSeen(annotationId: string): void {
    this.commentSeenEnd.add(annotationId);
  }

  footnoteIdFor(mdId: number): number {
    let id = this.footnoteDocxId.get(mdId);
    if (id === undefined) {
      id = this.nextFootnoteId++;
      this.footnoteDocxId.set(mdId, id);
    }
    return id;
  }

  newOrderedListReference(): string {
    return `markora-ordered-${this.nextOrderedListId++}`;
  }

  allocateEndnoteId(): number {
    return this.nextEndnoteId++;
  }

  /** Comments that got *both* a start and end boundary placed inline — the only ones safe to hand to `docx`'s native comment part (an unreferenced comment definition is invalid OOXML). */
  placedCommentIds(): Set<string> {
    const placed = new Set<string>();
    for (const id of this.commentSeenStart) if (this.commentSeenEnd.has(id)) placed.add(id);
    return placed;
  }
}

function orderedListLevels(): ILevelsOptions[] {
  const levels: ILevelsOptions[] = [];
  for (let level = 0; level <= 8; level++) {
    levels.push({
      level,
      format: LevelFormat.DECIMAL,
      text: '%1.',
      alignment: AlignmentType.START,
      style: {
        paragraph: {
          indent: {
            left: convertInchesToTwip(0.25 * (level + 1)),
            hanging: convertInchesToTwip(0.25),
          },
        },
      },
    });
  }
  return levels;
}

function emitTextSegments(state: MapperState, text: string, style: InlineStyle): ParagraphChild[] {
  if (text.length === 0) return [];
  const runStart = state.cursor;
  const runEnd = runStart + text.length;
  state.cursor = runEnd;

  if (state.resolved.length === 0) return splitOnNewlines(text, style);

  const segments = splitRunForAnnotations(runStart, runEnd, state.resolved);
  const out: ParagraphChild[] = [];
  for (const segment of segments) {
    for (const comment of segment.commentsStartingHere) {
      out.push(new CommentRangeStart(state.commentIdFor(comment.annotation.id)));
      state.markCommentStartSeen(comment.annotation.id);
    }
    const segmentText = text.slice(segment.start, segment.end);
    const segmentStyle: InlineStyle & {
      highlight?: (typeof HighlightColor)[keyof typeof HighlightColor];
      underline?: { type: (typeof UnderlineType)[keyof typeof UnderlineType] };
    } = { ...style };
    if (segment.highlight) segmentStyle.highlight = HighlightColor.YELLOW;
    if (segment.underline) segmentStyle.underline = { type: UnderlineType.SINGLE };
    out.push(...splitOnNewlines(segmentText, segmentStyle));
    for (const comment of segment.commentsEndingHere) {
      const id = state.commentIdFor(comment.annotation.id);
      out.push(new CommentRangeEnd(id));
      out.push(new TextRun({ children: [new CommentReference(id)] }));
      state.markCommentEndSeen(comment.annotation.id);
    }
  }
  return out;
}

async function mapInlineChildren(
  children: Token[],
  state: MapperState,
  style: InlineStyle,
): Promise<ParagraphChild[]> {
  const out: ParagraphChild[] = [];
  let i = 0;
  while (i < children.length) {
    const token = children[i]!;
    switch (token.type) {
      case 'text':
        out.push(...emitTextSegments(state, token.content, style));
        i++;
        break;
      case 'code_inline':
        out.push(...emitTextSegments(state, token.content, { ...style, font: CODE_FONT }));
        i++;
        break;
      case 'softbreak':
        if (!state.textOptions.lineBreaks) state.cursor += 1;
        out.push(new TextRun({ text: '', break: 1 }));
        i++;
        break;
      case 'hardbreak':
        out.push(new TextRun({ text: '', break: 1 }));
        i++;
        break;
      case 'strong_open': {
        const close = findMatchingClose(children, i);
        out.push(
          ...(await mapInlineChildren(children.slice(i + 1, close), state, {
            ...style,
            bold: true,
          })),
        );
        i = close + 1;
        break;
      }
      case 'em_open': {
        const close = findMatchingClose(children, i);
        out.push(
          ...(await mapInlineChildren(children.slice(i + 1, close), state, {
            ...style,
            italics: true,
          })),
        );
        i = close + 1;
        break;
      }
      case 's_open': {
        const close = findMatchingClose(children, i);
        out.push(
          ...(await mapInlineChildren(children.slice(i + 1, close), state, {
            ...style,
            strike: true,
          })),
        );
        i = close + 1;
        break;
      }
      case 'link_open': {
        const close = findMatchingClose(children, i);
        const href = String(token.attrGet('href') ?? '');
        const allowed = isAllowedLinkScheme(href);
        const inner = await mapInlineChildren(children.slice(i + 1, close), state, {
          ...style,
          ...(allowed ? { color: HYPERLINK_COLOR, underline: { type: UnderlineType.SINGLE } } : {}),
        });
        if (allowed) {
          out.push(new ExternalHyperlink({ link: href, children: inner }));
        } else {
          out.push(...inner);
        }
        i = close + 1;
        break;
      }
      case 'image': {
        const alt = plainTextOf(token.children ?? []);
        // security-privacy.md §1 point 4: "Block remote images" — the
        // token never carries the real URL in `src` when blocked
        // (../../viewer/markdown/plugins/blockRemoteImages.ts's core
        // rule), only in this attribute; fall back to a hyperlink
        // instead of fetching, same as HTML export's own fallback.
        const blockedSrc = String(token.attrGet(BLOCKED_SRC_ATTR) ?? '');
        if (blockedSrc) {
          out.push(
            new ExternalHyperlink({
              link: blockedSrc,
              children: [
                new TextRun({
                  text: alt || blockedSrc,
                  color: HYPERLINK_COLOR,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
            }),
          );
          i++;
          break;
        }
        const src = String(token.attrGet('src') ?? '');
        const image = src ? await fetchImageForDocx(src) : null;
        if (image) {
          out.push(image.imageRun);
        } else if (alt) {
          out.push(new TextRun({ text: `[${alt}]`, italics: true }));
        }
        i++;
        break;
      }
      case 'footnote_ref': {
        const mdId = typeof token.meta?.id === 'number' ? token.meta.id : -1;
        if (mdId >= 0) out.push(new FootnoteReferenceRun(state.footnoteIdFor(mdId)));
        i++;
        break;
      }
      case 'math_inline': {
        const result = await buildMathContent(token.content, false, state.rasterizeMath);
        out.push(...result.children);
        // Math content never routes through emitTextSegments (it isn't
        // plain text), but tokenPlainText.ts's pass-1 accounting *does*
        // count a math_inline token's raw LaTeX length — the cursor must
        // advance by the same amount here or every annotation offset after
        // this point in the document would drift out of alignment.
        state.cursor += token.content.length;
        i++;
        break;
      }
      default:
        // html_inline (including task-list checkbox markup, stripped by the
        // list-item mapper before this is called) and anything else this
        // switch doesn't recognize: never executed, never preservable in
        // OOXML as-is, so dropped rather than leaking raw markup as text.
        i++;
        break;
    }
  }
  return out;
}

function headingLevelFor(
  tag: string,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  switch (tag) {
    case 'h1':
      return HeadingLevel.HEADING_1;
    case 'h2':
      return HeadingLevel.HEADING_2;
    case 'h3':
      return HeadingLevel.HEADING_3;
    case 'h4':
      return HeadingLevel.HEADING_4;
    case 'h5':
      return HeadingLevel.HEADING_5;
    case 'h6':
      return HeadingLevel.HEADING_6;
    default:
      return undefined;
  }
}

function alignmentFromAttrs(
  token: Token,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const style = String(token.attrGet('style') ?? '');
  const match = /text-align:(left|center|right)/.exec(style);
  if (!match) return undefined;
  const value = match[1];
  if (value === 'center') return AlignmentType.CENTER;
  if (value === 'right') return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function listMarkerProperties(marker: ListMarker): Partial<IParagraphOptions> {
  const level = Math.min(marker.level, 8);
  if (marker.kind === 'bullet' || marker.kind === 'task') return { bullet: { level } };
  return { numbering: { reference: marker.reference, level } };
}

/**
 * Detects `markdown-it-task-lists`' injected checkbox marker at the front of
 * a task-list item's inline children. The plugin is registered with
 * `{ label: true }` (`../markdown/index.ts`), which wraps the checkbox in a
 * `<label>`/`</label>` pair — `unshift`ing *both* the checkbox and the label
 * open tag in front of the original content — so the checkbox itself can be
 * at index 0 (no label) or index 1 (label-wrapped); `skip` tells the caller
 * how many leading tokens to drop before mapping the rest of the item's text.
 */
function checkboxPrefixToken(children: Token[]): { checked: boolean; skip: number } | null {
  for (const skip of [1, 2]) {
    const candidate = children[skip - 1];
    if (candidate?.type === 'html_inline' && /type="checkbox"/.test(candidate.content)) {
      return { checked: /checked=""/.test(candidate.content), skip };
    }
  }
  return null;
}

async function buildParagraphFromInline(
  tokens: Token[],
  inlineIndex: number,
  state: MapperState,
  extraProps: Partial<IParagraphOptions> = {},
  taskCheckbox?: { checked: boolean; skip: number },
  baseStyle: InlineStyle = {},
): Promise<Paragraph> {
  const inlineToken = tokens[inlineIndex];
  let children = inlineToken?.type === 'inline' ? (inlineToken.children ?? []) : [];
  const paragraphChildren: ParagraphChild[] = [];
  if (taskCheckbox) {
    paragraphChildren.push(new TextRun({ text: taskCheckbox.checked ? '☑ ' : '☐ ', ...baseStyle }));
    children = children.slice(taskCheckbox.skip);
  }
  paragraphChildren.push(...(await mapInlineChildren(children, state, baseStyle)));
  return new Paragraph({ children: paragraphChildren, ...extraProps });
}

interface BlockContext {
  blockquoteDepth: number;
  listLevel: number;
}

/** Maps one list item's own content (`list_item_open` .. `list_item_close`): the marker (bullet/number/checkbox) is attached only to the item's first paragraph, per common Markdown->Word convention — a second paragraph or a nested list inside the same item is indented but doesn't repeat the marker. */
async function mapListItem(
  tokens: Token[],
  openIndex: number,
  closeIndex: number,
  state: MapperState,
  ctx: BlockContext,
  marker: ListMarker,
): Promise<FileChild[]> {
  const out: FileChild[] = [];
  let i = openIndex + 1;
  let first = true;
  while (i < closeIndex) {
    const token = tokens[i]!;
    if (token.type === 'paragraph_open') {
      const close = findMatchingClose(tokens, i);
      const taskCheckbox =
        first && marker.kind === 'task'
          ? checkboxPrefixToken(
              (tokens[i + 1]?.type === 'inline' ? tokens[i + 1]!.children : []) ?? [],
            )
          : undefined;
      const extraProps = first
        ? listMarkerProperties(marker)
        : { indent: { left: convertInchesToTwip(0.25 * (marker.level + 1)) } };
      out.push(
        await buildParagraphFromInline(tokens, i + 1, state, extraProps, taskCheckbox ?? undefined),
      );
      first = false;
      i = close + 1;
      continue;
    }
    i = await mapOneBlock(tokens, i, out, state, { ...ctx, listLevel: marker.level + 1 });
    first = false;
  }
  return out;
}

async function mapList(
  tokens: Token[],
  openIndex: number,
  closeIndex: number,
  state: MapperState,
  ctx: BlockContext,
  ordered: boolean,
): Promise<FileChild[]> {
  const out: FileChild[] = [];
  const reference = ordered ? state.newOrderedListReference() : undefined;
  if (reference) state.numberingConfig.push({ reference, levels: orderedListLevels() });

  let i = openIndex + 1;
  while (i < closeIndex) {
    const item = tokens[i]!;
    if (item.type !== 'list_item_open') {
      i++;
      continue;
    }
    const itemClose = findMatchingClose(tokens, i);
    const itemClass = String(item.attrGet('class') ?? '');
    let marker: ListMarker;
    if (itemClass.includes('task-list-item')) {
      const inlineToken = tokens[i + 1];
      const paragraphInline = inlineToken?.type === 'paragraph_open' ? tokens[i + 2] : undefined;
      const checkbox = checkboxPrefixToken(
        (paragraphInline?.type === 'inline' ? paragraphInline.children : []) ?? [],
      );
      marker = { kind: 'task', level: ctx.listLevel, checked: checkbox?.checked ?? false };
    } else if (ordered) {
      marker = { kind: 'ordered', level: ctx.listLevel, reference: reference! };
    } else {
      marker = { kind: 'bullet', level: ctx.listLevel };
    }
    out.push(...(await mapListItem(tokens, i, itemClose, state, ctx, marker)));
    i = itemClose + 1;
  }
  return out;
}

async function mapTable(
  tokens: Token[],
  openIndex: number,
  closeIndex: number,
  state: MapperState,
): Promise<Table> {
  const rows: TableRow[] = [];
  let i = openIndex + 1;
  let inHeader = false;
  while (i < closeIndex) {
    const token = tokens[i]!;
    if (token.type === 'thead_open') {
      inHeader = true;
      i++;
      continue;
    }
    if (token.type === 'thead_close') {
      inHeader = false;
      i++;
      continue;
    }
    if (token.type === 'tr_open') {
      const rowClose = findMatchingClose(tokens, i);
      const cells: TableCell[] = [];
      let j = i + 1;
      while (j < rowClose) {
        const cellToken = tokens[j]!;
        if (cellToken.type === 'th_open' || cellToken.type === 'td_open') {
          const cellClose = findMatchingClose(tokens, j);
          const alignment = alignmentFromAttrs(cellToken);
          const paragraph = await buildParagraphFromInline(
            tokens,
            j + 1,
            state,
            { ...(alignment ? { alignment } : {}) },
            undefined,
            inHeader ? { bold: true } : {},
          );
          cells.push(
            new TableCell({
              children: [paragraph],
              width: {
                size: 100 / Math.max(1, countCells(tokens, i + 1, rowClose)),
                type: WidthType.PERCENTAGE,
              },
            }),
          );
          j = cellClose + 1;
          continue;
        }
        j++;
      }
      rows.push(new TableRow({ children: cells, tableHeader: inHeader }));
      i = rowClose + 1;
      continue;
    }
    i++;
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function countCells(tokens: Token[], start: number, end: number): number {
  let count = 0;
  for (let i = start; i < end; i++) {
    if (tokens[i]!.type === 'th_open' || tokens[i]!.type === 'td_open') count++;
  }
  return count;
}

function buildCodeParagraph(code: string, lang: string): Paragraph {
  const { html, languageKey } = highlightCode(code, lang || undefined);
  const highlighted = parseHighlightedHtml(html);
  const children: ParagraphChild[] = [];
  const label = languageKey ? languageLabel(languageKey) : '';
  if (label) {
    children.push(new TextRun({ text: `[${label}]`, italics: true, color: '6A737D' }));
    children.push(new TextRun({ text: '', break: 1 }));
  }
  for (const run of highlighted) {
    children.push(...splitOnNewlines(run.text, { font: CODE_FONT, ...run.style }));
  }
  return new Paragraph({ children, shading: { fill: 'F6F8FA' } });
}

/** Maps one block-level token starting at `index`, appending whatever `FileChild`s it produces to `out`, and returns the index to resume scanning from. */
export async function mapOneBlock(
  tokens: Token[],
  index: number,
  out: FileChild[],
  state: MapperState,
  ctx: BlockContext,
): Promise<number> {
  const token = tokens[index]!;

  switch (token.type) {
    case 'heading_open': {
      const close = findMatchingClose(tokens, index);
      out.push(
        await buildParagraphFromInline(tokens, index + 1, state, {
          heading: headingLevelFor(token.tag),
        }),
      );
      return close + 1;
    }
    case 'paragraph_open': {
      const close = findMatchingClose(tokens, index);
      const extraProps =
        ctx.blockquoteDepth > 0 ? { indent: { left: INDENT_STEP_TWIP * ctx.blockquoteDepth } } : {};
      out.push(await buildParagraphFromInline(tokens, index + 1, state, extraProps));
      return close + 1;
    }
    case 'bullet_list_open': {
      const close = findMatchingClose(tokens, index);
      out.push(...(await mapList(tokens, index, close, state, ctx, false)));
      return close + 1;
    }
    case 'ordered_list_open': {
      const close = findMatchingClose(tokens, index);
      out.push(...(await mapList(tokens, index, close, state, ctx, true)));
      return close + 1;
    }
    case 'blockquote_open': {
      const close = findMatchingClose(tokens, index);
      const inner = await mapBlockRange(tokens, index + 1, close, state, {
        ...ctx,
        blockquoteDepth: ctx.blockquoteDepth + 1,
      });
      out.push(...inner);
      return close + 1;
    }
    case 'table_open': {
      const close = findMatchingClose(tokens, index);
      out.push(await mapTable(tokens, index, close, state));
      return close + 1;
    }
    case 'fence': {
      const info = token.info.trim();
      const lang = info.split(/\s+/)[0] ?? '';
      const code = token.content.replace(/\n$/, '');
      out.push(buildCodeParagraph(code, lang));
      state.cursor += code.length;
      return index + 1;
    }
    case 'mermaid_container': {
      const code = token.content.replace(/\n$/, '');
      out.push(buildCodeParagraph(code, 'mermaid'));
      state.cursor += code.length;
      return index + 1;
    }
    case 'math_block': {
      const result = await buildMathContent(token.content, true, state.rasterizeMath);
      out.push(new Paragraph({ children: result.children, alignment: AlignmentType.CENTER }));
      state.cursor += token.content.length;
      return index + 1;
    }
    case 'hr':
      out.push(
        new Paragraph({
          border: { bottom: { style: 'single', size: 6, color: 'CCCCCC' } },
          children: [],
        }),
      );
      return index + 1;
    // Document footnotes (`[^1]`) are captured into `state.footnotes` here,
    // as real OOXML footnotes, rather than also being emitted into the
    // visible body — `footnote_ref` (handled in mapInlineChildren) already
    // placed the reference marker.
    case 'footnote_open': {
      const close = findMatchingClose(tokens, index);
      const mdId = typeof token.meta?.id === 'number' ? token.meta.id : -1;
      if (mdId >= 0) {
        const children = await mapBlockRange(tokens, index + 1, close, state, ctx);
        const paragraphs = children.filter((c): c is Paragraph => c instanceof Paragraph);
        state.footnotes[String(state.footnoteIdFor(mdId))] = { children: paragraphs };
      }
      return close + 1;
    }
    case 'footnote_block_open': {
      // Descends so the `footnote_open` case above actually runs for each
      // definition (its own side effect populates `state.footnotes`) — the
      // returned FileChild[] is discarded because footnote bodies belong in
      // the footnotes part, never the visible document body.
      const close = findMatchingClose(tokens, index);
      await mapBlockRange(tokens, index + 1, close, state, ctx);
      return close + 1;
    }
    default: {
      // Unrecognized open/close wrapper (custom containers, GitHub alerts —
      // both fall back to their plain nested content, per this phase's
      // preservation table not covering container/alert styling) or a
      // self-closing token this mapper has no special handling for: if it's
      // a `_open`, skip past its matching close but still walk (and
      // preserve) whatever block content lives inside it.
      if (token.nesting === 1) {
        const close = findMatchingClose(tokens, index);
        out.push(...(await mapBlockRange(tokens, index + 1, close, state, ctx)));
        return close + 1;
      }
      return index + 1;
    }
  }
}

async function mapBlockRange(
  tokens: Token[],
  start: number,
  end: number,
  state: MapperState,
  ctx: BlockContext,
): Promise<FileChild[]> {
  const out: FileChild[] = [];
  let i = start;
  while (i < end) {
    i = await mapOneBlock(tokens, i, out, state, ctx);
  }
  return out;
}

function buildEndnoteParagraphs(comment: DocxAnnotation): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: comment.annotation.commentText ?? '' })] }),
  ];
}

export interface DocxMapResult {
  children: FileChild[];
  footnotes: Record<string, { children: Paragraph[] }>;
  endnotes: Record<string, { children: Paragraph[] }>;
  comments: ICommentOptions[];
  numbering: INumberingOptions;
}

export interface DocxMapOptions {
  tokens: Token[];
  lineBreaks: boolean;
  annotations: Annotation[];
  includeAnnotations: boolean;
  rasterizeMath: MathRasterizer;
}

/**
 * Maps a full markdown-it token stream to DOCX content. This is the one
 * exported entry point other than the tier-1 math grammar and the plain-text
 * derivation, both independently unit-tested (`math.test.ts`,
 * `tokenPlainText.test.ts`) — this function is covered by fixture-document
 * tests in `astMapper.test.ts` that inspect the packed OOXML.
 */
export async function mapTokensToDocx(options: DocxMapOptions): Promise<DocxMapResult> {
  const textOptions: TokenTextOptions = { lineBreaks: options.lineBreaks };
  const tokenPlainText = buildTokenPlainText(options.tokens, textOptions);
  const state = new MapperState(
    options.annotations,
    options.includeAnnotations,
    tokenPlainText,
    textOptions,
    options.rasterizeMath,
  );

  const children = await mapBlockRange(options.tokens, 0, options.tokens.length, state, {
    blockquoteDepth: 0,
    listLevel: 0,
  });

  const placed = state.placedCommentIds();
  const comments: ICommentOptions[] = [];
  for (const resolved of state.resolved) {
    if (resolved.annotation.type !== 'comment') continue;
    if (!placed.has(resolved.annotation.id)) continue;
    comments.push({
      id: state.commentIdFor(resolved.annotation.id),
      author: t('export.docx.commentAuthor'),
      date: new Date(resolved.annotation.createdAt),
      children: [
        new Paragraph({ children: [new TextRun({ text: resolved.annotation.commentText ?? '' })] }),
      ],
    });
  }

  // Comments whose start and end couldn't both be placed inline (their
  // range never overlapped any run this mapper actually emitted) still owe
  // the "never silently dropped" guarantee — a real Word endnote instead,
  // referenced from a trailer paragraph appended to the document body (an
  // endnote with nothing pointing to it would be just as unreachable to a
  // reader as dropping it silently).
  const unplacedEndnoteIds: number[] = [];
  for (const resolved of state.resolved) {
    if (resolved.annotation.type !== 'comment') continue;
    if (placed.has(resolved.annotation.id)) continue;
    const endnoteId = state.allocateEndnoteId();
    state.endnotes[String(endnoteId)] = { children: buildEndnoteParagraphs(resolved) };
    unplacedEndnoteIds.push(endnoteId);
  }
  if (unplacedEndnoteIds.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: t('export.docx.unplacedComments'), bold: true })],
      }),
      ...unplacedEndnoteIds.map((id) => new Paragraph({ children: [new EndnoteReferenceRun(id)] })),
    );
  }

  return {
    children,
    footnotes: state.footnotes,
    endnotes: state.endnotes,
    comments,
    numbering: { config: state.numberingConfig },
  };
}
