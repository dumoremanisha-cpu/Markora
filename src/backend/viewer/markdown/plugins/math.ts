// F12: inline `$...$` and display `$$...$$` math. Parse time only detects
// the delimiters and emits an inert placeholder holding the raw LaTeX
// source as escaped text — actual KaTeX rendering needs a DOMPurify pass
// tuned for KaTeX's inline-style-heavy output (ADR-0002; see the comment in
// ../../sanitization/index.ts), which can only run after the placeholder is
// in the live DOM. src/viewer/math/ hydrates these post-insertion (task 7:
// deferred, doesn't block first paint of surrounding text).
import type { MarkdownIt, StateBlock, StateInline } from 'markdown-it';

const DOLLAR = 0x24;
const BACKSLASH = 0x5c;
const NEWLINE = 0x0a;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

/** `$...$`. No `$$`, no leading/trailing whitespace inside the delimiters, no raw newline, and `\$` never closes it (lets literal dollar signs appear via a LaTeX-style escape). */
function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src.charCodeAt(start) !== DOLLAR) return false;
  if (src.charCodeAt(start + 1) === DOLLAR) return false;

  const afterOpen = src.charCodeAt(start + 1);
  if (Number.isNaN(afterOpen) || afterOpen === 0x20 || afterOpen === 0x09) return false;

  let pos = start + 1;
  let found = false;
  while (pos < state.posMax) {
    const ch = src.charCodeAt(pos);
    if (ch === NEWLINE) break;
    if (ch === DOLLAR && src.charCodeAt(pos - 1) !== BACKSLASH) {
      found = true;
      break;
    }
    pos++;
  }
  if (!found) return false;

  const content = src.slice(start + 1, pos);
  if (content.trim().length === 0) return false;
  if (/\s$/.test(content)) return false;

  if (!silent) {
    const token = state.push('math_inline', 'span', 0);
    token.content = content;
    token.markup = '$';
  }
  state.pos = pos + 1;
  return true;
}

/**
 * `$$...$$`. Either a single line (`$$ x^2 $$`) or a fenced-style block
 * closed by a line that is exactly `$$`, mirroring markdown-it's own core
 * `fence` rule's line-scanning algorithm (the content between the
 * delimiters is literal, never re-parsed as Markdown).
 */
function mathBlockRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const pos0 = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max0 = state.eMarks[startLine]!;
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  if (pos0 + 2 > max0) return false;
  if (state.src.slice(pos0, pos0 + 2) !== '$$') return false;

  if (silent) return true;

  const restOfOpenLine = state.src.slice(pos0 + 2, max0).trimEnd();

  // Single-line form: content and closing "$$" both on the opening line.
  if (restOfOpenLine.endsWith('$$') && restOfOpenLine.length > 2) {
    const content = restOfOpenLine.slice(0, -2).trim();
    if (content.length > 0) {
      state.line = startLine + 1;
      const token = state.push('math_block', 'div', 0);
      token.content = content;
      token.map = [startLine, state.line];
      return true;
    }
  }

  // Anything else trailing the opening "$$" means this isn't a clean block
  // opener under this simple grammar — let other block rules try instead.
  if (restOfOpenLine.trim().length > 0) return false;

  let nextLine = startLine;
  let haveEndMarker = false;
  for (;;) {
    nextLine++;
    if (nextLine >= endLine) break;
    const pos = state.bMarks[nextLine]! + state.tShift[nextLine]!;
    const max = state.eMarks[nextLine]!;
    if (pos < max && state.sCount[nextLine]! < state.blkIndent) break;
    if (state.src.slice(pos, max).trim() === '$$') {
      haveEndMarker = true;
      break;
    }
  }

  const content = state.getLines(startLine + 1, nextLine, state.sCount[startLine]!, true).trim();
  if (content.length === 0) return false;

  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push('math_block', 'div', 0);
  token.content = content;
  token.map = [startLine, state.line];
  return true;
}

function buildMathPlaceholder(source: string, display: boolean): string {
  const tag = display ? 'div' : 'span';
  return `<${tag} class="markora-math" data-display="${display}">${escapeHtml(source)}</${tag}>`;
}

export function registerMath(md: MarkdownIt): void {
  md.inline.ruler.push('math_inline', mathInlineRule);
  md.block.ruler.before('fence', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.math_inline = (tokens, idx) =>
    buildMathPlaceholder(tokens[idx]!.content, false);
  md.renderer.rules.math_block = (tokens, idx) =>
    buildMathPlaceholder(tokens[idx]!.content, true) + '\n';
}
