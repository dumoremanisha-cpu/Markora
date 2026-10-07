# 04 — Security & Privacy

Source: `projectDetails.md` §4, §36, §50 (test requirements), §52.

The extension processes arbitrary, untrusted Markdown/HTML from the local
filesystem and from the open internet. Security and privacy are first-class
requirements, not afterthoughts.

## 1. Privacy guarantees (must hold by default, no exceptions)

- Markdown content never leaves the browser.
- No upload of document content to any backend.
- No analytics, no telemetry, no usage tracking, no crash reporting service that
  transmits document content or identifiable data.
- No personal information is collected.
- No document content is ever sent to a third-party AI service.
- Settings, recent documents, folder bookmarks, and annotations are stored only
  in `chrome.storage.local` (never `chrome.storage.sync`, never a remote store).

**The exceptions**, and each must be explicit: optional PlantUML network
rendering (see [`03-architecture.md`](./03-architecture.md) §4) and, if
implemented, rich external-link hover previews (see
[`01-functional-requirements.md`](./01-functional-requirements.md) §19 — F72).
Any feature like this must:

1. Be off by default.
2. Clearly disclose what leaves the device and to where, before the user opts in.
3. Require an explicit, separate opt-in action (not bundled into a general
   "enable diagrams" toggle).

### Third category: document-referenced subresources (not an opt-in feature)

Distinct from both "no network" and "opt-in network features", there is
network activity Markora does not initiate as a *feature* but which follows
inevitably from displaying a document the user opened:

- **Rendering**: a document containing `![alt](https://host/img.png)` causes
  the browser to fetch that image, exactly as it would in any tab. This
  reveals the reader's IP address and request timing to that host.
- **HTML export**: remote images are fetched so they can be embedded as
  base64 data URLs, making the exported file self-contained
  ([`../adr/0005-export-architecture.md`](../adr/0005-export-architecture.md)).
- **DOCX export**: `http(s)` image sources are fetched for embedding into the
  package (same ADR).

Rules that keep this inside the privacy guarantee:

1. **No document content, URL, identifier, or user data is ever *sent*.**
   These are plain GET requests for resources the document itself references;
   nothing about the user or the document body is transmitted.
2. Requests are limited to URLs literally present in the open document. No
   speculative prefetching, no metadata scraping, no third-party beacons.
3. Export-time fetches happen only when the user invokes an export.
4. A **"Block remote images"** setting is offered for users who want even this
   eliminated; when enabled, remote images render as a placeholder with a
   click-to-load affordance, and export falls back to linking rather than
   embedding.

Compliance checks (e.g. the Phase 9 network audit) must therefore assert
"**no request carries document content or user identifiers, and every request
target appears in the open document**" — not "zero network requests", which
was never achievable for a document viewer and would fail on the first README
containing a badge image.

**Custom web fonts:** if the typography settings (§26 of the functional spec)
offer fonts beyond a system-font default, prefer bundling the font files with
the extension over loading them from a CDN (e.g. Google Fonts) at runtime —
this avoids even a minor, disclosed third-party network dependency and keeps
the "everything local" guarantee unconditional rather than caveated.

**Deliberately not implemented:** this product does not collect feedback on
uninstall (no `chrome.runtime.setUninstallURL` survey redirect). This is a
known capability of the parity target that is intentionally excluded to keep
the zero-data-collection guarantee absolute — see
[`01-functional-requirements.md`](./01-functional-requirements.md) §40.

## 2. Threat model

Untrusted input sources:

- Local Markdown files (could be crafted maliciously, e.g. shared by someone
  else, or a corrupted/compromised file).
- Remote Markdown (any raw URL — no trust boundary at all).
- Embedded HTML inside Markdown.
- Embedded SVG (via Markdown image syntax or inline HTML).
- Mermaid/Graphviz/PlantUML diagram source (diagram DSLs, not directly HTML, but
  the rendered output touches the DOM).
- `.mdx` content that may contain JSX/import syntax resembling executable code.

Attack classes to defend against: XSS via inline HTML or raw script tags,
XSS via malicious SVG, `javascript:`/`data:`-URL-based script execution in
links or images, event-handler-attribute injection (`onerror=`, `onload=`,
etc.), CSS-based data exfiltration or UI redress, MDX/JSX treated as
executable code, Mermaid/diagram renderer misuse to inject script.

## 3. Required protections

- **DOM sanitization**: run all generated HTML through DOMPurify (or equivalent)
  before it is inserted into the document, with a configuration that strips
  script tags, inline event handlers, and dangerous attributes/protocols.
- **Safe URL handling**: block `javascript:` and other script-executing URL
  schemes in links, images, and any other attribute that accepts a URL. Allow
  only expected schemes (`http:`, `https:`, `mailto:`, relative paths, and
  `file:` only where the user has explicitly granted file access).
- **No arbitrary script execution** — ever — from document content, at any
  point in the pipeline (parsing, diagram rendering, or export).
- **Safe Mermaid handling**: run Mermaid with a strict security configuration
  that disables script execution paths within diagram definitions.
- **Safe SVG handling**: sanitize SVG content the same way as HTML (SVG can
  carry `<script>` and event handlers just like HTML can).
- **Content Security Policy**: an appropriately strict CSP for all extension
  pages (viewer, popup, options), avoiding `unsafe-inline`/`unsafe-eval` where
  at all possible.
- **Secure iframe strategy**: if any renderer (e.g. a diagram engine) needs
  isolation, use a sandboxed iframe with a minimal permission set rather than
  running untrusted content in the same execution context as the app.
- **MDX never executes**: MDX is always treated as data to render safely, never
  as code to run (see [`01-functional-requirements.md`](./01-functional-requirements.md) §3).
- **No security-boundary escape**: Markdown/HTML content must never be able to
  message the background service worker, access `chrome.*` APIs, or otherwise
  act with extension privilege.

### User custom CSS (F87) — added 2026-09-28, not yet implemented

The threat model in §2 already names "CSS-based data exfiltration or UI
redress" as an attack class. The planned custom-CSS feature (F87, Phase 12)
is the surface where that stops being hypothetical, because the realistic
scenario is a user pasting a "reading theme" snippet found online. Full
design and rationale:
[`../adr/0009-user-custom-css-sanitization.md`](../adr/0009-user-custom-css-sanitization.md).
The protections this file requires of it:

- **No egress from CSS, unconditionally.** `@import` is rejected, and every
  `url()` — in any property, in any image-producing function
  (`image-set()`, `cross-fade()`, …), and in **custom properties** — must
  resolve to a `data:` URL or a bare same-document fragment (`url(#id)`).
  Remote `@font-face` sources are covered by the same rule. Custom CSS
  therefore adds **no entry to §1's exceptions list**: it is not an opt-in
  network feature, it is a no-network feature.
- **No CSP relaxation.** The CSS is applied via a **constructed stylesheet**
  (`new CSSStyleSheet()` + `replaceSync()` + `adoptedStyleSheets`), never a
  `<style>` element, `<link>`, or `style=` attribute — so
  `style-src 'unsafe-inline'` is never needed and ADR-0002's
  "`wasm-unsafe-eval` is the only CSP exception" rule is preserved.
- **The parsed CSSOM is the security boundary**, not a raw-text regex: raw
  text is scanned only to give the user a specific error message, while the
  authoritative check walks the browser's own parse of the (still unadopted)
  sheet, where CSS escapes are already normalized.
- **Scope is the rendered-document root only.** Popup, settings page,
  toolbar/sidebars, modals and the toast layer are never styled by it, so no
  snippet can hide a consent disclosure or the feature's own off switch.
  Fixed-position overlay *inside* the content area remains an accepted,
  documented residual risk, bounded by the always-reachable kill switch.
- **User-authored only.** The value comes from the settings UI, is stored in
  `chrome.storage.local` via the typed wrapper, and is never sourced from or
  influenced by document content; settings import (F42) re-runs the full
  sanitization gate before storing.
- **Never carried into exports** (HTML/print/DOCX) or the rich-clipboard
  payload (F84) — a local reading preference must not be baked into a file
  handed to someone else.
- Ships **off by default and empty by default**; the curated reading surfaces
  (F86) and the existing high-contrast mode are the safe default path.

## 4. Security testing requirements

(Detailed test plan in [`06-testing-quality-gate.md`](./06-testing-quality-gate.md);
summarized here as the security-specific must-pass set.)

- XSS payloads via Markdown text, inline HTML, and image/link attributes.
- Malicious HTML fragments (script tags, event handlers, `<iframe>` abuse).
- Malicious SVG (embedded `<script>`, `onload`, `foreignObject` abuse).
- `javascript:`/`data:` URLs in links and images.
- Embedded `<script>` tags in raw Markdown or front matter.
- Unsafe Mermaid/diagram definitions attempting to break out of the renderer.

All of the above must render as inert, sanitized content — never execute.

## 5. Data handled and where it lives

| Data | Storage | Leaves device? |
|---|---|---|
| Open document content | In-memory only (viewer), plus a single-use, TTL-swept extension-origin IndexedDB handoff record during content-script → viewer navigation ([`../adr/0006-viewer-surface-and-content-acquisition.md`](../adr/0006-viewer-surface-and-content-acquisition.md)) | Never |
| Remote subresources referenced by the open document (images) | Not stored; fetched by the browser at render time, and at export time for embedding | The **request** goes to the host the document names (IP/timing visible to it); no document content or identifier is sent. Suppressible via "Block remote images" — see §1 |
| Settings | `chrome.storage.local` | Never |
| Recent documents (filename, source, timestamp) | `chrome.storage.local` | Never |
| Folder bookmarks | `chrome.storage.local` | Never |
| Annotations (highlights, underlines, comments) | `chrome.storage.local` | Never |
| PlantUML diagram source (only if opted in) | N/A — transient | Yes, to the configured PlantUML server, only after explicit consent |
| User custom CSS (F87, planned — Phase 12) | `chrome.storage.local` (typed wrapper), sanitized before storage and before adoption | Never — and by design it cannot *cause* egress either: no `@import`, no non-`data:` `url()` (see §3 and ADR-0009) |

## 6. Documentation deliverables

Per `projectDetails.md` §53, this project must ship (as product documentation,
separate from this spec folder, once implementation exists):

`README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`, `DEVELOPMENT.md`,
`TESTING.md`, `RELEASE.md`, `CHANGELOG.md`.

`SECURITY.md` and `PRIVACY.md` should be direct, user-facing distillations of
this spec document once the corresponding features are implemented and verified
— not aspirational claims written ahead of the code.
