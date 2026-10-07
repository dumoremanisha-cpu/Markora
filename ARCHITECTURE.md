# Architecture

Records how the codebase is actually structured, updated at the end of each
implementation phase. See `docs/specs/03-architecture.md` for the target
design; this file tracks what has actually landed.

## Module layout (as of Phase 2-A)

- `src/background/` — service worker: routing/messaging only, no business
  logic (code-conventions.md §3).
- `src/content/` — detection (`detect.ts`) + handoff, never a fetcher or a
  second rendering implementation.
- `src/viewer/` — the actual application (extension page).
  - `src/viewer/markdown/` — the parse stage: markdown-it pipeline assembly,
    front matter, MDX transform, and one file per renderer-level feature
    under `plugins/`.
  - `src/viewer/sanitization/` — the sanitize stage: the one and only
    DOMPurify entry point (`sanitizeHtml`).
  - `src/viewer/syntax/` — highlight.js integration, curated theme loading,
    and the copy-button enhance-stage wiring.
  - `src/viewer/mermaid/`, `src/viewer/math/` — Mermaid (F11/F79) and KaTeX
    (F12) hydration adapters, Phase 3-A.
  - `src/viewer/diagrams/graphviz/`, `src/viewer/diagrams/plantuml/` —
    Graphviz (F13, bundled WASM) and PlantUML (F14, opt-in remote-render,
    the only module that ever makes a network request) hydration adapters,
    Phase 3-B. See "Diagram/math hydration" below.
- `src/storage/` — the only module allowed to call `chrome.storage.local`
  directly; typed `Settings` schema in `schema.ts`.
- `src/i18n/` — `t()` catalog; every UI string, including ones baked into
  markdown-it renderer-rule HTML strings, goes through it.
- `src/components/` — shared UI (toolbar shell, the one toast component).
- `src/assets/demo/` — the bundled demo document (`demo.md`) and its MDX
  companion sample (`demo.mdx`), F46.

## The rendering pipeline (Phase 2-A)

`renderMarkdown(source, options)` in `src/viewer/markdown/index.ts` is the
single entry point. Stages run in this fixed order, matching
code-conventions.md §4's parse → sanitize → enhance separation:

1. **Front matter extraction** (`frontMatter.ts`) — runs first, against the
   _raw_ source, before any MDX handling. Structurally strips a leading
   `---…---` block; parses it with `js-yaml`'s `load()` (`maxAliases: 0`, no
   custom tags) and renders an escaped-text info card. Skipped entirely
   (source untouched) when the `frontMatter` toggle is off.
2. **MDX transform** (`mdx/`), only when `options.isMdx` is set — a pure
   string → string pre-pass per ADR-0008: protects fenced code/inline
   code/math (`mdx/regions.ts`), strips `import`/`export` statements,
   removes `{/* */}` comments, and strips or chip-replaces capitalized JSX
   tags (`mdx/transform.ts`). Never a compiler; if it throws, the caller
   falls back to rendering the raw source as a fenced code block with a
   notice (ADR-0008 §4) — this happens _before_ sanitization, so the
   fallback path is sanitized like everything else.
3. **markdown-it pipeline** (`buildPipeline` + `renderBody` in `index.ts`) —
   a fresh `MarkdownIt` instance per render call, configured from the F69
   toggle bag (`Settings.markdown`): `breaks`/`typographer` as constructor
   options, `table` disabled via `md.disable()` when off, `footnote`/
   `markdown-it-task-lists`/`markdown-it-deflist`/custom containers added via
   `.use()` only when their toggle is on. Always registered, regardless of
   toggles: heading anchors, GitHub-style alerts, external-link treatment,
   sticky-table wrapping, and the fence renderer (syntax highlighting).
4. **Sanitize** — `sanitizeHtml()` is called exactly once per `renderMarkdown`
   call, on the front-matter card HTML and the pipeline's output
   concatenated together. No renderer or plugin gets a bypass.
5. **Enhance** (caller's responsibility, `src/viewer/index.ts`) — the copy
   button on fenced code blocks is wired once, via event delegation on the
   persistent content container (`src/viewer/syntax/enhance.ts`), so it
   survives the container's `innerHTML` being replaced on every new
   document. Highlight-theme CSS is loaded on demand
   (`src/viewer/syntax/themes.ts`) based on `Settings.highlightTheme`.
   URL-fragment deep-linking (F60) is also enhance-stage: after the sanitized
   HTML is inserted, `scrollToFragmentIfPresent()` looks up
   `document.getElementById(location.hash)` and scrolls/highlights it.

### Streaming variant: `renderMarkdownStreaming`

`src/viewer/index.ts` calls `renderMarkdownStreaming(source, options, onChunk)`
— not the synchronous `renderMarkdown` above — for every document load. It's
the same pipeline (front matter → optional MDX → markdown-it → sanitize),
restructured to bound how much synchronous work happens before yielding to
the browser (budgets P1/P2/P4, `docs/specs/06-testing-quality-gate.md` §1a;
full investigation in `DEVELOPMENT.md`'s "Phase 2-A performance
investigation"):

- `md.parse(body, env)` runs once over the whole document — every core rule
  (anchors, alerts, external links) executes exactly once here, so
  ids/numbering/dedup are byte-identical to the synchronous path regardless
  of how the resulting tokens get batched afterward.
- The resulting token array is split into chunks at top-level
  block-nesting-depth-zero boundaries (`STREAM_CHUNK_BLOCK_COUNT = 300` top-
  level blocks per chunk) — each chunk is independently rendered
  (`md.renderer.render()`) and sanitized, with a `setTimeout(0)` yield
  between chunks (deliberately not `requestAnimationFrame`; see
  DEVELOPMENT.md).
- `renderMarkdown` (synchronous, no chunking) still exists and is what every
  unit test exercises — it's the correctness reference `renderMarkdownStreaming`
  is tested against (`src/viewer/markdown/streaming.test.ts` asserts
  byte-identical output between the two for representative documents).
- The caller (`src/viewer/index.ts`) accumulates each yielded chunk's HTML in
  an array and performs exactly **one** `contentEl.innerHTML = chunks.join('')`
  after the loop completes, not one DOM write per chunk — incremental
  `insertAdjacentHTML` per chunk measured slower overall in real Chromium
  (extra layout passes), even though the CPU-bound parse/sanitize work is
  still correctly sliced and yielded.

**Known gap:** P4 (no task > 500 ms) passes reliably. P1 (<1s @1MB) is
borderline. P2 (<3s @5MB) does not reliably pass on the development VM this
was measured on — see DEVELOPMENT.md for exact numbers, what was tried, and
the noise caveat for this specific machine.

### Plugin registration order inside `renderBody`

`registerAnchors` → `registerAlerts` → `registerExternalLinks` →
`registerStickyTables` → `registerFence`, all against the `md` instance
`buildPipeline` already configured. Order among these five doesn't matter for
correctness — none of them touch the same token types or renderer rules —
but `registerAnchors` uses `core.ruler.push` (runs after every default core
rule, including `inline`) while `registerAlerts` uses
`core.ruler.after('block', …)` (runs before `inline`); both are safe because
neither depends on the other's output.

## Notable Phase 2-A decisions (see `DEVELOPMENT.md` for the full findings)

- **Heading anchor ids are always prefixed (`heading-<slug>`), never a bare
  slug.** DOMPurify's DOM-clobbering protection silently drops an `id`/`name`
  attribute whose value collides with an existing `document` property (e.g.
  a heading literally titled "Title" would otherwise lose its anchor,
  silently, since `"title" in document` is true). The prefix makes that
  collision class structurally impossible.
- **Heading anchors are hand-rolled, not `markdown-it-anchor`.** That
  package's shipped types import from `markdown-it/lib/...` subpaths that
  markdown-it 15's package layout no longer ships (no `lib/` directory at
  all in the installed package) — those imports fail to resolve. The
  anchor-assignment logic needed is small enough not to be worth working
  around this for.
- **Syntax highlighting imports the full `highlight.js` package**, not
  `highlight.js/lib/core` + a curated per-language subset. The subpath
  exports have no per-file `.d.ts`; only an ambient wildcard module
  declaration inside the package's own `types/index.d.ts`, which nothing in
  this program is guaranteed to load. This adds ~380 KB (gzipped) to the
  viewer bundle — acceptable for a once-loaded extension page, and it
  incidentally gives every one of the ~190 languages highlight.js supports,
  not just the spec's minimum list.
- **`target="_blank"` needed an explicit `ADD_ATTR`** in
  `sanitizeHtml`'s DOMPurify config — it is not in DOMPurify's default
  attribute allowlist at all. Because that makes `target` allowed on _any_
  sanitized anchor (not just ones this codebase generates), the sanitizer
  also force-sets `rel="noopener noreferrer"` on every `target="_blank"`
  anchor it sees, closing the window.opener leakage a document's own inline
  `<a target="_blank">` could otherwise open.

## Module layout additions (Phase 2-B)

- `src/components/toc/` — `tree.ts` (pure nesting/filter, unit-tested) +
  `index.ts` (DOM: sidebar, filter input, scroll-spy via
  `IntersectionObserver`, mobile drawer).
- `src/components/search/` — `matches.ts` (pure substring-range finder) +
  `index.ts` (DOM: wraps matched text nodes via `Text.splitText` — never
  re-serializes/re-parses HTML, so it can't become a second, unsanitized
  injection path).
- `src/components/lightbox/` — `safety.ts` (URL-scheme allowlist, defense in
  depth alongside the sanitizer) + `index.ts` (fullscreen/zoom/pan/gallery;
  broken-image placeholders wired _lazily_ from a single capture-phase
  `error` listener, not eagerly per image — see Known Limitations).
- `src/components/sidebar/` — `attachResizeHandle()`, shared by the TOC now
  and the Phase 4 file-browser sidebar later; pointer-drag + keyboard
  (arrow-key) resize, with `aria-valuenow` kept in sync (ARIA treats a
  focusable `role="separator"` as a splitter widget, which requires it).
- `src/components/shortcutHelp/` — the `Ctrl+/` modal; also hosts the
  in-page shortcuts' "Record" recorder (Settings → Shortcuts stays a stub
  this phase per task 7 — see below).
- `src/components/toolbar/` — replaced the Phase 1 empty shell with the full
  toolbar. It's a `<div role="toolbar">`, not `<nav>` — ARIA disallows the
  `toolbar` widget role on the `nav` landmark element (axe: `aria-allowed-role`).
- `src/settings/` — the full options page (`index.html` + `index.ts`),
  registered via `options_ui.open_in_tab: true` in `manifest.config.ts`
  (crxjs auto-detects and bundles it, same as `action.default_popup`).
- `src/popup/eligibility.ts` — pure URL-scheme check for the "Render this
  page as Markdown" button's enabled state, split out from `index.ts` so
  it's unit-testable without a DOM/extension context (matches
  `src/content/detect.ts`'s existing convention for page-bootstrap modules).
- `src/utils/typography.ts`, `src/utils/fonts.ts`, `src/utils/shortcuts.ts`,
  `src/utils/shortcutDefinitions.ts` — pure helpers behind F35/F39/F81.

## The on-demand render path (F04 fallback, task 11)

`content-script.ts`'s `main()` now branches on `window.__markoraOnDemandRender`
(set by the popup via one inline `chrome.scripting.executeScript({ func })`
call, immediately before injecting the file itself) instead of only ever
running via the manifest's passive `content_scripts` match. On this branch it
uses `looksLikeOnDemandCandidate()` (a narrower predicate than the passive
path's `looksLikeRawTextDocument` — see its doc comment in `detect.ts`)
instead of the URL-match gate, then falls through to the same
`detection/ping` → `handoff/create` → `location.replace()` sequence as the
passive path. **No new message type was introduced**: ADR-0006 §7 fixes this
script's message contract to exactly those two types, so the popup itself
runs a separate, message-free read-only probe (`chrome.scripting.executeScript`
with an inline `func`, never touching `chrome.runtime`) _before_ deciding
whether to inject the real content script at all — a declined page never
creates a handoff record and never messages the background.

`chrome.commands` gained one global entry, `toggle-theme`
(`Alt+Shift+D` — not `Ctrl+Shift+D`, which Chrome reserves for "Bookmark all
tabs" and would leave the binding unassigned), handled in
`background/index.ts` by cycling
`Settings.theme` through storage — no messaging to open tabs; every open
viewer/popup already reacts via the existing `storage.onChanged` subscription
in `utils/theme.ts`. This is the one shortcut functional-requirements.md §30
names as chrome.commands-appropriate; the rest (TOC toggle, raw/rendered
toggle, search) are in-page listeners in `viewer/index.ts`, scoped to an open
viewer tab, since a global binding for them wouldn't mean anything without one.

## Live-apply (F81) scope

`applyLiveSettings()` in `viewer/index.ts` only ever touches CSS custom
properties (`buildTypographyCssVars`, `src/utils/typography.ts`) plus a
handful of class/attribute toggles (content-width mode, sticky-table
headers, TOC visibility) — deliberately **not** a re-render. Markdown feature
toggles (F69), the highlight theme (F70), and code line-numbers/wrap are
_not_ live-applied; they take effect the next time a document loads. This
matches budget P10's own framing ("no re-parse") and Phase 2-B's exit
criteria, which scopes the live-apply guarantee to "typography/layout
settings," not the full settings surface.

## Known limitations / deviations (Phase 2-B)

- **Bundled fonts (F35) are not yet real font assets.** The spec calls for
  "~9 curated fonts locally, no CDN." `src/utils/fonts.ts` ships the
  mechanism, schema field (`FontFamilyKey`), and Settings UI in full, but
  the values are OS-available font-stack strings, not bundled `@font-face`
  binaries — sourcing/licensing real font files was out of reach for this
  session. Swapping in real fonts later is a change to `fonts.ts`'s two
  stack tables only, nothing schema- or UI-facing.
- **Settings → Shortcuts is a stub, per task 7's own section list** (only
  General/Appearance/Markdown/Navigation are populated this phase). The
  "user-recordable custom shortcuts" task-9 requirement is met instead
  inside the shortcut-help modal (`Ctrl+/`), which has its own per-row
  "Record" button — a later phase can still add a fuller Settings →
  Shortcuts page without changing where the shortcuts themselves live
  (`Settings.shortcuts`, `src/utils/shortcutDefinitions.ts`).
- **The lightbox wraps a broken `<img>` in its placeholder lazily**, from a
  single capture-phase `error` listener on the content container, not
  eagerly for every image at render time. The first implementation did the
  latter and measurably regressed Phase 2-A's P2 budget on its ~8,300-image
  stress fixture; image `error` events don't bubble but do fire during
  capture, so one delegated listener still catches all of them.
- **TOC population is deferred one task (`setTimeout(0)`) after the
  "rendered" status flag**, not part of the same synchronous render task —
  building a tree and calling `IntersectionObserver.observe()` per heading
  measurably added to the P1/P2/P4-measured critical path on the same
  stress fixture. The user-visible effect is imperceptible (the TOC
  populates a beat after content paints); `data-markora-status` still flips
  to `rendered` based on content, not TOC state.
- **P2 (<3s @5MB) remains a pre-existing flake on this development VM**
  under full sequential Playwright suite runs (already noted above as a
  Phase 2-A finding) — it passes reliably in isolation and in every smaller
  grouping tried. The two optimizations above measurably reduced, but did
  not eliminate, the worst-case margin under heavy sequential load; fully
  bulletproofing it would mean changing Phase 2-A's own single-`innerHTML`-
  write design (already deliberately chosen over incremental insertion —
  see this file's "Streaming variant" section), which is out of this
  phase's scope.
- **Playwright cannot exercise the "Render this page as Markdown" popup
  action end-to-end.** `activeTab` only grants access following a genuine
  user-gesture click on the extension's action icon; there is no CDP/
  Playwright API to fabricate that gesture, and opening the popup's HTML as
  a plain tab changes what `chrome.tabs.query({active:true})` resolves to
  (the popup tab itself, not the intended target tab), so it can't validate
  the real flow either. Coverage instead comes from unit tests
  (`src/popup/eligibility.test.ts`, `src/content/detect.test.ts`'s
  `looksLikeOnDemandCandidate` cases) plus the existing Playwright coverage
  of the content-script/handoff path the on-demand branch reuses. Manual
  verification in a real Chrome profile is still recommended before
  shipping this feature.

## Diagram/math hydration (Phase 3-A/3-B)

`src/viewer/markdown/plugins/fence.ts` and `mermaidContainer.ts`/`math.ts`
emit an inert placeholder (`.markora-diagram`/`.markora-math`, holding the
raw escaped source as plain text) at parse time; `src/viewer/index.ts`
hydrates every engine after the surrounding text is already painted
(`window.setTimeout(..., 0)` in `renderDocument`), each via its own
dynamically-imported adapter module so a document that never uses an engine
never pays its load cost:

- `src/viewer/mermaid/` — direct-DOM render, `securityLevel: 'strict'`, theme
  resync on light/dark toggle (ADR-0002).
- `src/viewer/math/` — KaTeX, no CSP relaxation needed.
- `src/viewer/diagrams/graphviz/` — a bundled WASM build
  (`@hpcc-js/wasm-graphviz`) laid out fully offline; the `.wasm` binary is
  embedded as base64 inside that package's own JS, so it ships as an
  ordinary same-origin code-split chunk, not a separate
  `web_accessible_resources` asset (see DEVELOPMENT.md's Phase 3-B section).
- `src/viewer/diagrams/plantuml/` — the **only** module in the product that
  ever makes a network request (security-privacy.md §6): off by default,
  fires only when `Settings.plantumlEnabled` is true, and sends nothing but
  the diagram source (compressed and re-encoded into the request URL by
  `encode.ts`, a hand-rolled implementation of plantuml.com's own
  text-encoding — no dependency, no document content in the request).

All four route their output SVG/HTML through
`src/viewer/sanitization/`'s `sanitizeDiagramSvg`/`sanitizeMathHtml` before
DOM insertion (no exceptions), and Mermaid/Graphviz both reuse the single
`createDiagramChrome()` component (`src/components/diagramChrome/`) for
fullscreen/zoom/pan/download rather than each growing its own — PlantUML
does too, on success; its off/unavailable states render the standard inline
notice instead.

## Module layout additions (Phase 4)

- `src/utils/folderScan.ts` — pure, DOM-free `scanFolder()` async generator
  (depth-first walk of a `FileSystemDirectoryHandle`, respecting the
  exclusion list) plus `matchesFileTypeFilter()`. Shared, unmodified, by
  both the folder browser (F19) and folder search (F20) — see
  DEVELOPMENT.md's Phase 4 entry for why this is main-thread-cooperative
  (batched yields) rather than a dedicated Worker.
- `src/utils/folderSearch.ts` — `searchFolder()`, layered on `folderScan.ts`;
  reuses `src/components/search/matches.ts`'s existing substring-range
  finder for both filename and content-snippet highlighting rather than a
  third implementation.
- `src/utils/quota.ts` — pure `shouldPromptUnlimitedStorage()` threshold math
  (ADR-0004), no `chrome.*` dependency.
- `src/utils/testFsFixtures.ts` — an in-memory fake
  `FileSystemDirectoryHandle`/`FileSystemFileHandle` builder shared by
  `folderScan.test.ts`, `folderSearch.test.ts`, and
  `components/fileBrowser/tree.test.ts` (not itself a `.test.ts` file — a
  plain helper module).
- `src/storage/recents.ts` — pure recents logic: `upsertRecent()` (F75
  duplicate detection + the ADR-0004 soft cap), `groupRecents()` (F59
  local/remote-by-domain grouping), `matchesRecentQuery()`.
- `src/storage/fsaaHandles.ts` — a second, separate IndexedDB database
  (`markora-fsaa-handles`, distinct from `handoff.ts`'s `markora-handoff`)
  storing `FileSystemDirectoryHandle`s by id: one well-known id
  (`LAST_FOLDER_HANDLE_ID`) for F80's silent-reconnect target, one per
  folder bookmark. Kept out of `chrome.storage.local` (can't serialize a
  handle, ADR-0004) and deliberately never touched by "Clear Cache" (F55) —
  clearing it would silently disconnect the user's folder.
- `src/storage/index.ts` extensions — `getRecents`/`addRecent`/
  `removeRecent`/`clearRecents`/`onRecentsChanged`,
  `getBookmarks`/`addBookmark`/`renameBookmark`/`removeBookmark`/
  `onBookmarksChanged`, `clearCache()` (exact scope: recents, bookmarks and
  their linked FSAA handles, and handoff records — never settings or the
  last-folder handle), `getStorageUsage()`.
- `src/viewer/autoRefresh.ts` — `startAutoRefresh()`, one function covering
  both ADR-0001 access flows behind a `RefreshSource` union (`fileUrl` diffs
  content via a non-cryptographic hash; `fileHandle` polls the reliable
  `lastModified`). Pauses while `document.hidden`, re-checks immediately on
  `visibilitychange` (F74).
- `src/components/fileBrowser/` — the folder-browser sidebar (F19-F21,
  F63-F65, F80): `tree.ts` (pure flat-scan → nested-tree, file-type
  filtering, empty-directory pruning) + `index.ts` (DOM: toolbar, bookmarks
  list, progressive tree/search-result rendering, the F80 reconnect banner).
  Reuses `src/components/sidebar/`'s `attachResizeHandle()` exactly as the
  TOC does (F73) — a second `.markora-sidebar__resize-handle` instance now
  exists per viewer page, which is why `e2e/phase2b.spec.ts`'s TOC-resize
  test had to be scoped to `.markora-toc .markora-sidebar__resize-handle`
  specifically.
- `src/background/index.ts` addition — the `permissions/requestUnlimitedStorage`
  message handler (ADR-0004 task 14): the one narrow, still-no-business-logic
  reason the background service worker grows beyond routing/messaging, per
  `03-architecture.md` §8's "permission helpers" framing. Only ever called
  from Settings → Maintenance after the user clicks a shown, disclosed
  prompt — never speculatively.
- `src/settings/index.ts` — Files (auto-refresh on/off + interval, default
  file-type filter, folder exclusion list) and Maintenance (storage usage,
  the quota-warning prompt, Clear Cache) sections are populated this phase,
  replacing their Phase 2-B stubs. Export/Language/Shortcuts remain stubs.
- `src/popup/index.ts` — the Recent tab is populated (grouped list, search,
  refresh, remove-one, clear-all); "Open folder" is un-stubbed (same
  focus-or-open-viewer pattern as "Open file" — the picker itself still only
  runs from inside the viewer, per ADR-0001 Flow B's user-activation
  constraint).

## Known limitations / deviations (Phase 4)

- **Bookmark-vs-currently-open-folder matching is by folder name only**, not
  `FileSystemHandle.isSameEntry()` identity. Two different folders that
  happen to share a name are indistinguishable to the bookmark star toggle.
  Documented rather than silently accepted as correct.
- **Drag-and-dropped files (F06) never auto-refresh.** A `DataTransfer`
  `File` carries no `FileSystemFileHandle`, so there's nothing to poll — F23
  applies only to documents opened via a picker, folder-browser click, or a
  `file://`/matched-remote handoff.
- **`unlimitedStorage`'s prompt lives only in Settings → Maintenance**, not
  the popup or viewer — matches where the spec already puts "current storage
  usage alongside these actions" (`01-functional-requirements.md` §32); a
  user who never opens the full settings page won't see the prompt until
  they do.
- **F80's cross-reload persistence is not Playwright-covered** — see
  DEVELOPMENT.md's Phase 4 entry for exactly why (real `FileSystemHandle`
  structured-clone can't be faked) and what manual verification remains
  required.

## Module layout additions (Phase 5)

- `src/viewer/annotations/` — the annotation data model and re-anchoring
  engine (ADR-0003), kept DOM-free and separately testable from the UI:
  - `model.ts` — `computeDocumentId()` (reuses the same local-path/normalized-
    remote-URL string `src/viewer/index.ts` already treats as a document's
    identity for recents/auto-refresh — no second identity scheme invented)
    and `computeContentFingerprint()`.
  - `similarity.ts` — a small local Levenshtein-based `textSimilarity()`, used
    only for the ~32-char prefix/suffix context strings (ADR-0003
    Consequences: "a local utility, not a dependency").
  - `reanchor.ts` — `reanchorAnnotation()`/`reanchorAll()`, implementing
    ADR-0003's algorithm exactly (fingerprint fast path → exact-text search →
    prefix/suffix similarity disambiguation → orphaning), chunked (8
    annotations per batch, yielding between batches) to meet budget **P9**.
  - `textOffsets.ts` — maps between a DOM `Range`/`Selection` and character
    offsets into `contentEl.textContent` (the coordinate space annotations are
    anchored in) and back — deliberately not DOM-range/offset-path anchoring
    (ADR-0003 "Alternatives considered").
  - `index.ts` — orchestrates the above against `src/storage/`'s annotation
    CRUD for the currently-open document: `createAnnotation`/
    `removeAnnotation`/`editAnnotationComment`/`loadAndReanchor`, plus
    `toExportableAnnotations()` — the resolved, active-only data shape Phases
    7-A/7-B's export modules will consume (this phase only defines and
    populates it).
- `src/storage/annotations.ts` — `annotationsStorageKey()`, the per-document
  sharding hash (ADR-0004: `markora.annotations.<fnv1a(documentId)>`, one key
  per document rather than one flat array for every document ever annotated).
- `src/storage/index.ts` extensions — `getAnnotationsForDocument`/
  `addAnnotation`/`updateAnnotation`/`deleteAnnotation`/`onAnnotationsChanged`
  (all scoped to one document's sharded key), plus the maintenance pair
  `getTotalAnnotationsCount()`/`deleteAllAnnotations()` — the **only** path
  that ever removes annotation data, deliberately separate from `clearCache()`
  (F55), which continues to leave `markora.annotations.*` untouched.
- `src/utils/hash.ts` — `fnv1aHex()`, a small non-cryptographic 32-bit hash
  shared by the two Phase 5 uses above (storage-key sharding, content
  fingerprinting) — no new dependency for either.
- `src/utils/textStats.ts` — `computeDocumentStats()`/`countWords()` (F17,
  F71): CJK script runs (Hiragana/Katakana, CJK Unified Ideographs, Hangul)
  count one character as one word; everything else counts whitespace-
  delimited runs, same as before.
- `src/components/annotations/` — `marks.ts` (pure-ish DOM: wraps resolved
  annotation ranges in `<mark>` elements via `Text.splitText`, the same
  never-re-serialize-HTML convention `src/components/search/` established;
  unwraps and re-applies from scratch on every call, so a deleted or
  re-anchored-elsewhere annotation's old mark never gets stranded) + `index.ts`
  (the selection-triggered creation toolbar, the comment composer/edit
  popover, and the panel list with its visible "Orphaned" section).
- `src/components/readingProgress/`, `src/components/documentStats/` — F16/
  F62 and F17/F71's UI: a fixed top progress bar (with the off-by-default,
  `prefers-reduced-motion`-suppressed celebration effect) and a bottom-corner
  stats panel that auto-hides near the end of a short document.
- **F51 redesigned sidebar** — the outline (TOC) and the new annotations
  panel occupy the same sidebar slot and share `Settings.tocSidebarWidth`
  (both panels' `setWidth()` are called from the same `onTocResize` handler,
  and both get their own `attachResizeHandle()` instance, same pattern as
  the TOC/file-browser pair already established in Phase 2-B/4). They are
  kept mutually exclusive from `src/viewer/index.ts`: opening one hides the
  other, via the toolbar's existing "Contents" button and the newly
  un-stubbed "Annotations" button — not via an in-panel tab strip (see Known
  limitations below for why). Neither `src/components/toc/` nor its own
  `--visible` visibility class needed to change at all to support this.
- `src/settings/index.ts` — Navigation gained the reading-progress
  celebration toggle and "Include annotations in exports" (default on, F27 ×
  F30-32; the setting is Phase 5's, the export rendering is Phases 7-A/7-B's);
  the two reading-progress/stats checkboxes are no longer disabled stubs.
  Maintenance gained "Delete all annotations" — same two-click-confirm
  pattern as Clear Cache, but its own separate action, showing the exact
  count that will be lost.

## Known limitations / deviations (Phase 5)

- **F51's "tabbed layout" is toolbar-driven, not an in-panel tab strip.**
  The outline and annotations panels are mutually exclusive and share one
  sidebar slot/width (functionally a tabbed surface), switched via the
  toolbar's "Contents"/"Annotations" buttons rather than a tab-strip control
  rendered inside the sidebar itself. This was a deliberate scope cut to
  avoid restructuring `src/components/toc/`'s existing, already
  e2e-asserted visibility mechanics (`.markora-toc--visible`, driven by
  `Settings.showToc`) for a purely cosmetic difference.
- **No manual re-attach for orphaned annotations.** ADR-0003 frames re-attach
  as one of two acceptable actions ("delete **or** ... manually re-attach") —
  this phase implements delete only. Orphaned annotations remain visible in
  their own panel section and are never silently dropped, per the spec's
  actual requirement; re-attach is a possible future enhancement, not a gap
  in what ADR-0003 requires.
- **P9's chunking is verified by total elapsed time only** (`reanchor.test.ts`
  asserts <500ms for 50 annotations against a ~5MB document), not by an
  instrumented per-batch-task-duration assertion — the same "chunk the work,
  measure the total" approach the codebase already uses for the streaming
  markdown renderer's P1/P2/P4 budgets.
- **Annotation marks are unwrapped and fully reapplied on every
  create/edit/delete/reload**, not diffed incrementally — simple and
  correct (see `applyAnnotationMarks`'s doc comment), and cheap enough at
  the sizes Phase 5 targets (a document's annotation count, not its length,
  is what's re-walked here); revisit only if a real document accumulates an
  unusually large annotation count.

> **Note on Phases 6–9:** this file's own "Module layout additions" /
> "Known limitations" sections were not extended for Phases 6 (presentation/
> mind-map), 7-A/7-B (export), 8 (i18n/RTL), or 9 (QA/security/perf) —
> that work is real (see `git log`, `TESTING.md`, and each phase's own
> commits) but its architecture notes, if written, live elsewhere or were
> never backfilled here. Not addressed in this Phase 10 session: retroactively
> reconstructing four phases' worth of design rationale from the finished
> code risks getting the _why_ wrong in a way that's worse than the gap
> being visible. Flagged here rather than silently left implicit.

## Module layout additions (Phase 10)

- `src/onboarding/` — first-run onboarding (F45), a standalone extension
  page/tab (`index.html` + `index.ts`), not part of the viewer/popup/
  settings trio. Opened once by `background/index.ts`'s
  `chrome.runtime.onInstalled` listener (`reason === 'install'` only — never
  on an update/reload). Declared as an explicit Vite build input in
  `vite.config.ts` (same reason `viewer.html` already is: it's reached only
  by a programmatic `chrome.tabs.create()`, never a manifest field crxjs
  scans for). Its "live diagram"/"live math" steps deliberately **reuse**
  the real pipeline instead of building a second one: they call the same
  `renderMarkdown()` (`src/viewer/markdown/`) the viewer uses to produce
  sanitized placeholder HTML, then hydrate it with the same
  `renderDiagramsIn`/`renderMathIn` adapters (`src/viewer/mermaid/`,
  `src/viewer/math/`), dynamically imported exactly like the viewer already
  does. The "open sample document" step hands the bundled demo document
  (imported via Vite's `?raw` suffix) to a real viewer tab through the
  existing `createHandoff()` mechanism (`src/storage/handoff.ts`) — the
  same single-use, TTL-swept path the content script's remote/local
  detection already uses, not a new one.
- `src/components/whatsNew/` — the "What's New" panel (F52): a small
  versioned `Record<version, summaryKey>` map, not a renderer for the full
  `CHANGELOG.md` (which stays developer-facing, untranslated release
  notes). Mounted from `src/popup/index.ts`'s bootstrap, shown at most once
  per version by comparing `chrome.runtime.getManifest().version` against
  `Settings.lastSeenWhatsNewVersion`. Never fires immediately after
  onboarding: onboarding's Finish step seeds `lastSeenWhatsNewVersion` to
  the version just installed in the same `setSettings()` call that sets
  `onboardingCompleted`.
- `src/settings/importExport.ts` — F42's validate/serialize logic, kept out
  of `src/storage/` on purpose: the actual write still goes through
  `setSettings()` (code-conventions.md §2), but the JSON-shape validation
  is UI-import-specific, not a storage-layer concern. `parseImportedSettings`
  walks `DEFAULT_SETTINGS` as the template of allowed top-level keys/shapes
  — it only ever copies out fields the template defines, so an imported
  file's own extra keys (`__proto__`, `constructor`, anything unrecognized)
  are structurally never even inspected, and each enum-typed field
  (`theme`, `contentWidthMode`, …) is additionally checked against its
  known value set.
- `src/utils/aboutContent.ts`, `src/utils/links.ts` — F57/F58's help/
  feedback links and "License status: Free" row, shared verbatim by the
  popup's Help tab and the settings page's new About section (rather than
  each building its own copy) — matches code-conventions.md §3's "popup
  stays quick-actions-only" by having the popup render the same compact
  building blocks, not a second, fuller implementation.
  `FEATURE_REQUEST_URL`/`REPORT_ISSUE_URL`/`RATE_EXTENSION_URL` in
  `links.ts` are deliberately empty placeholders (see that file's comment
  and "Known limitations" below) — the buttons render as disabled rather
  than pointing at an invented URL.
- `scripts/generate-attributions.mjs` → `src/assets/attributions.json` —
  F58's OSS attribution list, generated from `package.json`'s runtime
  `dependencies` (never devDependencies, which ship nothing) by reading
  each package's own `node_modules/<name>/package.json` for its real
  version/license/homepage. Committed output, regenerated manually
  whenever a dependency changes — same pattern as
  `scripts/generate-perf-fixtures.mjs`.
- `src/storage/schema.ts` additions — `Settings.onboardingCompleted:
boolean` and `Settings.lastSeenWhatsNewVersion: string`, both defaulting
  to their "never seen" values (`false`, `''`).
- `src/settings/index.ts` — two new sections, "Import & Export" (F42) and
  "About" (F57/F58), following the file's existing `build<X>Section()` +
  `SECTION_ORDER`/`SECTION_LABEL_KEYS` pattern exactly; no new pattern
  introduced.

## Known limitations / deviations (Phase 10)

- **Help/feedback/store-rating links have no real destination yet.** F57's
  three links (feature request, report issue, rate extension) and F58's
  attribution-list homepages that resolve correctly are real, but the three
  named `links.ts` constants are intentionally left as empty strings — this
  product has no public issue tracker or live Chrome Web Store listing to
  point to yet, and wiring an invented URL would be a real-looking link
  that goes nowhere (or somewhere unintended). The UI still renders all
  three as disabled buttons rather than omitting the feature. Filling in
  real URLs is a one-line change to `src/utils/links.ts` at actual
  publish time (`docs/specs/07-permissions-compliance.md` §4).
- **The bundled entry-chunk size finding from `TESTING.md`'s Phase 9 "P14
  finding" is unchanged and slightly larger** — adding `onboarding.html` as
  a second entry point that shares code with the viewer (markdown pipeline,
  storage, i18n) caused Rollup to factor the shared subset into its own
  chunk rather than duplicating it into both entries, which is correct
  multi-entry behavior, not a regression, but it doesn't shrink the
  already-flagged >500kB chunk either. Splitting that chunk further is
  still out of scope here per Phase 10 §2/§4's "additive polish, not
  architecture refactor" boundary — carried forward as a known limitation.
- **"What's New" content is a hand-maintained per-version summary, not a
  rendering of `CHANGELOG.md`.** Keeping the two separate means the panel's
  translated string set stays small and bounded per release; it does mean
  a release that bumps `CHANGELOG.md` without adding a
  `WHATS_NEW_SUMMARY_KEYS` entry in `src/components/whatsNew/index.ts`
  simply shows nothing that update — treated as an acceptable silent
  no-op (matching a patch release with nothing user-facing to call out)
  rather than a forced entry.
