# Security — Phase 1 + 2-A baseline

Sanitization and content-handling approach implemented so far. Expanded as
later phases add renderers (diagrams, math, export).

## Sanitization pipeline

Every path that turns document content into HTML passes through
`sanitizeHtml()` (`src/viewer/sanitization/`, backed by DOMPurify) before it
touches the DOM — no renderer, no plugin, no "temporary" unsanitized path.
Exercised by the full Phase 2-A markdown-it pipeline (`src/viewer/markdown/`):
GFM plugins, custom containers, GitHub-style alerts, front matter, the MDX
transform's output, and syntax-highlighted code all flow through the same
single call in `renderMarkdown()`. Phase 3-A/3-B route Mermaid/Graphviz/
PlantUML SVG output through it too.

- `FORBID_TAGS: ['style', 'script']`, `FORBID_ATTR: ['style']`.
- `ALLOWED_URI_REGEXP` accepts `http:`, `https:`, `mailto:`, `file:`, and
  relative paths; `javascript:` and other script-executing schemes are
  rejected. A defensive `afterSanitizeAttributes` hook additionally strips
  any `href`/`src`/`xlink:href` that still starts with `javascript:` after
  DOMPurify's own pass.
- `ADD_ATTR: ['target']` (Phase 2-A) — `target` is not in DOMPurify's default
  attribute allowlist, but is needed for the external-link "open in new tab"
  behavior (F25). Because this allows `target` on _any_ sanitized anchor —
  not just ones this codebase generates — the same `afterSanitizeAttributes`
  hook force-sets `rel="noopener noreferrer"` whenever it sees
  `target="_blank"` on an `<a>`, regardless of where that anchor came from.
  Without this, a document's own inline `<a target="_blank">` (no `rel`)
  would sanitize through with a live `window.opener` handle to the extension
  page.
- Heading-anchor ids (F60) are always `heading-<slug>`, never a bare slug —
  DOMPurify's `SANITIZE_DOM` (on by default, left enabled) strips any
  `id`/`name` attribute whose value collides with an existing `document`
  property (e.g. `id="title"`, since `document.title` exists). The prefix
  makes that collision class impossible without weakening `SANITIZE_DOM` for
  every other `id`/`name` attribute in the document. See `DEVELOPMENT.md`.
- Verified by `src/viewer/sanitization/index.test.ts` against `<script>`
  tags, inline event-handler attributes, and `javascript:` URLs in both
  links and images; `src/viewer/markdown/plugins/externalLinks.test.ts` and
  `plugins/anchors.test.ts` cover the two Phase 2-A additions above.

## MDX safe-degradation (F09, ADR-0008)

`.mdx` documents (by file extension only — no "treat as MDX" user action
yet) go through a pure string → string pre-parse transform
(`src/viewer/markdown/mdx/`) before the ordinary markdown-it + DOMPurify
path — never a real MDX compiler, never `eval`/`new Function`/dynamic
`import()`. `import`/`export` statements are removed; capitalized
(component) JSX tags are stripped with their inner text kept (paired) or
replaced with a visible placeholder chip (self-closing) — all attributes on
a stripped tag, including event handlers, are discarded with the tag
itself; lowercase tags are left for DOMPurify to arbitrate. The transform is
never treated as a sanitizer in its own right: every ADR-0008 threat case
still passes through `sanitizeHtml()` afterward, and a transform failure
falls back to rendering the raw source as an (escaped, sanitized) fenced
code block rather than a blank page. All eleven ADR-0008 threat-case table
rows are regression-tested in `src/viewer/markdown/mdx/transform.test.ts`
and `src/viewer/markdown/index.test.ts`'s security block.

## File & Project Management (Phase 4)

- **Folder scanning and search never upload any content.** Neither
  `src/utils/folderScan.ts` nor `src/utils/folderSearch.ts` makes a network
  call of any kind — file reads go through `FileSystemFileHandle.getFile()`
  only. Verified by `e2e/phase4.spec.ts`'s zero-external-requests assertion
  during a folder open + search (same pattern as Phase 3-B's Graphviz
  network-zero test).
- **FSAA directory handles are never exposed to content scripts or any page
  outside the extension's own pages.** They exist only as in-memory
  `FileSystemDirectoryHandle` objects held by the viewer, and (for
  persistence) in `src/storage/fsaaHandles.ts`'s extension-origin IndexedDB
  database — a separate origin/database than anything a content script or
  matched page can reach, and never sent over `chrome.runtime` messaging.
- **`unlimitedStorage` is never declared statically.** It is
  `optional_permissions`-only in `manifest.config.ts` and is requested via
  `chrome.permissions.request()` (routed through
  `src/background/index.ts`'s `permissions/requestUnlimitedStorage`
  handler) only after `chrome.storage.local` usage crosses the ADR-0004
  warning threshold (`src/utils/quota.ts`) **and** the user explicitly
  clicks "Grant unlimited storage" in Settings → Maintenance — never
  requested speculatively or at install time.
- **"Clear Cache" (F55) has an exact, tested scope.** It clears
  `markora.recents`, `markora.bookmarks` (and their linked FSAA handle
  records), and transient handoff records — and **never** touches
  `markora.settings`, `markora.schemaVersion`, or the last-opened-folder FSAA
  handle. Regression-tested in both `src/storage/index.test.ts` (unit) and
  `e2e/phase4.spec.ts` (asserts a seeded `theme` setting survives Clear
  Cache while seeded recents/bookmarks are wiped).
- **Recent-documents capture keeps the ADR-0001 §4 gesture-scoped rule.**
  `src/viewer/index.ts`'s `afterDocumentLoaded()` only records a _remote_
  document in `markora.recents` when the handoff's
  `hints.addressBarEntered` is true (computed in the content script per
  ADR-0006 §6); local documents (any access flow) are always recorded, since
  opening them is inherently an explicit user action already.

## Content acquisition (no unsanctioned network access)

- Matched remote/`file://` documents are handed off via the ADR-0006 flow:
  the content script reads text already rendered in the tab
  (`document.body.innerText` / `document.querySelector('pre')`) — it never
  calls `fetch()`. The extension never re-requests the source URL; verified
  in `e2e/phase1.spec.ts` via a request-count assertion against a local test
  server.
- Handoff records live in extension-origin IndexedDB
  (`src/storage/handoff.ts`), are single-use (deleted on read), and are
  TTL-swept (60s) at service-worker start-up and before every new write.
- Local file content via "Open file" (File System Access API) and
  drag-and-drop is read directly by the viewer page; no handoff record is
  created for those paths.

## F05 — never hijack GitHub blob/GitBook/RTD pages

URL suffix matching alone cannot guarantee this: a GitHub blob URL like
`github.com/u/r/blob/main/README.md` genuinely ends in `.md`. The actual
guarantee is a second, content-shape gate —
`looksLikeRawTextDocument()` (`src/content/detect.ts`) — checked _after_ the
URL predicate and _before_ any handoff is created. It requires the
already-loaded document to look like a raw-text response (`Content-Type`
other than `text/html`, or a body consisting of nothing but a single
`<pre>`) — which a rendered GitHub/GitBook/RTD app page never does. See
`DEVELOPMENT.md` for the full rationale.

## `web_accessible_resources` scoping

`manifest.config.ts` declares `viewer.html` web-accessible to `<all_urls>`
rather than mirroring the exact `content_scripts` match patterns ADR-0006
originally specified. This is a workaround for a reproduced bug in the
bundled Chrome-for-Testing build (extension fails to load at all when both
`content_scripts` and `web_accessible_resources` use host-wildcard patterns
together — see `DEVELOPMENT.md`), not a design choice. Security impact:
`web_accessible_resources` only grants read access to the static
`viewer.html` file; it grants no message-passing capability and no way to
guess another origin's handoff token (`crypto.randomUUID()`). Any origin
broad enough to exploit the wider match already qualifies as a
`content_scripts` match too, so this does not add a new class of exposed
origin in practice. Revisit if `content_scripts.matches` is ever narrowed
below wildcard-host scope.

## Master enable toggle (F54)

When `Settings.extensionEnabled` is `false`, the content script's own first
step is a `detection/ping` round-trip to the background service worker; if
the extension is disabled, it returns immediately and never reads document
text or creates a handoff record. The viewer performs the same check before
building any UI, so a directly-opened viewer tab (via "Open file" or
drag-and-drop) also renders only the disabled-state message — never a
partial render.

## Graphviz — fully offline, WASM (Phase 3-B, F13, ADR-0002)

`src/viewer/diagrams/graphviz/` renders `dot`/`graphviz` fences via
a bundled WASM build (`@hpcc-js/wasm-graphviz`), never a CDN fetch or a
server round-trip. That package embeds its compiled `.wasm` as base64
inside its own JS (confirmed by inspecting `node_modules/@hpcc-js/wasm-graphviz/dist/index.js`
and by checking `dist/manifest.json` after a real build has no new
`web_accessible_resources` entry), so it loads as an ordinary same-origin
code-split chunk under the CSP's existing `wasm-unsafe-eval` allowance — the
one and only CSP relaxation in the product (ADR-0002). Output SVG is
sanitized through `sanitizeDiagramSvg()` before insertion like every other
renderer; invalid DOT source is caught and shown as the standard inline
error notice, never left to break the surrounding document.
`e2e/phase3b.spec.ts` asserts zero network requests fire while rendering a
Graphviz diagram.

## PlantUML — the one opt-in, disclosed network feature (Phase 3-B, F14, ADR-0002)

`src/viewer/diagrams/plantuml/` is the **only** module in the entire product
that ever calls `fetch()`. It is off by default (`Settings.plantumlEnabled`)
and, when enabled, sends nothing but the diagram source — compressed and
re-encoded into the request URL path by a hand-rolled implementation of
PlantUML's own text-encoding (`encode.ts`, no dependency) — never any other
document content, and the request fires only for the specific diagrams a
user's document contains, never speculatively. The Settings → Privacy
surface (`src/settings/index.ts`) shows the disclosure text naming the
configured server before the toggle can be turned on, per
security-privacy.md §6. The returned SVG is sanitized through
`sanitizeDiagramSvg()` exactly like Mermaid/Graphviz output before
insertion. When disabled, or when the server errors/is unreachable, the
placeholder shows a standard inline notice and the rest of the document
renders normally — never a blank/broken page.
`e2e/phase3b.spec.ts` asserts: zero requests while disabled (even with a
`plantuml` fence present), exactly one request per diagram when enabled
(intercepted and asserted to carry only the encoded diagram source, never
other document content), and a clean fallback notice when the server
errors. No new manifest permission was needed — `fetch()` from an extension
page to an arbitrary origin needs no `host_permissions` entry; it behaves
like a normal cross-origin fetch from any webpage, gated by the target
server's own CORS policy.

## Annotations (Phase 5, F27, ADR-0003)

- **Never touch the source document.** Annotations live only in
  `chrome.storage.local` (sharded per document, `src/storage/annotations.ts`)
  and as `<mark>` wrappers applied to the already-rendered `contentEl` DOM
  (`src/components/annotations/marks.ts`) — there is no "apply to document"
  write-path anywhere in this phase, matching ADR-0003's non-mutation
  guarantee. `contentEl` is rebuilt from scratch on every document (re)load
  regardless, so this can never leak into the next render either.
- **Comment text is never assigned via `.innerHTML`.** A comment
  (user-authored, and could itself contain pasted HTML-like text) is only
  ever set via `.textContent` or a `<textarea>.value` in
  `src/components/annotations/index.ts` — structurally immune to HTML/script
  injection regardless of content, the same practical guarantee
  `sanitizeHtml()` gives content that _is_ inserted as markup.
- **`markora.annotations.*` is never touched by Clear Cache (F55).** Only the
  new, separately-confirmed `deleteAllAnnotations()` removes annotation data
  (`src/storage/index.ts`) — regression-tested in
  `src/storage/index.test.ts` and `e2e/phase5.spec.ts`.
- **The re-anchoring search and mark-wrapping never touch the network or any
  `chrome.*` API beyond `chrome.storage.local`** — `src/viewer/annotations/`
  is pure string/array logic, and `src/components/annotations/marks.ts` only
  ever mutates DOM nodes already present in `contentEl`.

## No script execution from document content

No `eval`, no `new Function`, no dynamic script injection anywhere in the
pipeline. markdown-it is configured with `html: true` (GFM allows a safe
subset of inline HTML), but every byte of its output — including any raw
HTML the author wrote — passes through `sanitizeHtml()` before mounting, so
inline `<script>`/event handlers are stripped regardless of source.

## Settings import validation (Phase 10, F42)

`src/settings/importExport.ts`'s `parseImportedSettings()` never trusts an
imported JSON file's shape. It never uses `eval`/`Function`/dynamic
`import()` to parse anything — `JSON.parse()` only, in a `try`/`catch`. The
result is built by walking `DEFAULT_SETTINGS` as the template of allowed
top-level keys: only a key the template defines is ever copied out of the
parsed input, and its value is structurally shape-checked (same
primitive/array-element type, same nested-object key set, recursively)
before being accepted. A handful of string fields (`theme`,
`textDirectionOverride`, `contentWidthMode`, `alertTitleMode`,
`fileTypeFilter`) are additionally checked against their known enum values.
Because the walk is keyed off the template's own keys — never
`Object.keys()` of the untrusted input — a crafted file containing
`__proto__`/`constructor`/`prototype` keys is never even inspected, let
alone copied anywhere; there is no prototype-pollution path. A file that
parses to anything other than a plain object (an array, a primitive, or
invalid JSON) is rejected outright. The accepted, validated
`Partial<Settings>` is handed to the existing `setSettings()` — the one and
only settings write path (code-conventions.md §2) — exactly like every
other settings mutation in the product; import adds no second write path.
Regression-tested in `src/settings/importExport.test.ts` (malformed JSON,
top-level array/primitive, wrong-typed fields, out-of-enum values,
malformed nested objects, `__proto__`/`constructor` injection attempts) and
`e2e/phase10.spec.ts` (a real crafted-file import through the actual file
input shows the error toast and leaves storage untouched).
