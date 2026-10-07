// RTL support (05-ux-i18n-accessibility.md §6, ADR-0007 §4): per-block
// `dir="auto"` lets the browser's own bidi algorithm pick each paragraph's
// direction from its own text, rather than forcing the whole document to
// one direction because a single paragraph happens to be Arabic/Hebrew/
// Persian/Urdu. Deliberately block-level, never applied to inline spans —
// "surgical," per the spec's own wording, not a custom per-character
// detector. Code blocks are excluded on purpose (fence/code_block tokens
// are never touched here) — code stays LTR even inside an RTL document;
// see the `.markora-content pre/code` rule in src/styles/index.css.
import type { MarkdownIt } from 'markdown-it';

const DIR_AUTO_TOKEN_TYPES = new Set([
  'paragraph_open',
  'heading_open',
  'blockquote_open',
  'list_item_open',
  'th_open',
  'td_open',
  'dt_open',
  'dd_open',
]);

export function registerRtlAuto(md: MarkdownIt): void {
  md.core.ruler.push('markora_rtl_auto', (state) => {
    for (const token of state.tokens) {
      if (DIR_AUTO_TOKEN_TYPES.has(token.type)) token.attrSet('dir', 'auto');
    }
  });
}
