// F30 / ADR-0005 — CSS tree-shaking for HTML export: extract only the rules
// that actually match something in the exported subtree, rather than
// dumping the whole application stylesheet into the exported file. Reads
// `document.styleSheets` (same-origin extension pages, so `.cssRules` is
// always accessible) instead of depending on a CSS-purifier package.
//
// `:root`/`html`/`body` selectors are always kept regardless of whether
// they textually match the export root, since they carry the theme/
// typography custom properties (`--markora-*`) the rest of the exported
// CSS depends on — `src/export/html/serialize.ts` copies the live
// `<html>` element's resolved theme/typography state onto the exported
// document's own root, so those selectors still need to resolve there.
const ALWAYS_KEPT_SELECTOR = /^(:root|html|body)\b/;

/** Strips pseudo-elements (`::before`, `::first-line`, ...), which `matches()`/`querySelector()` reject as a bare selector fragment. Bare pseudo-classes (`:hover`, `:not(...)`) are left alone — both `matches()` and `querySelector()` accept them fine. */
function stripPseudoElements(selector: string): string {
  return selector.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, '').trim();
}

function selectorApplies(selectorText: string, root: Element): boolean {
  return selectorText.split(',').some((part) => {
    const raw = part.trim();
    if (!raw) return false;
    if (ALWAYS_KEPT_SELECTOR.test(raw)) return true;
    const base = stripPseudoElements(raw);
    if (!base) return false;
    try {
      return root.matches(base) || root.querySelector(base) !== null;
    } catch {
      // Not a selector `matches()`/`querySelector()` can evaluate (a
      // vendor-prefixed or otherwise exotic pseudo-class) — excluding it
      // is the safe default; a rule that never actually applied to
      // anything real is not a normal way for one of these to show up.
      return false;
    }
  });
}

function collectFromList(rules: CSSRuleList, root: Element, out: string[]): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (selectorApplies(rule.selectorText, root)) out.push(rule.cssText);
    } else if (rule instanceof CSSMediaRule) {
      const inner: string[] = [];
      collectFromList(rule.cssRules, root, inner);
      if (inner.length > 0) out.push(`@media ${rule.media.mediaText} {\n${inner.join('\n')}\n}`);
    } else if (typeof CSSFontFaceRule !== 'undefined' && rule instanceof CSSFontFaceRule) {
      out.push(rule.cssText);
    }
    // @keyframes are handled separately in collectUsedCss (inclusion
    // depends on whether an already-kept rule references the name).
  }
}

function collectKeyframes(sheets: StyleSheetList, usedText: string, out: string[]): void {
  if (typeof CSSKeyframesRule === 'undefined') return;
  const seen = new Set<string>();
  for (const sheet of Array.from(sheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSKeyframesRule)) continue;
      if (seen.has(rule.name)) continue;
      if (new RegExp(`\\b${rule.name}\\b`).test(usedText)) {
        seen.add(rule.name);
        out.push(rule.cssText);
      }
    }
  }
}

/**
 * Returns the CSS text of every rule in `document.styleSheets` that matches
 * something inside `root` (or is one of the always-kept root-level
 * selectors), plus any `@keyframes` block a kept rule's `animation`/
 * `animation-name` property references.
 */
export function collectUsedCss(root: Element): string {
  const sheets = document.styleSheets;
  const matched: string[] = [];
  for (const sheet of Array.from(sheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheet (shouldn't occur for an extension page's
      // own bundled CSS, but skip rather than throw if it ever does).
      continue;
    }
    collectFromList(rules, root, matched);
  }
  const keyframes: string[] = [];
  collectKeyframes(sheets, matched.join('\n'), keyframes);
  return [...matched, ...keyframes].join('\n');
}
