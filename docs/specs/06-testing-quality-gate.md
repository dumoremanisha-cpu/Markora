# 06 — Performance, Testing & Quality Gate

Source: `projectDetails.md` §37, §38, §50, §55, §56.

## 1. Performance requirements

Must remain fast for real-world technical documentation, specifically:

- Large README files, long documentation pages, hundreds of headings, many code
  blocks, many images, multiple diagrams on one page, large tables.
- Target test sizes: **~1 MB** and **~5 MB** Markdown files, documents with
  hundreds of headings, and documents with many images/code blocks.

Required techniques:

- Lazy image loading.
- Incremental/deferred rendering for expensive work (diagrams, math) so it
  doesn't block first paint of the surrounding text.
- Debounced in-document and folder search.
- Asynchronous folder scanning (never blocks the UI thread).
- Efficient, targeted DOM updates — avoid full-document re-render for a single
  setting change (e.g. changing font size should not re-parse Markdown).
- Cached parsed content where reasonable (e.g. don't re-run the full pipeline on
  every scroll-spy tick).

## 1a. Performance thresholds (added 2026-09-08 — these are the numbers)

"Fast" and "responsive" are not testable. Every performance claim in this
spec, in the phase plan's exit criteria, and in ADR-0003's re-anchoring
expectation resolves to the table below. Measurements are taken on a
mid-range development machine (not a high-end one), in a release build, with
the extension freshly loaded — the numbers are budgets, not aspirations, and
a phase that misses one has failed its exit criteria.

| # | Metric | Budget | Where verified |
|---|---|---|---|
| P1 | **First paint of document text**, 1 MB Markdown (from viewer load to the first rendered text visible; deferred diagram/math excluded) | **< 1 s** | Phases 2-A, 9 |
| P2 | **First paint of document text**, 5 MB Markdown | **< 3 s** | Phases 2-A, 9 |
| P3 | **Main-thread long tasks after first paint**, during scroll/interaction | **no task > 50 ms** | Phases 2-B, 3-A, 9 |
| P4 | **Main-thread long tasks during initial load/parse** (chunk the work if needed) | **no single task > 500 ms** | Phases 2-A, 9 |
| P5 | **Diagram/math work never blocks surrounding text** — text paint time on a document with 10 Mermaid diagrams + 50 math expressions vs. the same document with them removed | **regression < 20 %** against the no-diagram baseline | Phase 3-A, 9 |
| P6 | **In-document search** (F49): time from keystroke-debounce fire to highlighted results, 1 MB document | **< 150 ms** | Phases 2-B, 9 |
| P7 | **Folder scan** (F19/F65) of a 1,000-file tree | **no main-thread block > 200 ms**; first entries visible **< 500 ms**; Cancel takes effect **< 100 ms** | Phase 4, 9 |
| P8 | **Folder full-text search** (F20) across a 1,000-file tree | runs off the main thread; UI stays interactive throughout (P3 still holds) | Phase 4, 9 |
| P9 | **Annotation re-anchoring** (F27, ADR-0003): 50 annotations against a 5 MB document, on load | **< 500 ms total**, and no single task > 50 ms (chunk if needed) | Phase 5, 9 |
| P10 | **Live-apply of an appearance setting** (F81 — font, size, width, theme): time to visibly applied, with **no Markdown re-parse** | **< 100 ms** | Phases 2-B, 8, 9 |
| P11 | **Language switch** (F37): time to fully re-rendered UI in the new locale | **< 300 ms** including catalog load | Phases 8, 9 |
| P12 | **Export**: HTML export of a 1 MB document with 20 images | completes **< 5 s** with staged progress feedback throughout (no unresponsive UI) | Phases 7-A, 9 |
| P13 | **Memory hygiene**: open and close 20 documents in sequence | heap returns to within **±10 %** of the post-first-document baseline after GC (no unbounded growth) | Phase 9 |
| P14 | **Package size** — *tracked, not gated*: record total unpacked `dist/` size each phase | a build exceeding **5 MB unpacked** triggers a lazy-loading review (locales, highlight themes, fonts, Graphviz WASM) before the phase closes | every phase; reported in Phase 9 |

Notes:
- P1/P2 measure *text* paint deliberately: deferring diagrams and math is the
  required technique above, so counting them would reward the wrong thing.
  P5 is what keeps that deferral honest.
- Anything measured must be recorded with the fixture used, so a later phase
  can re-run the identical measurement rather than re-inventing the test.

## 2. Error handling requirements

Never a blank screen. Every failure mode below must produce a clear,
human-readable, in-context message, with a recovery action offered where one
exists (retry, open settings, disable the feature, etc.):

invalid Markdown, invalid Mermaid, invalid PlantUML, invalid Graphviz, invalid
LaTeX/KaTeX, unsupported MDX construct, inaccessible local file, unavailable
image, unsupported/failed export, permission errors (e.g. file-URL access not
granted).

## 3. Test plan by area

> **Coverage note (2026-09-08):** this section originally mirrored
> `projectDetails.md` §50 and therefore only covered the pre-F51 feature set.
> It has been extended to the full F01–F81 range in
> [`02-feature-matrix.md`](./02-feature-matrix.md). Each area below names the
> feature IDs it gates, so the matrix, this test plan and §5's ship checklist
> can be reconciled row by row.

### Markdown (F08, F43, F44, F60, F67, F68, F69)
Headings, all list types (ordered/unordered/nested/task), tables, code
(fenced + inline), links, images, inline HTML, malformed/broken Markdown (must
not crash). Plus:

- **Custom containers (F67):** `:::info`, `:::warning`/`:::caution`,
  `:::danger`, `:::details` (expand/collapse actually works), `:::spoiler`;
  unterminated and nested containers degrade without breaking the document.
- **GitHub alerts (F44):** all five types (`NOTE`/`TIP`/`IMPORTANT`/
  `WARNING`/`CAUTION`) render with distinct styling; titles come from the
  i18n catalog; the "show literal keyword" setting works.
- **Front matter (F43):** YAML front matter renders as an info card, never
  as raw YAML or as executable content; malformed YAML degrades to a plain
  notice rather than dumping raw text or crashing.
- **Per-feature Markdown toggles (F69):** each of tables, footnotes, task
  lists, definition lists, front matter, containers, typographer and line
  breaks toggles independently; with a feature off, its syntax renders as
  plain text rather than half-processed markup; toggles persist and
  re-render without a reload.
- **Unicode anchors & deep-linking (F60):** heading IDs are correct and
  unique for non-ASCII headings (CJK, Cyrillic, Arabic, accented Latin,
  emoji-bearing) and for duplicate heading text; loading a document with a
  `#fragment` scrolls to and highlights that heading; in-document anchor
  links and TOC clicks reach the same targets.

### MDX (F09, F68)
Every row of ADR-0008's threat-case table, plus real-world `.mdx` samples
containing imports, capitalized components with children, self-closing
components, and brace expressions. Assert: no script execution, no network
request, component inner text preserved, placeholder chips shown for
self-closing components, code fences containing `import` left untouched, and
malformed JSX falling back to the source-as-code-block notice instead of a
blank page. `.md` files must **not** be run through the MDX transform.

### Detection & source handling (F01–F07)
- Auto-render fires for: `file://` Markdown extensions (with file access
  enabled), curated raw-Git host URLs, any path ending in a Markdown suffix,
  and exactly `llms.txt`.
- Auto-render does **not** fire for: any other `.txt` URL, and — as a
  negative-only requirement with **no opt-in toggle in v1** (F05, per
  [`../adr/0001-file-access-and-detection.md`](../adr/0001-file-access-and-detection.md)
  §3) — GitHub repo/blob pages, GitBook, and Read the Docs. A regression
  test asserts those URL shapes never match, and that no settings surface
  offers to enable them.
- Handoff correctness (ADR-0006): the viewer renders handed-off text without
  re-fetching the source URL; `#fragment` survives the handoff; Back returns
  to the previous page rather than re-triggering the redirect; the handoff
  record is deleted after read.
- Drag-and-drop (F06) and the picker flows (F07) load the same content
  through the same pipeline.
- The on-demand "Render this page as Markdown" action (F04, `activeTab`)
  works on a plain-text Markdown page with no recognizable suffix, and
  declines with a clear message on an ordinary HTML page.

### Security (cross-cutting)
XSS attempts via text/HTML/attributes, malicious HTML fragments, malicious SVG,
`javascript:`/`data:` URLs, embedded `<script>` tags, unsafe Mermaid content
attempting sandbox escape. All must render inert. Also: the MDX threat-case
table above; sanitization of annotation comment text; sanitization of speaker
notes sourced from HTML comments; validation of imported settings JSON (F42);
and the exported-HTML re-test (an export is a standalone artefact a user may
share, so it faces the same test set as the live viewer).

### Diagrams (F11–F14, F79)
Valid Mermaid (all supported diagram types), invalid Mermaid (clear error, no
crash), the `:::mermaid` container form (F79), Graphviz valid/invalid,
PlantUML with rendering enabled/disabled (including the disclosure gate, the
server-unreachable fallback, and zero network calls while off), large
diagrams (perf), diagram chrome (fullscreen/zoom/pan/reset/download), and
theme-change re-render.

### Math (F12)
Inline `$...$`, display `$$...$$`, complex/nested formulas, invalid LaTeX
(clear error in the project's own inline-error styling, no crash), correct
rendering in both themes, and in print/export output.

### Files (F02, F19–F23, F55, F59, F63–F65, F74, F75, F80)
Local Markdown, remote Markdown (all supported hosts), inaccessible files
(permission not granted), large files (1 MB, 5 MB), UTF-8 content, general
Unicode, RTL-script content. Plus:

- **Folder browser (F19, F63–F65):** open a folder, browse nested
  directories, open files, active-file highlighting, file-type filter,
  exclusion list actually skips `node_modules`/`.git`/`dist`, progressive
  rendering during a large scan, and Cancel genuinely stopping it
  (thresholds P7).
- **Folder search (F20):** filename and content matches, case-insensitivity,
  result highlighting, path display, quick-open; respects the exclusion
  list; stays off the main thread (P8).
- **Bookmarks (F21):** add/remove/rename/reopen; persist across restart.
- **Recents (F22, F59, F75):** grouping by source type and by domain,
  duplicate detection (reopen updates rather than appends), remove-one and
  clear-all, and the capture-scope rule — remote entries only for
  address-bar-entered navigations, per ADR-0006 §6, including its documented
  false-positive/negative cases.
- **Auto-refresh (F23, F74):** external edit reflected within one polling
  interval for **both** access flows; scroll position and theme preserved;
  polling pauses when the tab is hidden and resumes on focus; applies to
  `.txt` opened as Markdown.
- **Persisted folder permission (F80):** handle survives a normal reload;
  when the grant is lost, the "Reconnect folder" affordance appears and
  works — never a silent failure or a forced re-pick.
- **Clear Cache (F55):** clears exactly the key set in
  [`01-functional-requirements.md`](./01-functional-requirements.md) §32 —
  a regression test asserts settings, FSAA handles and
  `markora.annotations.*` are still present afterwards.

### Annotations (F27, F51)
- Create/edit/delete highlight, underline and comment; persistence across
  reload and across browser restart.
- **Re-anchoring (ADR-0003), one test per branch:** unchanged document
  (fingerprint fast path), minor edit above the anchor (single unambiguous
  quote match), repeated identical quote resolved by prefix/suffix context,
  ambiguous near-identical context → **orphaned**, quote deleted →
  **orphaned**. Orphaned annotations must remain **visible** in their own
  section, never silently dropped and never mis-placed.
- Comment text containing HTML-like input is sanitized before display.
- No code path writes annotation data into the source file or outside
  `chrome.storage.local`.
- Tabbed outline+annotations sidebar (F51): both tabs work, state persists.
- Performance budget P9.

### Settings, persistence & maintenance (F35, F41, F42, F69, F70, F81)
- Every setting persists across reload and browser restart, and defaults are
  sane on a fresh profile.
- **Live-apply (F81):** appearance, typography, layout, Markdown-toggle and
  language changes apply without a reload, **including in a second already-
  open viewer tab** (budget P10) — and never trigger a Markdown re-parse for
  a pure appearance change.
- **Import/export (F42):** export → re-import produces byte-identical
  settings; a malformed, truncated, or hostile settings file is rejected
  safely with a clear message and cannot corrupt stored settings or inject
  unexpected values.
- Highlight-theme selection (F70) and per-feature Markdown toggles (F69)
  round-trip between the options page, the popup quick-settings and storage.
- Storage-quota warning path (ADR-0004) triggers at the documented threshold
  and only requests `unlimitedStorage` after explicit consent.

### Internationalization & RTL (F36, F37, F44, F81)
- All 19 baseline locales load; every catalog is complete against the
  English key set (key-coverage report); no UI-facing literal strings remain
  (the ADR-0007 lint rule passes with zero suppressions).
- "Auto" resolution against a range of `navigator.language`/UI-locale
  values, including the Chinese alias map (`zh-CN`/`zh-Hans` → Simplified,
  `zh-TW`/`zh-HK`/`zh-Hant` → Traditional) and a fallback to English for an
  unsupported locale.
- Live language switching (budget P11) updates every surface — viewer,
  toolbar, sidebars, popup, options page, notification text, GitHub-alert
  titles — with no reload.
- Manifest/store strings resolve through `_locales` (ADR-0007) and the
  English `_locales` entries match the runtime catalog.
- **RTL:** per-block direction detection with no whole-document flipping
  from a single RTL paragraph; manual direction override; correct alignment,
  list markers, table structure, TOC, presentation mode, mind-map layout
  (best-effort) and print/export output; code blocks stay LTR inside RTL
  documents; an RTL **UI** locale with an LTR document (and vice versa)
  both render correctly.

### Accessibility (F38) — its own area, not a footnote
Run per surface as it is built (Phases 2-B onward), not only in Phase 9:

- Keyboard-only operation of every interactive surface: toolbar, TOC,
  sidebars, search, lightbox, annotations, presentation controls, mind map,
  popup, options page, onboarding. No feature is mouse-only.
- Visible focus states everywhere; focus trapped inside open dialogs; focus
  restored to the invoking control on close; `Esc` closes overlays.
- ARIA roles/labels on custom widgets; semantic HTML where a native element
  exists; heading hierarchy is meaningful.
- Screen-reader spot-check of the document view, TOC tree, annotations panel
  and settings.
- WCAG AA contrast in **both** themes, including code themes, callouts,
  alerts and diagram chrome.
- `prefers-reduced-motion` respected everywhere an animation exists —
  explicitly including the reading-progress celebration effect (F62), slide
  transitions, and the slide-overflow bounce indicator.
- Automated axe pass (harness established in Phase 0) clean on the viewer,
  popup, options page and onboarding.
- Text remains usable at browser zoom levels users actually use.

### Notifications & error states (F78, and §2 above)
- The unified notification component renders all four types (success,
  error, warning, info), is announced to assistive tech, and is the **only**
  transient-feedback mechanism in the product (no feature-local ad hoc
  toasts).
- Every failure mode in §2 produces a human-readable, in-context message
  with a recovery action where one exists: invalid Markdown, invalid
  Mermaid/PlantUML/Graphviz/LaTeX, unsupported MDX construct, inaccessible
  local file, unavailable image, failed export, missing file-URL permission,
  lost folder permission, storage quota exceeded, PlantUML server
  unreachable.
- **No blank screens, ever** — including when a renderer throws mid-document.

### Reading productivity (F16, F17, F62, F71)
- Reading-progress indicator tracks position and percentage smoothly, and
  respects its enable/disable setting.
- Celebration effect (F62) is **off by default**, independently toggleable,
  and fully suppressed under `prefers-reduced-motion`.
- Word/character counts and reading time are computed locally and are
  correct for Latin text **and** for CJK (F71 — character-based counting for
  Chinese/Japanese/Korean runs, mixed CJK+Latin documents verified), not
  naive whitespace splitting.

### Advanced modes (F28, F29, F56, F76)
- All three slide-splitting strategies plus the auto-detect heuristic and
  the "not enough structure to present" message below the 3-heading
  threshold.
- The full keyboard set (arrows, PageUp/Down, Space, Esc, Home/End, 1–9,
  F/F11, `?`, `P`), touch navigation, auto-play including pause-at-final-
  slide, slide counter and progress indicator, speaker notes, overflow
  scroll indicator, and a clean return to normal document view.
- Presentation style customization and "Reset presentation settings" (F56);
  empty fields inherit the active theme rather than forcing a value.
- Lightbox is disabled while presenting; Mermaid/KaTeX render inside slides
  with correct theme sync.
- Mind map (F29): hierarchy generation from headings including skipped
  levels and duplicate titles; zoom/pan/collapse/expand/fullscreen;
  SVG/PNG/JPEG export.

### Export (F30–F33, plus F27 in exports)
HTML, DOCX, print/PDF, diagram image export, mind-map export — each verified to
preserve the content listed in
[`01-functional-requirements.md`](./01-functional-requirements.md) §24. Plus:

- **Annotations in exports** (C7 resolution, `01 §21`/`§24`): highlights and
  underlines reproduced in HTML and print with a print-safe palette;
  comments as numbered markers plus a comment list/endnotes; DOCX
  best-effort (shading/underline runs, native Word comments or endnote
  fallback — never a silently dropped comment). With the "Include
  annotations in exports" setting off, no annotation artefacts appear at
  all. **Orphaned annotations are never exported.**
- Exported HTML is self-contained and requires **no JavaScript** to display
  content or annotations; it passes the same XSS test set as the live viewer
  when re-opened standalone.
- Print output hides app chrome, uses the specified page setup, doesn't cut
  tables/code badly, and force-loads lazy images first.
- DOCX opens without corruption in a real word processor; the three math
  tiers behave per their documented boundary.
- Export budget P12.

### First-run, demo & release surfaces (F45, F46, F52, F57, F58)
- Onboarding runs start-to-finish on a fresh profile, requires no account,
  and its permission-explanation step matches actual behaviour.
- The bundled demo document (F46) — **the standing manual-test fixture from
  Phase 2-A onward** — renders every feature area it claims to, with no
  console errors, at every phase that extended it.
- "What's New" (F52) shows once after an update and not again; it is
  in-extension, not an external page.
- Help/feedback links (F57) open the intended targets on explicit user
  action only, with no background requests.
- License/attribution panel (F58) lists real dependencies and shows the
  static "Free" status with **no** license check, payment, or server call
  anywhere in the codebase.

### UI (F34, F48, F49, F50, F73)
Dark mode, light mode, system-theme following, responsive layout at multiple
widths (desktop, laptop, narrow window, tablet), sidebars collapsing to
drawers, toolbar compacting on scroll, drag-to-resize sidebars (F73),
in-document search behaviour (match count, next/previous, highlight, case
sensitivity, clean DOM restoration on close — budget P6), and full keyboard
navigation of every interactive surface (see the Accessibility area).

### Privacy & network (F47)
Executed as specified in
[`04-security-privacy.md`](./04-security-privacy.md) §1 — the five
assertions there (no telemetry code; no request carrying document content or
identifiers; every request target either the opt-in PlantUML server or a
subresource named by the open document; zero outbound requests with PlantUML
off and "Block remote images" on; no font-CDN or third-party asset host) are
the criterion. Not restated here, so the two documents cannot drift.

### Performance
1 MB and 5 MB Markdown files, documents with thousands of lines, documents with
hundreds of headings, documents with many images, documents with many code
blocks, documents with many diagrams, 1,000-file folder trees, and a 50-
annotation document — verified against the **numbered budgets P1–P14 in §1a**,
not against "feels fast". Every measurement is recorded with the fixture used
so a later phase re-runs the identical test.

## 4. Manual Chrome installation test pass

After each significant implementation milestone:

1. Build the extension (`npm run build`).
2. Load unpacked `dist/` at `chrome://extensions` with Developer Mode on.
3. Test local `.md` files — **both access flows, and this step is
   irreducibly manual**:
   - 3a. **Flow A (`file://`)**: enable "Allow access to file URLs" on the
     extension's details page, then open a local `.md` file by
     double-clicking it / typing the `file://` URL. Confirm detection,
     handoff and rendering. *This cannot be automated:* Chrome exposes the
     file-URL toggle only as a manual per-extension setting — there is no
     launch flag and no extension API to set it, so Playwright cannot
     exercise this path. The detection **predicate** is unit-tested instead;
     the end-to-end path is verified here, by hand, every pass.
   - 3b. **Flow B (picker)**: with the toggle *off*, use "Open file" from
     the popup/viewer and confirm the same document renders — proving Flow B
     needs no file-URL permission at all.
4. Test raw GitHub Markdown, and confirm the extension performs no re-fetch
   of the source URL (ADR-0006 handoff).
5. Test other remote Markdown sources (GitLab/Bitbucket/Gitea/arbitrary).
6. Test all diagram types (Mermaid, Graphviz, PlantUML on/off).
7. Test math rendering.
8. Test all export formats, **including annotations in each** (setting on
   and off).
9. Test folder browsing, folder search, bookmarks, recents and auto-refresh.
10. Test presentation mode (all three splitting strategies + full keyboard
    set).
11. Test mind-map mode, including SVG/PNG/JPEG export.
12. Test annotations (create/edit/delete/persist across reload, plus one
    deliberate external edit to exercise re-anchoring and orphaning).
13. Test dark/light/system theme **and live-apply** of typography/layout
    changes in two open viewer tabs.
14. Test RTL content, manual direction override, **and switching the UI
    language** (including an "Auto" resolution and one RTL locale).
15. Test all keyboard shortcuts, the shortcut help modal, and keyboard-only
    operation of every surface.
16. Run through the security test set (§3 above), plus the privacy/network
    assertions from [`04-security-privacy.md`](./04-security-privacy.md) §1.
17. Test large documents (1 MB, 5 MB) against the §1a budgets, plus a
    1,000-file folder tree.
18. Log and fix every discovered problem before considering the milestone done.

## 5. Quality gate — do not call the project "complete" until ALL of these hold

Extended 2026-09-08 to cover the full F01–F81 range; the feature IDs in
brackets let this checklist be reconciled against
[`02-feature-matrix.md`](./02-feature-matrix.md) row by row.

### Build & hygiene
- No TypeScript errors; no build errors; no console errors during normal usage.
- No broken UI states; no blank screens on any failure path (F78).
- `npm install && npm run build` produces a loadable unpacked extension from a
  clean checkout.
- The `no-literal-user-strings` lint rule passes with zero suppressions
  (ADR-0007).

### Security, privacy & permissions
- No obvious security vulnerabilities (per §3's Security and MDX test sets).
- No unnecessary permissions requested (see
  [`07-permissions-compliance.md`](./07-permissions-compliance.md), including
  its recorded amendments); the shipped manifest matches that document exactly.
- The privacy/network assertions in
  [`04-security-privacy.md`](./04-security-privacy.md) §1 all pass [F47].
- No payment, licensing, account, or feature-gating logic exists anywhere
  [F58].

### Content rendering
- Markdown rendering works correctly across the full feature set in
  `01-functional-requirements.md` [F08].
- Custom containers, GitHub alerts and the front-matter card all render, and
  each per-feature Markdown toggle works independently [F67, F44, F43, F69].
- MDX renders safely and passes every ADR-0008 threat case [F09, F68].
- Syntax highlighting works, with theme selection in both app themes
  [F10, F70].
- Mermaid works; KaTeX works; Graphviz works; PlantUML works or degrades
  gracefully with a clear message [F11–F14, F79].
- Unicode heading anchors are correct and `#fragment` deep-linking works on
  load [F60].
- External-link indicators appear on text links only, with safe `rel`/target
  and no background fetch [F25, F72].
- Sticky table headers work without distorting tables [F26].

### Navigation, UI & settings
- TOC works, filters, and stays in sync while scrolling [F15].
- In-document search works [F49]; raw/rendered toggle works [F18]; image
  lightbox works [F24]; toolbar works with no dead controls [F48].
- Responsive layout holds from desktop to tablet widths [F50]; sidebars
  drag-to-resize [F73].
- All settings persist; live-apply works without reload and across open
  viewer tabs [F35, F81]; settings import/export round-trips and rejects
  malformed input safely [F42].
- Clear Cache clears exactly its documented key set and leaves settings,
  folder handles and annotations intact [F55].
- Popup is lightweight and exposes theme, open-file/open-folder launchers,
  recents, quick settings and help — with the full app never embedded in it
  [F40, F54, F57].

### Files & project workflow
- Folder browser works, including exclusion list, file-type filter,
  active-file highlighting, and progressive scanning with a working Cancel
  [F19, F63–F65].
- Folder full-text search works off the main thread [F20]; bookmarks work
  [F21]; recents group/de-duplicate correctly and capture remote entries
  only per the ADR-0006 §6 rule [F22, F59, F75].
- Auto-refresh works for both access flows, is focus-aware, and preserves
  scroll/theme [F23, F74]; folder permission persists, with a working
  "Reconnect folder" affordance when it doesn't [F80].

### Reading productivity & annotations
- Reading progress and document statistics work, with CJK-aware counting
  [F16, F17, F71]; the celebration effect is off by default and suppressed
  under reduced motion [F62].
- Annotations create/edit/delete/persist [F27]; **re-anchoring behaves per
  ADR-0003 on every branch, and annotations that cannot be re-anchored are
  visibly orphaned — never silently dropped or mis-placed**; the tabbed
  outline+annotations sidebar works [F51]; no annotation data ever reaches
  the source file or leaves `chrome.storage.local`.

### Advanced modes & export
- Presentation mode works, including all three splitting strategies, the
  full keyboard set, auto-play, speaker notes and style customization
  [F28, F56, F76]; mind map works with SVG/PNG/JPEG export [F29, F33].
- HTML export works; DOCX export works; print/PDF works [F30–F32] — and
  **annotations appear correctly in all three when enabled, and not at all
  when disabled**.

### Internationalization & accessibility
- i18n works end to end: all 19 locales load, every catalog is complete
  against the English key set, "Auto" resolves correctly (including the
  Chinese alias map), and switching language updates every surface live
  [F37].
- RTL works across content, chrome, presentation, mind map and exports,
  without whole-document flipping from a single RTL paragraph [F36].
- Dark/light/system themes work everywhere they're supposed to [F34].
- **Accessibility passes §3's Accessibility area in full** — keyboard-only
  operation of every surface, focus management, ARIA/semantics, WCAG AA
  contrast in both themes, `prefers-reduced-motion` honoured everywhere, and
  a clean automated axe pass [F38].

### Release surfaces & platform
- Onboarding completes on a fresh profile with no account required [F45];
  the bundled demo document exercises the whole feature set [F46]; "What's
  New" shows once per update [F52].
- Works on Chrome and on Edge/Brave/Opera/Vivaldi with no Chrome-only API
  used without documented justification [F53].

### Performance
- **Every budget P1–P14 in §1a is met and recorded** (not "large documents
  feel fine") — including first paint at 1 MB/5 MB, no >50 ms tasks during
  scroll, folder-scan and re-anchoring budgets, and live-apply/language-
  switch latency.

A feature is only ever reported as "done" once it has actually been implemented
**and** verified against this section — never based on "the build succeeded."
Any line item that cannot be met must be recorded as an explicit, documented
known limitation with its reason — never quietly dropped from this list.
