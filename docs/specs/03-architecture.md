# 03 — Architecture

Source: `projectDetails.md` §3, §35, §41–43, §51.

## 1. Technology stack (locked)

| Layer | Choice | Rationale |
|---|---|---|
| Extension platform | Chrome Manifest V3 | Required; MV2 is deprecated |
| Language | TypeScript | Type safety across a large module surface |
| Bundler | Vite (or equivalent modern bundler) | Fast dev loop, good MV3 extension plugin ecosystem |
| UI | Modern HTML/CSS, no framework | `projectDetails.md` explicitly disallows React/Next/backend/DB/cloud by default; keep it lightweight and dependency-light |
| Markdown parser | markdown-it (or equivalent) + GFM plugins | Extensible plugin architecture, mature, widely used |
| Syntax highlighter | highlight.js (or equivalent) | Broad language coverage, themeable |
| Math | KaTeX | Fast, no MathJax runtime cost, good browser fit |
| Diagrams | Mermaid (bundled); Graphviz via a client-side WASM renderer (e.g. `@hpcc-js/wasm`); PlantUML via local rendering where feasible, else opt-in remote | See §4 below |
| Sanitization | DOMPurify | Industry-standard HTML sanitizer |
| Export | Standalone HTML (native); a DOCX-generation library (e.g. `docx` npm package); print CSS → browser Print-to-PDF | No PDF-rendering library needed — browser print covers it |
| Storage | `chrome.storage.local` exclusively | Settings, recents, bookmarks, annotations — never `chrome.storage.sync` (that would leave the device) |

No backend, no database, no cloud infrastructure, no telemetry SDKs.

**Future-proofing note (no v1 behavior):** the settings object persisted to
`chrome.storage.local` should reserve a `licenseStatus` field (e.g.
`{ tier: "free" }`), always `"free"` in v1 with no logic reading or writing
anything else into it. This lets the popup/settings "License status" UI (see
[`01-functional-requirements.md`](./01-functional-requirements.md) §31) exist
today without a storage-schema migration if a paid tier is ever built later.
No payment SDK, license-key validation, or server call is part of v1 — see the
decision recorded in [`02-feature-matrix.md`](./02-feature-matrix.md).

## 2. Module layout

```text
src/
├── background/          # MV3 service worker: messaging, file-open orchestration,
│                         # permission helpers, chrome.commands handling
├── content/              # Content script: detects Markdown pages/requests,
│                         # decides whether to hand off to the viewer
├── viewer/               # The main document viewer (extension page, not a
│                         # content-script overlay)
│   ├── markdown/         # Parse pipeline: markdown-it + plugins
│   ├── syntax/           # highlight.js integration, copy button, line numbers
│   ├── mermaid/          # Mermaid render adapter (sandboxed, safe config)
│   ├── math/             # KaTeX adapter
│   ├── diagrams/         # Graphviz + PlantUML adapters
│   └── sanitization/     # DOMPurify config, URL/protocol allowlists
├── components/           # UI: toc, toolbar, sidebar, file-browser, lightbox,
│                         # annotations, presentation, mindmap, search
├── export/               # html/, docx/, print/
├── settings/             # Options page + in-viewer settings modal
├── popup/                # Lightweight popup UI
├── i18n/                 # Locale loader, string catalogs, RTL helpers
├── storage/              # Typed wrapper over chrome.storage.local
├── utils/                # Shared helpers
└── styles/               # Design tokens, light/dark themes, print stylesheet
```

This can be refined during implementation, but the separation of concerns
(parse → sanitize → enhance, as distinct modules from UI components, from
export) must be preserved so any one rendering feature can fail in isolation.

## 3. Data flow

1. **Detection** — a content script identifies a candidate Markdown source per
   the policy in §5 (no `webNavigation`, no content-type sniffing — ADR-0001
   §2).
2. **Load** — per
   [`../adr/0006-viewer-surface-and-content-acquisition.md`](../adr/0006-viewer-surface-and-content-acquisition.md):
   for a matched navigation the content script reads the text the tab has
   **already loaded** and hands it to the viewer page through a single-use,
   TTL-swept extension-origin IndexedDB record — the viewer never re-fetches
   the URL, so no http(s) host permission is required. For picker/drag-drop/
   folder-browser routes the viewer obtains the bytes directly (File System
   Access API / `DataTransfer`). Content is **never** uploaded anywhere; it
   moves from source → extension memory only.
3. **Pipeline** — parse (markdown-it) → sanitize (DOMPurify, applied to the
   generated HTML before it touches the DOM) → enhance (syntax highlight, KaTeX,
   Mermaid/Graphviz/PlantUML rendering, TOC extraction, front-matter parsing) →
   mount into the viewer DOM.
4. **Chrome** — TOC, toolbar, sidebars, search, reading-progress bind to the
   mounted DOM (scroll-spy, in-document search index, etc.).
5. **Persistence** — settings, recent documents, folder bookmarks, and
   annotations are read/written through the `storage/` wrapper into
   `chrome.storage.local` only.

## 4. Diagram rendering strategy

- **Mermaid**: bundled JS library, run in the viewer page with Mermaid's
  `securityLevel` set to a strict/sandboxed mode; never eval document-provided
  script.
- **Graphviz/DOT**: render client-side via a WASM Graphviz build — no network
  round-trip, no server dependency, works offline.
- **PlantUML**: PlantUML's canonical renderer is a Java server; a fully
  client-side implementation is not practical to guarantee. Policy:
  1. Attempt a local/WASM-based renderer first if one exists that covers common
     diagram types reliably.
  2. Otherwise, treat PlantUML as **opt-in network rendering**: off by default,
     a settings toggle with explicit disclosure ("diagram source will be sent to
     `<server>`"), and a configurable server URL (default to a well-known public
     PlantUML server only after consent, or let the user point at a self-hosted
     one).
  3. If neither is available/enabled, show a clear inline message — the rest of
     the document must still render normally.

## 5. Content detection policy

The detection *mechanism* is fixed by
[`../adr/0001-file-access-and-detection.md`](../adr/0001-file-access-and-detection.md)
§2 (narrow content-script path-glob matching, no content-type sniffing) and the
*handoff* by
[`../adr/0006-viewer-surface-and-content-acquisition.md`](../adr/0006-viewer-surface-and-content-acquisition.md).
This section states the resulting policy.

**Auto-render** (no user action beyond opening/navigating):

- Local files with Markdown extensions (`file://`, once file-URL access is
  granted).
- Raw GitHub / GitLab / Bitbucket / Gitea raw-content URLs (curated
  host+path pattern list).
- Any URL whose path ends in `.md`, `.markdown`, `.mdown`, `.mkd` or `.mdx`,
  on any host, via path-suffix glob patterns.
- `.txt` **only** when the filename is exactly `llms.txt`. No other `.txt`
  URL is auto-matched — the content is ambiguous and `*://*/*.txt` would be a
  disproportionately broad match (ADR-0001 §2). Other Markdown-in-`.txt`
  content reaches the viewer via drag-and-drop, "Open file", or the folder
  browser.
- Drag-and-drop, "Open file", "Open folder" (explicit user action).

**Not auto-rendered, but reachable on demand:** URLs that serve Markdown with
no recognizable path suffix (content-type-only detection). Detecting those
*passively* would require either a broad host permission or
`webRequest`/`declarativeNetRequest` inspection of every page the user visits
— both disproportionate for a Markdown viewer (ADR-0001 §2). Instead, the
popup offers a **"Render this page as Markdown"** action: on click,
`activeTab` grants access to that one tab, the extension injects the same
content script used elsewhere (`scripting`), and the normal ADR-0006 handoff
runs. The action declines with a clear message if the page is not a
plain-text document, rather than mangling rendered HTML. Nothing happens
passively and no persistent host access is granted.

**Never auto-replace** — pages that already render their own Markdown:

- GitHub repository or blob HTML pages.
- GitBook, Read the Docs, and similarly already-rendered documentation sites.

**v1 decision (2026-09-08): there is no opt-in toggle to override this.**
Earlier drafts of this document and of `01-functional-requirements.md` §1
described a settings toggle that would let the user enable rendering on those
sites. It is **descoped from v1**: enabling it would require host permissions
for `github.com`, GitBook and Read the Docs domains that no other feature
needs and that the permission matrix in
[`07-permissions-compliance.md`](./07-permissions-compliance.md) has never
justified, in exchange for replacing pages that already display the content
well. F05's v1 requirement is therefore purely negative: *never hijack these
sites*. If the toggle is ever revisited it is new scope with its own
optional-host-permission analysis, not a stub to be quietly completed.

Rationale: the extension must be a strict *addition* to the browsing experience
by default, never surprising a user by hijacking a page that already looks fine.

## 6. Permissions principle

Minimum permissions, always. For every permission requested:

1. State why it's needed.
2. Confirm it can't be avoided.
3. Confirm no narrower permission/API covers the same need.
4. Confirm it won't trigger elevated Chrome Web Store review scrutiny
   unnecessarily.

Full manifest and justification lives in
[`07-permissions-compliance.md`](./07-permissions-compliance.md). Prefer optional
host permissions and user-gesture-triggered access (e.g. File System Access API
folder picks) over broad `*://*/*` host permissions wherever the feature allows
it.

## 7. Browser compatibility

Primary target: Google Chrome. Architecture must also work, unmodified where
possible, on other Chromium browsers: Microsoft Edge, Brave, Opera, Vivaldi.
Avoid Chrome-only APIs unless a feature genuinely requires one (document any such
case explicitly, per §6).

## 8. Extension surfaces

| Surface | Role | Must NOT be |
|---|---|---|
| Background service worker | Routing, messaging, permission helpers, `chrome.commands` | A place for business logic that belongs in the viewer |
| Content script | Detect candidate Markdown on arbitrary pages, read the already-loaded text, hand it off to the viewer (ADR-0006) | A full re-implementation of the viewer inline on third-party pages; a fetcher of remote content |
| Viewer page | The actual rendering application; owns folder browsing, bookmarks, annotations, and all document-level UI | Embedded inside the popup |
| Popup | Quick actions: Setup/permission help, recent documents, **theme control**, **"Open file" / "Open folder" launchers** (which focus or open the viewer and trigger the picker there, per ADR-0001 Flow B), master enable toggle, language quick-select, Clear Cache, links to settings/help | The full application; the home of the folder browser or bookmark management |
| Options page | Full settings UI | The only place settings can be changed — an in-viewer quick-settings modal is also in scope per `01-functional-requirements.md` §32 |
