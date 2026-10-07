# Privacy

Markora is privacy-first by construction: every document you open is parsed,
sanitized, and rendered entirely inside your browser. Nothing about the
document you're viewing — its content, its filename, its URL — is uploaded
anywhere, with exactly one disclosed, off-by-default exception below. There
is no analytics SDK, no crash reporter, no usage tracking, and no
`chrome.runtime.setUninstallURL` (`docs/specs/04-security-privacy.md` §5).

## What stays local

- **Documents.** Local files (via "Open file" or drag-and-drop) are read
  directly by the viewer page. Remote/`file://` documents matched by the
  content script are handed off using text the browser already loaded —
  the extension never re-fetches the source URL itself
  (`docs/adr/0006-viewer-surface-and-content-acquisition.md` §2; verified in
  `e2e/phase1.spec.ts` via a request-count assertion).
- **Settings, recents, bookmarks, annotations.** `chrome.storage.local`
  only, via the typed wrapper in `src/storage/` — never
  `chrome.storage.sync`, never a remote store
  (`docs/adr/0004-storage-schema-and-quota.md`).
- **Diagram/math rendering.** Mermaid, KaTeX, and Graphviz all render fully
  offline — Graphviz via a WASM build bundled inside the extension package,
  never fetched from a CDN at runtime (`docs/adr/0002-diagram-rendering-strategy.md`).

## The one exception: PlantUML (off by default)

PlantUML (F14) has no mature, offline-capable client-side renderer today
(`docs/adr/0002-diagram-rendering-strategy.md`'s PlantUML feasibility
finding). Rendering a `plantuml` diagram therefore requires sending its
source to a PlantUML rendering server — the one place in the product where
document-derived data ever leaves your browser. This is:

- **Off by default.** `Settings.plantumlEnabled` starts `false`; no request
  is ever made until you explicitly turn it on.
- **Its own dedicated toggle**, in Settings → Privacy — never bundled into
  a general "enable diagrams" switch, and shown alongside disclosure text
  naming the exact server that will receive diagram source before the
  toggle can be turned on.
- **Scoped to a server you configure** (`Settings.plantumlServerUrl`,
  defaulting to the public `plantuml.com` server) — no request is sent to
  any server you haven't set.
- **Limited to diagram source only.** Only the text inside a
  `plantuml`/`puml` fence is compressed and encoded into the
  request URL (`src/viewer/diagrams/plantuml/encode.ts`) — never the
  surrounding document, your filename, your URL, or any identifier.
- **Isolated to one module.** `src/viewer/diagrams/plantuml/` is the only
  code in the entire product that calls `fetch()`; no other renderer,
  component, or background script makes network requests for rendering
  purposes.

When PlantUML rendering is off (the default), or the configured server is
unreachable, the diagram shows a clear inline message and the rest of the
document renders normally — never a broken or blank page.

If a genuinely offline, production-quality PlantUML renderer becomes
available in the future, replacing this opt-in path is a follow-up
enhancement, not a requirement — this document will be updated if that ever
changes what leaves your browser.

## Document-referenced subresources

An image a document links to (`![alt](https://example.com/pic.png)`) loads
the same way it would in any browser tab — that's an inevitable
consequence of viewing a document that references it, not a feature this
extension adds, and it never carries document content or an identifier
beyond what any ordinary image request would.

## First-run setup, settings export, and outbound links

- **Onboarding collects nothing.** The first-run tour (shown once, on
  install) has no account creation, no sign-up, and sends nothing anywhere
  — it only reads local settings and opens the bundled sample document
  already on your device.
- **Settings export/import stays local.** "Export settings" saves your
  current settings to a file on your device via your browser's normal
  download flow; "Import settings" reads a file you pick, validates its
  shape, and writes it to `chrome.storage.local` — neither step involves a
  network request.
- **Help/feedback/rate-extension links are plain, explicit outbound
  navigations** — nothing is sent automatically, and nothing about your
  session or documents accompanies the click.

## Permissions

See `docs/specs/07-permissions-compliance.md` for the full justification of
every manifest permission Markora requests. In short: `storage` (local
settings only), `file:///*` (inert until you enable "Allow access to file
URLs" yourself), and `activeTab`/`scripting` (used only by the "Render this
page as Markdown" popup action, for the one tab you click it from). Markora
never requests `history`, `webRequest`, `tabs`, `cookies`, or a blanket host
permission.
