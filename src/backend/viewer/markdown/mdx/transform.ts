// MDX pre-parse text transform rules (ADR-0008 §3), applied to text that has
// already had fenced code/inline code/math extracted by regions.ts. Pure
// string -> string; a regex/scanner over text is inherently approximate for
// nested syntax, which ADR-0008's Consequences section accepts explicitly —
// this is never the security boundary (DOMPurify is) and every path still
// passes through it after this transform runs.
import { t } from '../../../i18n';

const IMPORT_EXPORT_RE = /^[ \t]*(?:import|export)\b/;

/** Rule 2: import/export statements, brace/paren/bracket-balanced across lines, removed entirely. */
export function stripImportExportStatements(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!IMPORT_EXPORT_RE.test(line)) {
      out.push(line);
      i++;
      continue;
    }
    let depth = 0;
    let j = i;
    do {
      const current = lines[j] ?? '';
      for (const ch of current) {
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      }
      j++;
    } while (depth > 0 && j < lines.length);
    i = j;
  }
  return out.join('\n');
}

/** Rule 7: `{/* ... *\/}` MDX comments removed — leaving them would render visible brace noise. */
export function stripMdxComments(text: string): string {
  return text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

interface TagMatch {
  start: number;
  end: number;
  name: string;
  selfClosing: boolean;
  closing: boolean;
}

// Deliberately simple: attribute values are not scanned for `<`/`>`, per
// ADR-0008's accepted approximation. `[\s\S]*?` stays non-greedy so a
// malformed/unterminated tag degrades to leaving text alone rather than
// consuming the rest of the document.
const TAG_RE = /<(\/)?([A-Za-z][\w.-]*)(?:\s[^<>]*?)?(\/)?>/g;

function findTags(text: string): TagMatch[] {
  const tags: TagMatch[] = [];
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(text)) !== null) {
    const closing = match[1] === '/';
    const name = match[2] ?? '';
    const selfClosing = !closing && match[3] === '/';
    tags.push({
      start: match.index,
      end: match.index + match[0].length,
      name,
      selfClosing,
      closing,
    });
  }
  return tags;
}

function isCapitalized(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function unsupportedComponentChip(name: string): string {
  const label = t('markdown.mdx.unsupportedComponent', { name });
  return `<span class="markora-mdx-chip">${label}</span>`;
}

/**
 * Rules 3-6, 9: lowercase tags (safe-HTML or not) are left untouched — rule 3
 * hands them to markdown-it as HTML, rule 9 leaves the rest for DOMPurify to
 * strip, so both cases resolve to "do nothing" here. Capitalized (component)
 * tags are stripped: self-closing becomes a visible placeholder chip (rule
 * 5), paired tags are removed keeping their inner content (rule 4), and every
 * attribute on a stripped tag — including event handlers — is discarded
 * because only the tag markup itself is ever kept or cut (rule 6). An
 * unmatched/never-closed component tag is left as literal text rather than
 * guessed at (ADR-0008's "unbalanced/garbage JSX" case).
 */
export function stripJsxComponents(text: string): string {
  const tags = findTags(text);
  const stack: Array<{ name: string; start: number; end: number }> = [];
  const cuts: Array<{ start: number; end: number; replacement: string }> = [];

  for (const tag of tags) {
    if (!isCapitalized(tag.name)) continue;
    if (tag.selfClosing) {
      cuts.push({
        start: tag.start,
        end: tag.end,
        replacement: unsupportedComponentChip(tag.name),
      });
      continue;
    }
    if (!tag.closing) {
      stack.push({ name: tag.name, start: tag.start, end: tag.end });
      continue;
    }
    let matchIndex = -1;
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k]?.name === tag.name) {
        matchIndex = k;
        break;
      }
    }
    if (matchIndex === -1) continue;
    const opening = stack[matchIndex];
    if (!opening) continue;
    cuts.push({ start: opening.start, end: opening.end, replacement: '' });
    cuts.push({ start: tag.start, end: tag.end, replacement: '' });
    stack.length = matchIndex;
  }

  cuts.sort((a, b) => b.start - a.start);
  let out = text;
  for (const cut of cuts) {
    out = out.slice(0, cut.start) + cut.replacement + out.slice(cut.end);
  }
  return out;
}
