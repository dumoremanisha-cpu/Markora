// F31/ADR-0005 — DOCX code blocks preserve syntax-highlighting-derived run
// formatting (§4 task 2), but a static export can't carry the app's live
// highlight.js theme choice (CSS custom properties, dark-mode variables).
// Deliberate, documented choice: DOCX code always uses one fixed, readable
// light palette (loosely GitHub's), independent of `Settings.highlightTheme`
// — the same reasoning HTML export's `getAppliedTheme()` snapshot doesn't
// apply here, since Word documents are commonly read outside any app theme.
export interface SyntaxRunStyle {
  color?: string;
  italic?: boolean;
  bold?: boolean;
}

/** Keyed by the highlight.js `hljs-*` class suffix (e.g. `"keyword"` for `hljs-keyword`). */
const SYNTAX_COLORS: Record<string, SyntaxRunStyle> = {
  comment: { color: '6A737D', italic: true },
  quote: { color: '6A737D', italic: true },
  keyword: { color: 'D73A49', bold: true },
  'selector-tag': { color: 'D73A49' },
  literal: { color: '005CC5' },
  number: { color: '005CC5' },
  boolean: { color: '005CC5' },
  string: { color: '032F62' },
  doctag: { color: '032F62' },
  regexp: { color: '032F62' },
  title: { color: '6F42C1', bold: true },
  'title.function_': { color: '6F42C1', bold: true },
  'title.class_': { color: '6F42C1', bold: true },
  section: { color: '005CC5', bold: true },
  name: { color: '22863A' },
  'selector-id': { color: '6F42C1' },
  'selector-class': { color: '6F42C1' },
  'selector-attr': { color: '6F42C1' },
  'selector-pseudo': { color: '6F42C1' },
  type: { color: '6F42C1' },
  class: { color: '6F42C1' },
  built_in: { color: '6F42C1' },
  'builtin-name': { color: '6F42C1' },
  attr: { color: 'E36209' },
  attribute: { color: 'E36209' },
  variable: { color: 'E36209' },
  'template-variable': { color: 'E36209' },
  params: { color: '24292E' },
  property: { color: '005CC5' },
  symbol: { color: 'E36209' },
  bullet: { color: 'E36209' },
  link: { color: '032F62' },
  meta: { color: '6A737D' },
  'meta-keyword': { color: 'D73A49' },
  'meta-string': { color: '032F62' },
  subst: { color: '24292E' },
  deletion: { color: 'B31D28' },
  addition: { color: '22863A' },
  emphasis: { italic: true },
  strong: { bold: true },
  formula: { color: '24292E', italic: true },
};

/** Resolves an `hljs-<name>` class to a run style, or `undefined` for plain (unstyled) text. */
export function syntaxRunStyle(hljsClassName: string): SyntaxRunStyle | undefined {
  const name = hljsClassName.replace(/^hljs-/, '');
  return SYNTAX_COLORS[name];
}
