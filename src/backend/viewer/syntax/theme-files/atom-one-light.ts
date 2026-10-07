// URL export (Phase 16 fix, not a side-effect CSS import) for the 'atom-one-light'
// highlight.js theme (F70) — themes.ts manages a single <link> element and
// swaps its href to this URL, so switching themes at runtime can never
// leave a stale, still-active stylesheet from a previously loaded theme in
// the DOM (see themes.ts's applyHighlightTheme for the full explanation).
export { default } from 'highlight.js/styles/atom-one-light.min.css?url';
