// F31/ADR-0005 — derives a plain-text string from the markdown-it token
// stream, in the same coordinate space the DOCX mapper (astMapper.ts) emits
// runs in. Used only to resolve Phase 5 annotation ranges onto that token
// stream (ADR-0003's anchoring data — exactText/prefix/suffix — is a
// substring search, not an absolute-offset one, so this text only needs to
// be *locally* faithful around a match, not byte-identical to the live
// DOM's `textContent`; see astMapper.ts's comment on why that's sufficient).
// A single shared per-token-type length function (`textLengthOf`) keeps this
// pass and the mapper's real emission pass from ever disagreeing about how
// many characters a given token contributed.
import type { Token } from 'markdown-it';

export interface TokenTextOptions {
  /** Mirrors `MarkdownFeatureToggles.lineBreaks` — when true, `softbreak` renders as `<br>` (no text node); when false (default) it renders as a literal `"\n"` text node. */
  lineBreaks: boolean;
}

/** Characters a single inline leaf token contributes to plain text — the one place both passes over the token stream get their accounting from. */
export function textLengthOf(token: Token, options: TokenTextOptions): number {
  switch (token.type) {
    case 'text':
    case 'code_inline':
      return token.content.length;
    case 'softbreak':
      return options.lineBreaks ? 0 : 1;
    // hardbreak always renders as `<br>` — no text node, per markdown-it's default renderer rule.
    case 'hardbreak':
    default:
      return 0;
  }
}

function textOf(token: Token, options: TokenTextOptions): string {
  switch (token.type) {
    case 'text':
    case 'code_inline':
      return token.content;
    case 'softbreak':
      return options.lineBreaks ? '' : '\n';
    default:
      return '';
  }
}

function walkInline(children: Token[], options: TokenTextOptions, out: string[]): void {
  for (const child of children) {
    if (child.type === 'math_inline') {
      out.push(child.content);
      continue;
    }
    out.push(textOf(child, options));
  }
}

/** Walks the full block-level token stream, descending into every `inline` token's children, concatenating everything {@link textLengthOf} counts. */
export function buildTokenPlainText(tokens: Token[], options: TokenTextOptions): string {
  const out: string[] = [];
  for (const token of tokens) {
    if (token.type === 'inline' && token.children) {
      walkInline(token.children, options, out);
      continue;
    }
    if (token.type === 'math_block') {
      out.push(token.content);
    }
    // Mirrors the trailing-newline strip `../markdown/plugins/fence.ts`'s renderer rule applies — this module reads the same raw token, never that renderer.
    if (token.type === 'fence' || token.type === 'mermaid_container') {
      out.push(token.content.replace(/\n$/, ''));
    }
  }
  return out.join('');
}
