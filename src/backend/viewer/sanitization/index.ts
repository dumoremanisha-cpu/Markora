// DOMPurify config + URL/protocol allowlist (security-privacy.md §1, §3).
// Every path that turns document content into HTML passes through
// sanitizeHtml() before it touches the DOM — no renderer, no plugin, no
// "temporary" path is exempt.
import DOMPurify from 'dompurify';

// http:, https:, mailto:, relative paths, and file: (only where the user
// has explicitly granted file-URL access — file: is allowed here at the
// sanitizer level because it is the DOM-safe scheme check; whether a
// file:// *link* is actually navigable still depends on the user's Chrome
// toggle, which the sanitizer has no way to know and doesn't need to).
// javascript: and every other script-executing scheme is always blocked.
const ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto|file):|[^a-z][a-z0-9+.-]*(?::|$)|(?!\s*[a-z][a-z0-9+.-]*\s*:))/i;

// `target` is not in DOMPurify's default attribute allowlist at all —
// needed for external links to open in a new tab (F25). Allowing it means
// any raw `<a target="_blank">` embedded directly in a document's inline
// HTML must still get a safe `rel` forced onto it below, not just the links
// this codebase generates itself.
const DOCUMENT_CONFIG = {
  ALLOWED_URI_REGEXP,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style'],
  RETURN_TRUSTED_TYPE: false,
};

let configured = false;

// sanitizeHtml is on the hot path — renderMarkdownStreaming calls it once
// per ~300-block chunk, so a multi-MB document means hundreds of calls.
// DOMPurify.setConfig() locks in a config as a fast persistent path
// (subsequent sanitize(dirty) calls skip re-deriving the tag/attribute
// allowlists entirely), so it's used here for exactly that reason — verified
// against a P2 budget regression when this instead called
// DOMPurify.sanitize(dirty, cfg) per chunk. sanitizeDiagramSvg/
// sanitizeMathHtml below are called at most a few dozen times per document
// (once per diagram/math expression, not once per chunk), so they pay a
// small explicit clearConfig()/restore cost instead — see the comment above
// their FORBID_TAGS constant for why they need a different config at all.
function configureOnce(): void {
  if (configured) return;
  configured = true;
  DOMPurify.setConfig(DOCUMENT_CONFIG);
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Belt-and-braces: strip any attribute that still slipped through with a
    // javascript:/data:text/html-style scheme after DOMPurify's own checks.
    for (const attr of ['href', 'src', 'xlink:href']) {
      const value = node.getAttribute?.(attr);
      if (value && /^\s*javascript:/i.test(value)) {
        node.removeAttribute(attr);
      }
    }
    // Safe target behavior (security-privacy.md §3, F25 §19): any anchor
    // with target="_blank" — whether we generated it or a document authored
    // it directly as inline HTML — must never leak window.opener to the
    // opened page.
    if (node.tagName === 'A' && node.getAttribute?.('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/** Sanitizes HTML produced from document content. The only sanctioned way content-derived HTML reaches the DOM. */
export function sanitizeHtml(dirty: string): string {
  configureOnce();
  return DOMPurify.sanitize(dirty);
}

// Mermaid's and KaTeX's own output legitimately depends on the `style`
// attribute (and, for Mermaid, an embedded `<style>` block) for correct
// layout/theming — KaTeX positions glyphs via inline `style`, Mermaid bakes
// its theme into a `<style>` block in the generated SVG (ADR-0002). The
// document-wide `sanitizeHtml` above forbids both globally, as defense
// against attacker-authored raw HTML/CSS-injection in arbitrary Markdown
// content (security-privacy.md §1) — a restriction that has nothing to do
// with these two engines' own generated markup. Rather than loosen that
// global policy, renderer output gets its own DOMPurify pass (still the
// "mandatory DOMPurify pass... before insertion" ADR-0002 requires — same
// module, same URL-scheme allowlist and hooks, just a config appropriate to
// engine-generated content) that permits `style` but still blocks the
// actual script/navigation vectors (`<script>`, `<foreignObject>`,
// `javascript:` URIs, event-handler attributes).
const RENDERER_FORBID_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed'];

const DIAGRAM_SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ALLOWED_URI_REGEXP,
  FORBID_TAGS: RENDERER_FORBID_TAGS,
  RETURN_TRUSTED_TYPE: false,
};

const MATH_HTML_CONFIG = {
  ALLOWED_URI_REGEXP,
  FORBID_TAGS: RENDERER_FORBID_TAGS,
  RETURN_TRUSTED_TYPE: false,
};

// DOMPurify.sanitize(dirty, cfg) silently ignores `cfg` once setConfig() has
// locked in a persistent config (see configureOnce above) — so getting a
// different config for one call means clearing that lock, sanitizing, and
// restoring it for sanitizeHtml's next (far more frequent) call.
function sanitizeWithConfig(dirty: string, cfg: Record<string, unknown>): string {
  configureOnce();
  DOMPurify.clearConfig();
  try {
    return DOMPurify.sanitize(dirty, cfg);
  } finally {
    DOMPurify.setConfig(DOCUMENT_CONFIG);
  }
}

/** Sanitizes the SVG string a diagram engine (Mermaid, Graphviz) produces. Mandatory before DOM insertion (ADR-0002). */
export function sanitizeDiagramSvg(dirty: string): string {
  return sanitizeWithConfig(dirty, DIAGRAM_SVG_CONFIG);
}

/**
 * Mermaid imports the same `dompurify` package we do and, once
 * `securityLevel !== 'loose'`, calls the shared global instance's
 * `DOMPurify.sanitize(code, { ADD_TAGS: [...], HTML_INTEGRATION_POINTS:
 * { foreignobject: true }, ... })` on its own generated SVG *before ever
 * returning it to us*. `DOMPurify.sanitize(dirty, cfg)` silently ignores
 * that `cfg` argument whenever a persistent config is locked in via
 * `setConfig()` — exactly what `configureOnce()` above does for
 * `sanitizeHtml`'s hot path. In practice that meant every Mermaid diagram
 * got sanitized with `DOCUMENT_CONFIG` (a plain-HTML config, no SVG
 * profile, and `FORBID_TAGS: ['style', ...]`) instead of Mermaid's own
 * intended SVG-aware config — silently stripping the `<style>` block
 * Mermaid bakes its theme into (every node rendering with un-themed black
 * SVG fill/text) before `sanitizeDiagramSvg` above ever got a chance to
 * run its own, correct pass.
 *
 * Wrap exactly the third-party call (e.g. `mermaid.render()`) in `fn` —
 * never a wider span — so the shared instance is unlocked for the shortest
 * possible window. The `finally` restores `DOCUMENT_CONFIG` even if `fn`
 * throws (an invalid diagram does), which matters here specifically:
 * without it, a throw would leave the singleton unlocked for whatever
 * `sanitizeHtml` call comes next, which passes no `cfg` of its own and
 * would silently fall back to DOMPurify's own (more permissive) built-in
 * default allowlist instead of `DOCUMENT_CONFIG`. This never weakens what
 * actually reaches the DOM either way — `sanitizeDiagramSvg` still runs
 * its own mandatory pass on `fn`'s result, forbidding `foreignObject`/
 * `script`/etc. regardless of whatever Mermaid's internal pass allowed.
 */
export async function withSanitizerUnlockedForThirdParty<T>(fn: () => Promise<T>): Promise<T> {
  configureOnce();
  DOMPurify.clearConfig();
  try {
    return await fn();
  } finally {
    DOMPurify.setConfig(DOCUMENT_CONFIG);
  }
}

/** Sanitizes HTML KaTeX renders from LaTeX source. Mandatory before DOM insertion (ADR-0002). */
export function sanitizeMathHtml(dirty: string): string {
  return sanitizeWithConfig(dirty, MATH_HTML_CONFIG);
}
