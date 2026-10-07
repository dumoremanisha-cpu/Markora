# 01 — Functional Requirements

Source: `projectDetails.md` §5–49. Each section below is a behavioral requirement.
Feature IDs (F01…) cross-reference [`02-feature-matrix.md`](./02-feature-matrix.md).

## 1. Content detection & sources (F01–F07)

Must render Markdown from:

- Local files: `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`, `.txt` (when the `.txt`
  content is Markdown).
- Raw Markdown URLs: `raw.githubusercontent.com`, GitLab `-/raw/`, Bitbucket raw,
  Gitea raw, and arbitrary sites serving `.md`/`.markdown`/`.mdx`/`llms.txt`.
- Drag-and-drop of a supported file into the viewer (with a visible drop zone).
- "Open file" / "Open folder" launched from the extension popup or the viewer.

**Auto-render scope (v1):** automatic rendering on navigation covers the
Markdown path suffixes above, the curated raw-Git host patterns, and `.txt`
**only** for the exact filename `llms.txt`. Other Markdown-bearing `.txt`
files, and Markdown served with no recognizable path suffix, are supported
through drag-and-drop / "Open file" / the folder browser rather than passive
matching — see [`03-architecture.md`](./03-architecture.md) §5 and
[`../adr/0001-file-access-and-detection.md`](../adr/0001-file-access-and-detection.md)
§2 for why (permission minimization).

Must **not** auto-replace pages that already render their own Markdown — GitHub
repo/blob HTML pages, GitBook, ReadTheDocs. **In v1 this is unconditional:
there is no opt-in toggle to enable rendering on those sites** (descoped
2026-09-08 — it would require host permissions no other feature needs, to
replace pages that already display fine; see `03-architecture.md` §5 and the
F05 row in [`02-feature-matrix.md`](./02-feature-matrix.md)).

## 2. Markdown rendering (F08, F67, F68, F69)

Support, at minimum, GitHub-Flavored Markdown plus:

headings, paragraphs, bold/italic/strikethrough, inline code, fenced code blocks,
ordered/unordered/nested lists, task lists, blockquotes, tables, links, images,
horizontal rules, safely-sanitized inline HTML, footnotes, automatic heading
anchors/IDs, definition-list-style content where practical.

**Robustness requirement:** malformed Markdown must never crash the viewer or
produce a blank page — render best-effort output and continue.

**Custom containers (F67):** support fenced `:::type ... :::`-style container
blocks for at least `info`, `warning`/`caution`, `danger`, `details`
(collapsible/expandable), and `spoiler`, rendered as styled callout/box
components — distinct from, and in addition to, the GitHub-style alert syntax
in §39.

**Extended documentation-component compatibility (F68):** Markdown authored for
other documentation tools (e.g. Mintlify-style tabs/callout components) should
degrade gracefully — render the readable text content rather than showing raw
unrendered syntax or breaking the page. Full interactive fidelity is not
required; safe, readable fallback is.

**Per-feature Markdown toggles (F69):** each of the following is individually
enable/disable-able in Settings → Markdown, not just an all-or-nothing GFM
switch: tables, footnotes, task lists, definition lists, front matter parsing,
custom containers, "typographer" (smart quotes/dashes), and "line breaks"
(convert single newlines to `<br>`).

## 3. MDX / extended Markdown (F09)

`.mdx` must render safely:

1. Never execute embedded JavaScript or JSX component code.
2. Extract and render the Markdown-compatible portions.
3. Fall back gracefully (visible placeholder, not a crash) for JSX/import syntax
   that cannot be safely interpreted as Markdown.

Priority order: **safety > useful output > full fidelity**.

## 4. Syntax highlighting (F10, F70)

- Minimum language set: JavaScript, TypeScript, Python, Java, C, C++, C#, PHP, Go,
  Rust, Ruby, Kotlin, Swift, SQL, Bash, PowerShell, JSON, YAML, XML, HTML, CSS,
  SCSS, Markdown, Dockerfile, GraphQL, Terraform, Scala, Dart — 180+ languages
  total via the chosen highlighter library.
- Per-block: detected/labeled language, copy-to-clipboard button, optional line
  numbers, optional line wrapping, readable code typography.
- **Multiple selectable highlight themes (F70):** a curated set of syntax
  themes (target: ~14, including a GitHub-style one) the user can pick in
  Settings → Appearance — not just a single light/dark pair. Each theme should
  work sensibly in both the light and dark app theme.

## 5. Mermaid diagrams (F11, F79)

- Recognize fenced ```` ```mermaid ```` blocks, **and** the alternative
  `:::mermaid ... :::` container delimiter (F79) as an equivalent form.
- Support: flowcharts, sequence, class, state, ER diagrams, Gantt, pie, journey,
  mindmap (where the Mermaid version supports it).
- Inline render; fullscreen mode; zoom; pan; reset zoom; download rendered
  diagram as SVG or PNG; a broken diagram shows a clear inline error and never
  breaks the rest of the document.
- Diagrams automatically follow the active light/dark theme, including while
  in Presentation Mode (§22).
- No arbitrary JavaScript execution from diagram source ever.

## 6. PlantUML (F14)

- Off by default if rendering requires an external network server.
- Prefer local/client-side rendering when technically feasible.
- If remote rendering is offered: explicit settings toggle, clear disclosure that
  diagram text will be sent to that server, opt-in required before first use.
- Document continues functioning normally (with a clear fallback message) when
  PlantUML rendering is unavailable/disabled.

## 7. Graphviz / DOT (F13)

- Recognize `dot`/`graphviz` fenced blocks.
- Render client-side (no network dependency).
- Fullscreen, zoom, pan, and export/download where technically possible.
- Invalid DOT syntax shows a clear inline error without breaking the document.

## 8. Math — KaTeX (F12)

- Inline math: `$...$`. Display math: `$$...$$`.
- Support complex LaTeX notation to the extent KaTeX supports it.
- Readable math typography in both themes; renders correctly in print/export.
- Invalid LaTeX shows an inline error, not a crash.

## 9. Table of contents (F15, F60)

- Auto-generated from H1–H6.
- Collapsible sidebar; nested hierarchy; clickable headings; smooth scroll; a
  search/filter input inside the TOC sidebar itself for quickly locating a
  heading in long documents.
- Scroll-spy active-section highlighting kept in sync while scrolling.
- Mobile: converts to a drawer. Toggle via toolbar button and configurable
  keyboard shortcut.
- **Heading anchors (F60):** anchor-ID generation must work correctly for
  non-English/Unicode headings (not just ASCII slugs), and the viewer must
  support deep-linking — loading a document with a URL fragment
  (`#some-heading-id`) scrolls to and highlights that heading on load, the
  same way in-document TOC/anchor links do.

## 10. Reading progress (F16, F62)

- Visual indicator of scroll position and percentage complete.
- Updates smoothly (no jank) during scroll.
- User can enable/disable in settings.
- **Celebration effect (F62, optional):** an optional, purely-cosmetic
  animation when the user reaches 100% scroll completion. Independently
  toggleable in settings, and **off by default** for new installs (motion is
  also suppressed entirely when `prefers-reduced-motion` is set, per §29).

## 11. Document statistics (F17, F71)

- Word count, character count, estimated reading time — computed locally.
- Shown in a document-info panel/status bar (not intrusive by default); may
  auto-hide when scrolled near the bottom of a short document.
- **CJK-aware counting (F71):** word-count logic must count Chinese/Japanese/
  Korean text meaningfully (character-based counting for those scripts)
  instead of naively splitting on whitespace, which undercounts CJK text
  drastically.

## 12. Raw / rendered toggle (F18)

- Instant switch between rendered view and raw Markdown source.
- Toggle exposed in the toolbar and via a configurable keyboard shortcut.

## 13. File browser (F19, F63, F64, F65, F80)

- Let the user select a local folder (File System Access API where available).
- Browse subdirectories; list Markdown files; open a file; search/filter/sort the
  file list, including a **file-type filter** (F64) to narrow the list (e.g.
  Markdown only vs. all supported text types).
- Handles typical project layouts (README at root, `docs/`, `guides/`, nested
  folders).
- Never uploads folder contents anywhere.
- Surfaced as a persistent sidebar **inside the viewer** (not inside the popup —
  the popup stays limited to per-document actions and quick settings, see §31).
- **Persisted folder permission (F80):** once a folder is selected and File
  System Access permission granted, remember both the folder and the
  permission across sessions so the user isn't re-prompted every time they
  reopen the extension.
- **Active-file highlighting (F64):** visually highlight whichever file in the
  tree is currently open.
- **Folder exclusion list (F63):** let the user configure folder names to skip
  during scanning (e.g. `node_modules`, `.git`, `dist`) so large repositories
  don't get needlessly scanned.
- **Progressive scanning with cancellation (F65):** for large directory trees,
  render the folder tree incrementally as entries are discovered rather than
  blocking until the whole scan finishes, and provide a visible "Cancel" action
  to stop a long-running scan.

## 14. Folder search (F20)

- Full-text search across Markdown files in the open folder, plus filename
  search.
- Case-insensitive, with result highlighting and file-path display; quick-open
  from a result.
- Runs asynchronously; does not scan files that are out of scope (respects the
  folder exclusion list in §13); reuses the same progressive/cancellable scan
  as the file browser for large folders.

## 15. Folder bookmarks (F21)

- Add / remove / rename a bookmarked folder; reopen it later.
- Stored locally only.

## 16. Recent documents (F22)

- Local history: filename, source (path/URL), last-opened timestamp.
- Reopen, remove one entry, or clear all history.
- Never transmitted anywhere.
- Grouped by source type in the UI (e.g. a collapsible "Local Files" group,
  separate from remote-URL entries), and remote entries further grouped by
  domain (F75).
- **Duplicate detection (F75):** reopening the same document updates its
  existing recents entry (timestamp, position) instead of creating a
  duplicate row.
- **Capture scope constraint:** remote (non-local) documents are only added to
  recents when the user explicitly navigates to the URL (e.g. pastes/types it
  into the browser address bar) — not from passive background monitoring of
  all tab navigation. This keeps the required host/tab permissions minimal;
  see [`07-permissions-compliance.md`](./07-permissions-compliance.md).

## 17. Auto-refresh (F23, F74)

- Detect changes to the currently open local file where the browser APIs allow
  it (polling the file's last-modified timestamp via the File System Access
  API is an acceptable approach; target a default check interval on the order
  of ~2 seconds).
- On change: reload content, preserve scroll position and current
  theme/settings, update the rendered DOM without a jarring full reload.
- User-configurable: on/off, and the check interval (sub-setting).
- Applies to `.txt` files being viewed as Markdown, not just `.md`/`.markdown`.
- **Focus-aware polling (F74):** pause the polling loop while the document's
  tab/window isn't focused or visible, and resume immediately on refocus —
  avoids needless work when the tab is in the background.

## 18. Image viewer / lightbox (F24)

- Click an image to open a lightbox: fullscreen, zoom, pan, next/previous within
  a gallery of the document's images, image counter, close button, keyboard
  navigation, lazy loading for offscreen images.
- Relative image paths resolved where permissions allow; broken images show a
  clear placeholder instead of a broken-image icon with no context.
- The lightbox is disabled while Presentation Mode is active (clicking a slide
  image should not interrupt the presentation) — see §22.

## 19. External links (F25, F72)

- Visual indicator on external links; shown only on text-based links, **not**
  on links that wrap an image (F72) — avoids cluttering image-as-link content.
- Safe target behavior (no `window.opener` leakage; appropriate `rel`
  attributes).
- Optional confirmation step for links flagged as suspicious (setting-gated).
- Normal in-app Markdown links (anchors, relative links) must keep working.
- **Hover preview (F72, optional, off by default):** a small preview card on
  hover showing the link's URL/domain. If richer metadata (page title,
  description) is offered, it must be clearly disclosed as a network feature
  in Settings → Privacy and opt-in — fetching an arbitrary third-party page to
  scrape metadata on hover is exactly the kind of network access this product
  treats as sensitive (same category as PlantUML remote rendering, see
  [`04-security-privacy.md`](./04-security-privacy.md)). The safe default is
  showing only information already available locally (the URL itself), not a
  silent background fetch.

## 20. Sticky table headers (F26)

- Header row remains visible while a long table scrolls vertically.
- Table remains horizontally scrollable without layout distortion; responsive at
  narrow widths.

## 21. Annotations (F27)

- Highlight text, underline text, attach a comment/note to a selection.
- View, edit, delete existing annotations.
- Persist locally, keyed by: document identity, selected text, approximate
  location (for re-anchoring after minor edits), annotation type, timestamp.
- Never modify the source Markdown file unless the user explicitly triggers an
  "apply to document" action.
- Degrade gracefully if the underlying document has changed enough that an
  annotation can no longer be precisely re-anchored (show it as "orphaned"
  rather than silently dropping or misplacing it).
- **Annotations carry into exports (F27 × F30–F32).** Highlights, underlines
  and comments the user has made are reproduced in HTML export, print/PDF
  output, and — best-effort — DOCX, per the export table in §24. This is a
  verified parity capability (see
  [`08-glossary-references.md`](./08-glossary-references.md) §3: "Annotations
  … persist, appear in print/exports") and was previously missing from this
  spec. An **"Include annotations in exports"** setting (default **on**)
  governs all three formats, so a user can produce a clean, unannotated copy
  without deleting their annotations. Orphaned annotations are never exported.

## 22. Presentation mode (F28, F56, F76)

- **Slide-splitting strategy (F76):** support three ways to split a document
  into slides — (1) `---`-delimited sections, (2) one slide per H1 heading, or
  (3) one slide per H2 heading. Auto-detect the best strategy for a given
  document: prefer `---` delimiters if present; otherwise use headings, which
  requires **at least 3** H1-or-H2 headings to be considered viable (otherwise
  show a clear message that the document doesn't have enough structure to
  present).
- Navigation: next/previous, arrow keys, PageUp/PageDown, Space, Escape to
  exit, **Home/End** to jump to the first/last slide, and **number keys 1–9**
  to jump directly to a slide.
- Fullscreen (`F` or `F11`), progress indicator, slide counter, touch
  navigation (swipe left/right; tap screen edges vs. center to navigate vs.
  toggle chrome), a **keyboard-help overlay** (`?`), optional auto-play
  (default toggle key `P`, advancing every ~5 seconds by default, pausing at
  the final slide — both the toggle key and interval should be
  reasonable-default and not hard-coded as unchangeable), selectable
  presentation themes, speaker notes where the source markup supports them
  (e.g., HTML comments as notes).
- A visible scroll indicator (e.g. a subtle bounce animation) when a slide's
  content overflows the viewport.
- The image lightbox is disabled while presenting (§18); Mermaid diagrams
  render in slides with automatic light/dark theme switching (§5); KaTeX math
  renders normally in slides.
- Always returns cleanly to normal document view.
- **Style customization** (settings, per F56): background color, text color,
  heading color, accent color (used for the progress bar, links, inline code,
  and blockquotes), a font selector for slide content, a background-image URL,
  and an image-opacity control. Each field defaults to "theme default" (empty =
  inherit from the active light/dark theme) rather than forcing a value. A
  single "Reset presentation settings" action restores all of the above to
  theme defaults.

## 23. Mind map mode (F29)

- Generate an interactive hierarchy from the document's heading structure only
  (no external input).
- Zoom, pan, collapse/expand nodes, fullscreen.
- Export as SVG, PNG, and JPEG where technically practical.

## 24. Export (F30–F33)

| Format | Must preserve |
|---|---|
| **HTML** (standalone file) | Typography, headings, tables, code + syntax highlighting, images (embedded or referenced), rendered Mermaid diagrams, rendered KaTeX, GitHub alerts, custom containers, basic styling; optional embedded TOC |
| **DOCX** | Headings (H1–H6), bold/italic/strikethrough, inline code, code blocks with syntax highlighting, tables with alignment, ordered/unordered/task lists, blockquotes, links, footnotes, horizontal rules, images, basic formatting |
| **PDF** (via browser print) | Print-specific CSS that hides app chrome/controls, correct page breaks, tables not cut incorrectly, code blocks and diagrams and math preserved, sensible margins |
| **Images** | Mermaid/Graphviz diagrams and mind maps exportable as SVG/PNG/JPEG |

**Annotations in exports (setting-gated, default on — see §21):**

| Format | Annotation fidelity required |
|---|---|
| **HTML** | Full: highlight/underline styling reproduced inline; comments rendered as a numbered marker at the anchor plus a comment list (footer section or margin block). No JavaScript required to view them |
| **PDF/print** | Same as HTML — the print stylesheet keeps highlight/underline styling (with a print-safe palette) and renders comments as numbered endnotes rather than hover-only UI |
| **DOCX** | Best-effort: highlights map to Word text shading/highlight runs, underlines to underline runs, and comments to **native Word comments** where the OOXML builder supports them, falling back to numbered endnotes if not. Failure to place a comment must degrade to an endnote, never to silent loss |

**HTML export technical requirements:**
- Images embedded as base64 data URLs (cap per-image size, e.g. ~5 MB, with a
  clear fallback — link out instead of embedding — beyond that) so the file is
  fully portable/offline.
- All CSS inlined into the file (no external stylesheet dependency); apply
  reasonable CSS-size reduction (only ship the styles actually used by the
  document's content) rather than dumping the entire app stylesheet.
- Respect the current code line-wrap setting and light/dark styling choice.

**DOCX export — math handling (tiered, since Word has no native LaTeX):**
1. Convert LaTeX to Word's native OMML equation format where the construct is
   simple enough to map directly (stays editable in Word).
2. For complex constructs OMML can't represent, fall back to a high-resolution
   rendered image (e.g. ~2x scale) of the KaTeX output.
3. As a last-resort fallback, render the original LaTeX source as italic text
   rather than dropping it.

Image sources for DOCX export must support local files, http(s) URLs, data
URLs, and blob URLs — all embedded into the resulting document. Long
conversions should show real progress feedback (parsing → conversion → image
processing → file generation → download) rather than an indefinite spinner.

**PDF/print export technical requirements:**
- Automatically force-load any lazy-loaded images before the print dialog
  opens, so nothing renders as blank in the output.
- Sensible default page setup (e.g. A4 with ~2.5cm top/bottom and ~2cm side
  margins) via the print stylesheet.
- Diagrams render as crisp vector/SVG output where practical, not blurry
  rasterized screenshots.

## 25. Themes (F34)

- Light, Dark, System — applied consistently across Markdown content, code
  blocks, Mermaid, KaTeX, TOC, all chrome UI, presentation mode, and mind map.
- Persisted locally.

## 26. Typography & layout settings (F35, F73, F81)

Configurable: font family (multiple high-quality choices, target ~9 including
at least one serif option), font size (a broad range, e.g. 12–24px), line
height (e.g. 1.0–2.5), content width (e.g. 600–1200px, plus a centered vs.
full-width layout toggle), code font, heading scale, sidebar widths,
TOC/file-browser visibility, progress bar visibility, stats visibility, code
line wrapping, sticky tables on/off. All persisted.

- **Drag-to-resize sidebars (F73):** TOC and file-browser sidebar widths are
  also adjustable by dragging their edge, in addition to any numeric setting.
- **Live-apply (F81):** language, font, and other appearance changes apply
  immediately to the open document without requiring a page reload.
- A general **"Reset to defaults"** action is available for these settings (in
  addition to the presentation-specific reset in §22).

## 27. RTL support (F36)

- Automatic per-block direction detection where practical, with manual override.
- Correct rendering (alignment, list markers, table column order where
  applicable, code block direction, TOC, presentation mode, print/export,
  mind-map layout where practical) for RTL scripts (Arabic, Hebrew, Persian,
  Urdu).
- Never force the *entire* document to RTL because of a single RTL paragraph —
  direction is applied at the appropriate block/paragraph granularity.

## 28. Internationalization (F37)

- No hardcoded user-facing strings — all UI text goes through an i18n key
  system from the start. **This is a Phase-1 obligation, not a later
  translation task:** the key system, the `t()` accessor and the English
  catalog ship with the first UI code and are enforced by a lint rule, per
  [`../adr/0007-i18n-architecture.md`](../adr/0007-i18n-architecture.md).
- Mechanism: a **hybrid** — `_locales`/`chrome.i18n` for manifest/store-facing
  strings (the only thing that can localize them), a bundled runtime catalog
  for all in-app UI (the only thing that can switch language live). See
  ADR-0007.
- Initial locale set should include (at minimum, matching the public parity
  target's 19 languages — see
  [`08-glossary-references.md`](./08-glossary-references.md)): English, Spanish,
  French, German, Italian, Portuguese (Brazil), Dutch, Polish, Russian, Chinese
  (Simplified & Traditional), Japanese, Korean, Vietnamese, Indonesian, Arabic,
  Persian, Urdu, Hebrew.
- Architecture must make adding a new locale a matter of adding a translation
  file, not code changes.
- The language setting must include an **"Auto"** option that follows the
  browser/system locale, in addition to the explicit language list, exposed in
  both the popup quick-settings and the full options page (see §31, §32).
- Translation coverage extends to **settings-panel content**, including the
  names and descriptions of individual Markdown/diagram feature toggles (§2,
  §32) — not just top-level navigation/menu chrome.

## 29. Accessibility (F38)

Keyboard-navigable UI, visible focus states, ARIA labels/roles, semantic HTML,
screen-reader compatibility, sufficient color contrast in both themes, respects
`prefers-reduced-motion`, scalable typography, accessible dialogs/menus (focus
trap, `Esc` to close, labeled controls). No feature may be mouse-only.

## 30. Keyboard shortcuts (F39)

Defaults (each configurable where Chrome's APIs allow, e.g. `chrome.commands` for
global ones, in-page listeners for the rest):

| Shortcut | Action |
|---|---|
| `Alt+Shift+D` (same on macOS) | Toggle theme — the one `chrome.commands` global; **not** `Ctrl/Cmd+Shift+D`, which Chrome reserves for "Bookmark all tabs" and therefore leaves silently unassigned |
| `Ctrl/Cmd+Shift+L` | Toggle TOC |
| `Ctrl/Cmd+Shift+B` | Toggle file browser |
| `Ctrl/Cmd+Shift+M` | Toggle raw/rendered view |
| `Ctrl/Cmd+F` | Search document |
| `Esc` | Close fullscreen/dialog |
| `←` / `→` | Previous/next slide or image |

See §22 for the extended set of Presentation Mode-specific shortcuts
(Home/End, 1–9, F/F11, `?`, `P`).

Must avoid clobbering critical browser shortcuts. A shortcut help modal (e.g.
`Ctrl+/`) is required. User-recordable custom shortcuts are in scope (parity
item).

## 31. Extension popup (F40, F54, F57, F58)

Lightweight only — the full application must never be embedded in the popup.
Structured as tabs:

- **Setup** (shown when the file-URL permission isn't granted yet): explains
  why it's needed and gives step-by-step instructions to enable "Allow access
  to file URLs" from `chrome://extensions`, plus a button that opens extension
  settings directly.
- **Recent documents**: see §16 (search box, grouped list, refresh, clear all).
- **Settings** (quick settings, distinct from the full options page): a master
  **extension enabled/disabled toggle** (F54), a **theme control**
  (light/dark/system — F34), a quick **language** selector (with an "Auto"
  option that follows the browser/system locale — see §28), a link into the
  full options page, and a **Clear Cache** maintenance action (F55).
- **Open actions** (present on the Setup/Recent surface, not a tab of their
  own): **"Open file"** and **"Open folder"** launchers. Because File System
  Access pickers are unreliable when invoked from an extension popup, these
  buttons focus (or open) the viewer page and trigger the picker there — see
  [`../adr/0001-file-access-and-detection.md`](../adr/0001-file-access-and-detection.md)
  Flow B. The popup is the *entry point*; the viewer does the work.
- **"Render this page as Markdown"** — the on-demand fallback for Markdown
  served with no recognizable path suffix (the case §1's auto-render scope
  deliberately excludes). Shown for the current tab; on click it uses
  `activeTab` + `scripting` to run the normal detection/handoff path on that
  one tab. If the page is not a plain-text document, it declines with a
  clear message rather than rendering the text of an HTML page as Markdown.
  This is the *only* way arbitrary content-type Markdown is rendered, and it
  is always user-initiated — see
  [`03-architecture.md`](./03-architecture.md) §5 and
  [`07-permissions-compliance.md`](./07-permissions-compliance.md) §2.
- **Help/About**: version info, links to "What's New" (F52), and a combined
  **License panel** (F58): open-source library/license attribution, plus a
  **"License status: Free"** line. v1 ships as fully free with no
  payment/activation logic behind this — it exists purely so the UI (and the
  `licenseStatus` shape reserved in local settings, see
  [`03-architecture.md`](./03-architecture.md) §1) doesn't need reworking if a
  paid tier is ever added later. It must never claim or check a license against
  any server in v1.

Folder *browsing* and bookmark *management* live in the viewer sidebar, not the
popup — see §13. The popup only launches them.

## 32. Settings page (F41)

Full options page, covering (see `projectDetails.md` §40 for the exact control
list per area — names below are capability groupings, not a prescribed layout):

- **General**: extension enabled/disabled (mirrors the popup toggle, F54),
  interface language (including "Auto").
- **Appearance**: theme, font, font size, line height, content width.
- **Markdown**: GitHub-style rendering, HTML rendering, raw mode, code line
  numbers.
- **Navigation**: TOC, progress bar, sticky headers.
- **Diagrams** (Mermaid/Graphviz always on; PlantUML/Presentation have their
  own dedicated settings surfaces): Mermaid, PlantUML (opt-in network
  disclosure per [`04-security-privacy.md`](./04-security-privacy.md)),
  Graphviz, and the presentation style customization from §22 (F56).
- **Files**: auto-refresh, recent documents, folder behavior.
- **Export**: HTML, DOCX, print/PDF.
- **Language**: interface language, text direction override.
- **Privacy**: explanation of local-only processing, the PlantUML
  network-rendering opt-in.
- **Maintenance**: **Clear Cache** (F55) and any other housekeeping actions.

  **Clear Cache — exact scope (defined 2026-09-08).** The action clears
  *derived and historical* data, never configuration and never user-authored
  content, unless the user explicitly opts into the latter:

  | Key / store (per [`../adr/0004-storage-schema-and-quota.md`](../adr/0004-storage-schema-and-quota.md)) | Cleared by "Clear Cache"? |
  |---|---|
  | `markora.recents` | Yes |
  | Folder-scan / search index caches | Yes |
  | Handoff records (ADR-0006, transient) | Yes |
  | `markora.bookmarks` | Yes |
  | `markora.settings`, `markora.schemaVersion` | **No** — never touched |
  | Stored File System Access handles (IndexedDB) | **No** — clearing them would silently disconnect the user's folder |
  | `markora.annotations.*` | **No by default.** Annotations are user-authored content, not cache. They are removable only through a separate, clearly-labelled "Delete all annotations" action that requires an explicit confirmation dialog stating how many annotations will be lost |

  The Maintenance section shows current storage usage alongside these actions
  (the same `getBytesInUse()` figure the quota-warning path uses).
- **Import/Export**: settings import/export as JSON (F42).
- **Shortcuts**: view and re-record keyboard shortcuts (§30).

All settings persist via `chrome.storage.local`.

## 33. Drag and drop (F06)

Drop zone accepting `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`, `.txt`, with
clear visual affordance while dragging over the window.

## 34. Toolbar (F48, F57)

Actions: back, forward, TOC toggle, file-browser toggle, search, raw/rendered
toggle, theme, presentation mode, mind map, annotations, export, settings.
Becomes compact/sticky on scroll; must not feel cluttered.

A secondary "more actions" menu (or the options page) should also expose
lightweight **help & feedback links** (F57): a feature-request link, a
report-an-issue link, and a rate-the-extension link (to the Chrome Web Store
listing). These are plain outbound navigations the user triggers explicitly —
no background telemetry is involved.

## 35. In-document search (F49)

Query input, live match count, next/previous navigation, highlighted matches,
keyboard navigation (Enter/Shift+Enter or arrows), optional case sensitivity.
Operates on the rendered document content.

## 36. Responsive design (F50)

Works from desktop down to tablet-sized viewports: sidebars collapse to
drawers, TOC becomes a drawer, toolbar simplifies, typography stays readable,
diagrams/tables remain usable via horizontal scroll rather than being clipped.

## 37. First-run experience & demo (F45, F46)

On first install, an onboarding flow: Welcome → explain local/private
processing → explain the local-file permission → open a bundled sample
document → show a Mermaid example → show a math example → show keyboard
shortcuts → Finish. No account creation ever required.

A bundled demo Markdown document must exercise: headings/TOC, a table, code
blocks, Mermaid, Graphviz, PlantUML, KaTeX, images, links, task lists,
blockquotes, annotations-friendly content, and presentation-style sections —
so the whole feature set is reachable from one file.

## 38. Front matter display (F43, parity)

When a document has YAML front matter (title/author/date/etc.), show it as a
clean info card at the top of the rendered document rather than as raw YAML
text.

## 39. GitHub-style alerts (F44, parity)

Support all five canonical GFM alert types — `> [!NOTE]`, `> [!TIP]`,
`> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` — rendered as styled callouts
with distinct icons/colors per type, with titles localized via the i18n system
(with a setting to disable localized titles if the user prefers the literal
keyword). Distinct from, but visually consistent with, the custom containers in
§2.

## 40. Error handling & notifications (F78, cross-cutting)

No blank screens on failure. Every one of the following must produce a
human-readable, in-context error with a recovery action where one exists:
invalid Markdown, invalid Mermaid, invalid PlantUML, invalid Graphviz, invalid
LaTeX, unsupported MDX construct, inaccessible local file, unavailable image,
unsupported/failed export, permission errors (e.g., file-URL access not
granted).

**Unified notification system (F78):** a single, consistent in-app
toast/notification component handles all transient user feedback — at minimum
four types (success, error, warning, info) — used for things like "settings
saved," "export complete," "folder scan cancelled," and non-fatal error
surfacing, rather than each feature inventing its own ad hoc feedback UI.

**Explicitly not implemented (privacy stance):** this product does not collect
uninstall-time feedback (e.g. via `chrome.runtime.setUninstallURL` pointing at
a survey) — that is a deliberate divergence from the parity target, to keep
the zero-data-collection guarantee in
[`04-security-privacy.md`](./04-security-privacy.md) absolute.
