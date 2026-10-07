// MDX pre-parse transform entry point (ADR-0008). Never a compiler: no
// @mdx-js/*, no eval, no new Function, no dynamic import() — pure
// string -> string, feeding the result into the ordinary markdown-it +
// DOMPurify pipeline exactly like any other Markdown document.
import { extractProtectedRegions } from './regions';
import { stripImportExportStatements, stripJsxComponents, stripMdxComments } from './transform';

/**
 * Transforms MDX source to plain Markdown-compatible text. Front matter is
 * the caller's responsibility (ADR-0008 §3 rule 1: extracted and preserved
 * untouched before this runs, never passed through here).
 */
export function transformMdx(source: string): string {
  const { text, restore } = extractProtectedRegions(source);
  let out = text;
  out = stripImportExportStatements(out);
  out = stripMdxComments(out);
  out = stripJsxComponents(out);
  return restore(out);
}

/** Trigger scope (ADR-0008 §2): file extension only in this phase — no "treat as MDX" user action yet. */
export function isMdxSource(sourceLabel: string): boolean {
  const clean = sourceLabel.toLowerCase().split(/[?#]/)[0] ?? '';
  return clean.endsWith('.mdx');
}
