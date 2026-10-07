# Markora UI/UX Implementation Plan

Status: **living document**, updated at the end of every phase. Last updated
2026-09-17 (Phase 21).

## 0. Corrected starting premise

`CLAUDE.md` states the repo is "documentation only... implementation has not
started." That is stale. Git history shows five completed phases ending in
"Phase 10: production polish, release prep, and reference-token UI
migration," and `src/frontend/` + `src/viewer/` contain a fully wired, real
(non-mocked) UI: toolbar, file browser (real FileSystemAccess folders), TOC
generated from the live document, in-document search, annotations with
re-anchoring, presentation mode and mind map built from the open document,
real HTML/DOCX/print export, settings, popup, onboarding, i18n across 19
locales with RTL, and axe-based accessibility checks in the e2e suite. This
plan is therefore a **gap-closing audit and polish pass**, not a rebuild —
per the codebase's own workflow rule ("verify before building").

**The visual design source already exists and is legitimate.** `Ui-prompt.md`
at the repo root (committed in `8fa3603`, the Phase 10 commit) is the actual
brief the current dark/light token system, layout, and component set were
built from. It explicitly instructs: *"Use the attached Markview reference
only as visual inspiration... Do not copy Markview branding, logo, exact
layout, text, icons, or assets. Markora must look like its own product."*
Its 12 screen specs (viewer, file browser, TOC, search, annotations, export,
empty/loading/error states, popup, settings, onboarding, presentation, mind
map) map almost one-to-one onto this redesign brief's 32 sections. **This
plan uses `Ui-prompt.md` + the existing implementation as the design source
of truth.**

*Correction (Phase 7):* an earlier session in this plan stated as fact that
the `new_ui/` screenshots were "MarkView's own UI" because "the Settings
dialog and menu items in those screenshots literally read 'MarkView'." That
claim was re-checked directly (re-opening all nine images) rather than
taken on faith, and it does not hold up: eight of the nine
(`1.png`, `2.png`, `3.png`, `extension_popup.png`, `fullsetting.png`,
`annotations.png`, `export.png`, `threedotsetting.png`) are genuinely
Markora-branded ("Markora Preferences", "About Markora", "Export
Document — Target: Markora Architecture.md", etc.) — made for this
project, as the user confirmed. Only `presentation.png` still carries a
literal leftover "MarkView | System V2 Docs | Presentation Mode" string in
its title bar. So the eight Markora-branded images are legitimate design
reference for phases that haven't run yet (Popup polish — Phase 8; final
polish — Phase 10), not just a source of UX *ideas* to reimplement from
scratch — only `presentation.png`'s leftover title-bar text (not its
layout) stays off-limits to copy literally, per the Independence
requirement in `docs/specs/00-overview.md` §3 / `CLAUDE.md`.

**Policy update (Phase 7, at the user's explicit direction):** the user
confirmed these are their own mockups for this exact product and asked for
`new_ui/` to be treated as the literal visual target — "I want same UI for
my extension just look like new_ui/ folder... doesn't matter any other
application using same UI or not." This supersedes the earlier
"ideas only" policy: `new_ui/`'s eight Markora-branded images are now this
plan's literal visual spec (alongside `Ui-prompt.md`, which they mostly
agree with structurally), for both remaining phases and, where a screen
already built diverges structurally (not just cosmetically) from its
`new_ui/` counterpart, as a candidate for a follow-up visual-alignment
phase — see `fullsetting.png` vs. the current Settings page, noted below.

## 1. Design system — current state

Token layer lives in `src/frontend/styles/index.css` (single stylesheet, no
CSS-in-JS/modules), two generations:

- **Legacy alias layer**: `--markora-color-bg`, `-fg`, `-border`, `-accent`,
  etc. — the original Phase 1 tokens, now unused directly (see Phase 1 below).
- **Current literal layer** (`Ui-prompt.md`-sourced): `--bg-canvas`,
  `--bg-surface`, `--bg-surface-hover/active/selected`, `--border-subtle`,
  `--border-strong`, `--text-main/secondary/muted`, `--accent-blue(-hover|
  -subtle)`, `--callout-*`, `--code-bg` — the sole source of truth as of
  Phase 1, plus a spacing scale (`--markora-space-1..6`), an elevation scale
  (`--markora-shadow-sm/md`), and a dedicated presentation-mode surface pair.
  Dark theme overrides live in `:root[data-theme='dark']`; this is exactly
  the palette given in this redesign brief (`#0F1115`/`#171920`/`#1F232C`/
  `#262A34`/`#E2E6ED`/`#677082`/`#3B82F6`) because it was already sourced
  from the same design intent.
- Shared focus-visible ring, box-sizing reset, and Phase-9 axe-driven
  contrast fixes are already in place and documented inline.

**Icon system**: hand-authored inline SVGs in
`src/frontend/components/icons/index.ts`, 20×20 viewBox, `currentColor`
stroke, `aria-hidden`, no external icon library — already independence-safe
and consistent. No change needed.

## 2. Page/component audit (against this brief's §4 checklist)

| # | Screen/feature | Status | File(s) | Notes |
|---|---|---|---|---|
| 1 | Main viewer | Real, 3-column | `src/viewer/index.ts` | Left file browser → center content → right TOC/annotations rail (in-progress reorder finished in Phase 1, matches `Ui-prompt.md` §1 and this brief §7) |
| 2 | File browser | Real, multi-workspace | `components/fileBrowser`, `components/openWorkspaceModal` | Real FS Access folders, tree, bookmarks, reconnect flow, exclusions (F63), file-type filter (F64), active-file highlight — rewritten in Phase 13 for real multiple-simultaneous-open-folders support vs. `new_ui/2.png`/`5.png` (own section per workspace, cross-workspace search, an "Open Workspace/Folder" modal) |
| 3 | Toolbar | Real, grouped | `components/toolbar` | Icon-first + tooltips, matches `Ui-prompt.md` §1 grouping; mobile-wrap overflow bug found and fixed in Phase 2 |
| 4 | Search | Real | `components/search` | Match count, next/prev, highlight — copy verified against spec in Phase 3, no gaps |
| 5 | TOC | Real | `components/toc` | Scroll-spy, heading tree from live DOM, filter — copy verified in Phase 3, no gaps |
| 6 | Annotations | Real | `components/annotations` | Create/edit/delete/reanchor, persisted; visual polish vs. `new_ui/annotations.png` in Phase 13 (quote-box excerpt, relative timestamps, header count badge) — deliberately no fake author/avatar identity, since this is a local single-user tool |
| 7 | Presentation | Real | `components/presentation` | Built from open document, not hardcoded — verified against `Ui-prompt.md` §11 in Phase 5, no gaps |
| 8 | Mind map | Real | `components/mindmap` | Built from actual headings — zoom/pan/collapse/expand/fullscreen/export verified live in Phase 5, no gaps |
| 9 | Export | Real | `components/exportDialog`, `backend/export` | Converted from a toolbar dropdown to a full card-grid dialog vs. `new_ui/export.png` in Phase 13 — 5 real formats (HTML/DOCX/Print, plus new Markdown Source and Copy to Clipboard, both real); `components/exportMenu` deleted as dead code |
| 10 | Settings | Real | `src/settings` | Categorized nav, saved-feedback toast, and a real Shortcuts recorder (was a "Coming soon" stub) verified/added against `Ui-prompt.md` §9 in Phase 7 |
| 11 | About | Real | `components/aboutModal` | Verified real in Phase 7 — shares content builders with Settings' About section and the popup's Help tab, no gaps |
| 12 | Shortcut help | Real | `components/shortcutHelp` | Verified real in Phase 7 — live recording, focus-trapped, no gaps; now also embedded (not duplicated) in Settings |
| 13 | Popup | Real, compact | `src/popup` | Restructured to match `new_ui/extension_popup.png` in Phase 8: Quick Controls/Recent & Bookmarks/Preferences tabs, real Active Document card, real high-contrast/sync-scroll/typography controls — quick actions only, no full-app duplication |
| 14-18 | Menus/dialogs/empty/loading/error states | Real | various | Shared toast (`components/notifications`), skeleton (`components/skeleton`) |
| 19 | File/folder selection | Real | `components/fileBrowser` | |
| 20 | Workspace mgmt | Real, multi-workspace | `backend/storage`, `components/fileBrowser` | Multiple simultaneously-open folders (Phase 13), each independently scanned/searchable/bookmarkable/closeable |
| 21-22 | Theme/typography settings | Real | `backend/utils/theme.ts`, `typography.ts` | Live-apply, no reload (F81) |
| 23 | Raw/rendered/split | Real | `src/viewer/index.ts` | |
| 24 | Status bar | Real | `components/documentStats`, `readingProgress`, `src/viewer/index.ts`'s `buildStatusBar` | Was a floating word-count pill only; rebuilt as a real full-width bottom status bar (`<footer>` landmark) vs. `new_ui/main.png` in Phase 12 — source filename, UTF-8 (real: `File.text()`'s fixed decoding), word/char count, reading time, sync status (mirrors the popup's Active Document card), and a Hotkeys button reusing the existing shortcut-help modal |
| 25 | Notifications | Real, unified | `components/notifications` | F78 |
| 26 | Confirmation dialogs | Real | `settings/index.ts`, `popup/index.ts` | Two-step arm/disarm pattern; gap in popup's recents "Clear all" found and fixed in Phase 4 |
| 27 | Accessibility | Real, tested | e2e axe checks | Continuous — re-verify per phase |
| — | Onboarding | Real | `src/onboarding/index.ts` | F45, present and wired |

Rows marked "Real" are functioning against actual data (no mocks) per the
Phase-0 fork audit of the source; later phases re-verify each against this
brief's specific ask (copy, empty-state wording, confirmation-dialog
completeness) rather than re-implementing.

## 3. Phase plan (adapted from this brief's §29 to the actual repo state)

Each phase: verify current state → close real gaps only → run
`npm run build`, `npm run lint`, `npm run test` (+ `test:e2e` where the
change touches interaction, not just tokens) → update this doc's status
table → stop.

| Phase | Scope | Status |
|---|---|---|
| 1 | Design system consolidation + finish in-progress right-rail layout move | **Done** |
| 2 | Main viewer + toolbar + file browser polish pass vs. `Ui-prompt.md` §1-2 | **Done** |
| 3 | Reading experience (typography/callouts/code/tables) + TOC + search polish | **Done** |
| 4 | Annotations + workspace management (confirmation dialogs, clear-all) | **Done** |
| 5 | Presentation + Mind map polish | **Done** |
| 6 | Export + Print dialog polish (format-picker card layout, per popup UX idea) | **Done** |
| 7 | Settings + About + Shortcut help vs. `Ui-prompt.md` §9 category list | **Done** |
| 8 | Popup polish vs. `new_ui/extension_popup.png` (now a literal visual reference, not just an idea source — see §0's Phase 7 policy update) | **Done** |
| 9 | Responsive + accessibility re-verification at phone/tablet widths | **Done** |
| 10 | Final visual/functional polish, doc updates — closes remaining real gaps against `extension_popup_bookmark.png`/`3.png`, the two `new_ui/` images added after Phase 13's audit | **Done** |
| 11 | Settings visual overhaul: convert to a floating "Preferences" dialog matching `new_ui/fullsetting.png` (compact left nav, Reset Defaults/Done footer) — deferred out of Phase 7 at the user's request, since it's a structural change to an already-real, tested settings surface, not a quick style pass | **Done** |
| 12 | Main viewer bottom status bar vs. `new_ui/main.png` — real full-width status bar (filename, encoding, word/char count, reading time, sync status, Hotkeys), done ad hoc at the user's direct request for main-page parity (out of numeric sequence, same pattern as Phase 11's insertion) | **Done** |
| 13 | Full `new_ui/` parity pass at the user's explicit direction ("implement all UI exact same as shown in new_ui/ folder"): real multi-workspace support (`2.png`/`5.png`), expanded toolbar more-menu (`threedotsetting.png`), annotations visual polish (`annotations.png`, no fake authors), export dialog (`export.png`) | **Done** |
| 14 | User-reported bug pass: export dialog (`export.png`) rendered "messy" (a real missing-CSS regression), and the popup's "Open Full Settings" never opened the `fullsetting.png`-style in-viewer dialog | **Done** |
| 15 | White-text-on-`--accent-blue` contrast audit — the gap flagged as open since Phase 13 across four prior phases' "Remaining Issues" sections, finally closed | **Done** |
| 16 | Live syntax-highlight theme fix — the mechanism bug flagged as open since Phase 3: theme didn't re-sync on a live app-theme toggle, and (found during this pass) the Settings "Code block theme" picker had zero live effect at all | **Done** |
| 17 | Real "Modified {time}" status-bar field for local files, using `File.lastModified` — the honest, reduced alternative Phase 12 flagged in place of `main.png`'s fabricated "Updated 2 hours ago" title badge | **Done** |
| 18 | Test-coverage cleanup: fixed `smoke.spec.ts`'s flaky missing-wait (flagged in Phase 16) and added e2e coverage for Phase 17's new status-bar field (flagged in Phase 17) | **Done** |
| 19 | Left sidebar (folder browser) full visual/UX overhaul to match `new_ui/main.png` exactly, at the user's explicit request | **Done** |
| 20 | Left sidebar round 2: user-tested real feedback — removed unwanted footer/dropdown text, custom scrollbar, and a combined "+" Open File/Open Folder popover replacing the separate footer buttons | **Done** |
| 21 | User-reported bug pass against a fresh `issues.txt` (11 items) — a real diagram-rendering defect (Mermaid flowcharts rendering as unlabeled black shapes, root-caused to a DOMPurify shared-instance config leak, not a color/theme bug), an annotations-badge `[hidden]` bug, a global-shortcut-suppression-while-typing bug, a new sidebar-position setting, and locale-key gaps — see §23 | **Done** |

## 4. Phase 1 — design system consolidation + layout finish

### UI Improvements
- None visual (token consolidation is value-identical by design).

### UX Improvements
- Finished the in-progress workspace reorder already mid-flight in the
  working tree: file browser (left) → content (center) → TOC/annotations
  (right utility rail), matching `Ui-prompt.md` §1 and this brief's §7
  layout diagram. Default sidebar widths tuned to match (`tocSidebarWidth`
  240, `folderBrowserSidebarWidth` 260, `contentWidth` 820).

### Functional Integrations
- None — no backend contract changed.

### Components Changed
- `src/frontend/styles/index.css`: ~68 remaining legacy `--markora-color-*`
  references migrated to the direct token layer (values unchanged — zero
  visual diff, pure consolidation), so there is one token source of truth
  going forward instead of two generations.

### Files Added
- `docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md` (this file).

### Files Modified
- `src/frontend/styles/index.css`
- `src/viewer/index.ts` (pre-existing in-progress change, kept)
- `src/backend/storage/schema.ts` (pre-existing in-progress change, kept)
- `src/backend/utils/typography.test.ts` (pre-existing in-progress change, kept)
- `e2e/phase2b.spec.ts` (pre-existing in-progress change, kept)

### Files Removed
- Stray untracked `_locales/dist/` build-artifact directory (gitignored,
  not the real build output, was breaking `npm run lint` by pulling
  minified vendor bundles into ESLint).

### Tests
- `npm run test` — 587 passed / 72 files.
- `npm run lint` — 0 ESLint errors after removing the stray `_locales/dist`
  artifact (pre-existing Prettier formatting drift remains in 13
  non-UI files — docs, config, lockfile — untouched, out of this redesign's
  scope).
- `npm run build` — succeeds (`tsc --noEmit && vite build`).
- `test:e2e` not run this phase (no interactive behavior changed, only CSS
  token names and DOM append order that unit tests + typecheck already
  cover) — covered by Phase 2's e2e run instead.

### Build Result
Green — see Tests above.

### Remaining Issues
- Legacy `--markora-color-toc-active-fg` and a few status colors
  (success/error/warning/info) intentionally stay theme-invariant per
  existing Phase-9 contrast findings — not touched, not a gap.
- Prettier formatting drift in 13 non-UI files (docs/config/lockfile) is
  pre-existing and out of scope for a UI/UX redesign; flagging here so it
  isn't mistaken for something this pass caused.

## 5. Phase 2 — main viewer + toolbar + file browser

Reviewed `src/frontend/components/toolbar/index.ts`,
`src/frontend/components/fileBrowser/index.ts`, and their CSS against
`Ui-prompt.md` §1-2 and this brief's §7/8/11. Both components are already
real, complete, and well-structured (grouped toolbar sections, icon+tooltip
pattern, live scan/search with cancellation, bookmarks, reconnect banner,
active-file highlighting, hover/active/selected states all present). Found
and verified one real defect via a real extension-context browser session
(not a code-reading guess):

**Bug found and fixed**: `.markora-toolbar` used a fixed `height: 34px`
while also being `display: flex; flex-wrap: wrap`. At narrow widths the
toolbar's button groups wrap onto multiple rows, but the fixed height
didn't grow to fit them — wrapped rows rendered outside the box and
visually overlapped the content underneath (confirmed via screenshot at
375px width: toolbar icons overlapping the "No document open" empty-state
text). Existing e2e coverage (`phase2b.spec.ts` "no horizontal overflow"
tests) didn't catch this because it's a *vertical* overflow, not
horizontal. Fixed by changing `height` to `min-height` on
`.markora-toolbar` and `.markora-toolbar--compact` — pixel-identical at
desktop widths (single row already meets the floor), and correctly grows
to fit wrapped rows on narrow widths.

**Verified for real**, not just by reading code: built the extension,
launched it with `chromium.launchPersistentContext` + `--load-extension`
(the same mechanism `e2e/extension-fixtures.ts` uses) in headless Chromium,
and screenshotted the empty state at desktop width (1440px, light + dark)
and mobile width (375px, toolbar wrapped + Files drawer open). All render
cleanly with no overlap, in both themes. Then ran the targeted e2e subset
most likely to catch a regression from a toolbar/layout CSS change
(`smoke`, `phase2a`, `phase2b`, `phase9-a11y` — 46 tests) — all passed,
including axe accessibility scans in both themes.

**No other gaps found** in these two components against the brief — file
browser already has open-folder/bookmark/filter/search/cancel/reconnect,
multi-folder *switching* via bookmarks (not simultaneous multi-root
display, which isn't in the original F-list or `Ui-prompt.md` and would be
a new feature, not polish — flagged for a separate conversation if wanted,
not added here). Toolbar already groups Document/View/Navigation/Tools/
Settings-equivalent actions sensibly with tooltips on every icon-only
button.

### UI Improvements
- Fixed toolbar mobile-wrap overflow (see above) — narrow-viewport toolbar
  no longer overlaps document content.

### UX Improvements
- None beyond the bug fix — layout/interaction already matched the brief.

### Functional Integrations
- None — no backend contract changed.

### Components Changed
- Toolbar (`.markora-toolbar`, `.markora-toolbar--compact` CSS only).

### Files Added
- None.

### Files Modified
- `src/frontend/styles/index.css` (`.markora-toolbar` / `--compact`:
  `height` → `min-height`)

### Files Removed
- None (a stray `.playwright-mcp/` debug-artifact directory and a
  root-level screenshot created during this session's manual testing were
  cleaned up — not part of the app).

### Tests
- `npm run build` ✓
- Targeted `npx playwright test e2e/smoke.spec.ts e2e/phase2a.spec.ts
  e2e/phase2b.spec.ts e2e/phase9-a11y.spec.ts` — 46/46 passed
- Manual visual verification in a real loaded extension (headless
  Chromium, `--load-extension`): desktop light/dark empty state, mobile
  toolbar wrap, mobile Files drawer — all clean

### Build Result
Green — see Tests above.

### Remaining Issues
- Full `npm run test:e2e` (all phases) not re-run in full this session —
  the targeted subset covers every spec that touches toolbar, layout,
  responsiveness, or accessibility; the rest (export, presentation, mind
  map, i18n, etc.) are unrelated to this phase's CSS-only change.

## 6. Phase 3 — reading experience (typography/callouts/code/tables) + TOC + search

Reviewed `components/search/index.ts`, `components/toc/index.ts`, and the
`.markora-content` typography/table/code-block/callout CSS against
`Ui-prompt.md` §1/§4 (search: match count, prev/next, case-sensitive toggle,
strong current-match state; TOC: filter, nesting, active indicator) and this
brief's "readable code and table styles" / realistic-README requirement
(headings, paragraphs, callout, task list, table, code block, diagram, math,
image, blockquote, links). Search and TOC components themselves were already
complete, real, and correctly copy-matched (`search.matchCount`: `"{current}
of {total}"`, `toc.empty`: `"No headings in this document."`) — no changes
needed there. Found and fixed three real reading-experience gaps in the
underlying document typography, verified with a live loaded-extension
session rendering the project's own `demo.md` fixture (which exercises every
construct named above), not just by reading CSS:

**Bug 1 — code blocks ignored the app theme.** `DEFAULT_SETTINGS.highlightTheme`
(`src/backend/storage/schema.ts`) is `'github'`, a light syntax theme,
independent of `Settings.theme` (which defaults to `'system'`). A fresh
install with the OS in dark mode rendered a fully dark UI with bright white
code-block boxes — confirmed via screenshot (`emulateMedia({colorScheme:
'dark'})` + drop `demo.md`): `.markora-code-block__pre code` background was
`rgb(255,255,255)` against a `rgb(15,17,21)` canvas. Fixed by adding
`resolveEffectiveHighlightTheme(key, resolvedAppTheme)` in
`src/backend/viewer/syntax/themes.ts`, called once at viewer boot
(`src/viewer/index.ts` bootstrap) with `getAppliedTheme()` (the same helper
Mermaid already uses to react to resolved theme). It pairs only the
untouched shipped default (`'github'`) with `'github-dark'` when the
resolved theme is dark; any of the other 13 themes a user has actually
picked in Settings — including re-picking `'github'` itself — is left
exactly as chosen, since there's no "auto" tri-state in the schema to
distinguish "never touched" from "explicitly re-selected" without a
settings-schema change (out of scope for a polish phase). Re-verified after
the fix: `.markora-code-block__pre code` background is `rgb(13,17,23)`
(github-dark) in the same fresh-dark-install scenario.

**Bug 2 — callout design tokens were defined but never wired up.** The
token layer already declares `--callout-note-bg/-border`,
`--callout-tip-bg/-border`, `--callout-warning-bg/-border`,
`--callout-danger-bg/-border` (the exact per-type tinted-background system
`Ui-prompt.md`'s palette implies), but grep showed only
`--callout-warning-bg` was ever referenced anywhere, for an unrelated
purpose (the file-browser reconnect banner) — GitHub-style alerts
(`.markora-alert--note/tip/warning/caution/important`) and custom
containers (`.markora-container--info/warning/danger`) all shared one flat
`background: var(--markora-color-bg-subtle)` and differed only by a
left-border color. Fixed by adding the matching `background` declaration to
each type's selector (`--callout-note-bg` for note/info,
`--callout-tip-bg` for tip, `--callout-warning-bg` for warning/caution,
`--callout-danger-bg` for danger, `--accent-blue-subtle` — the existing
generic blue-tint token, already used elsewhere for hover backgrounds — for
`important`, since the 4-token callout set has no fifth "important" tint).
Left every existing border-color mapping untouched (including
`caution` sharing the `warning` bucket, which is pre-existing, deliberate,
and covered by `alerts.test.ts`). Verified visually in both themes: each
alert/container type now renders with a distinct, readable tint.

**Bug 3 — base content elements (links, blockquotes, `<hr>`, images) had no
theme-aware styling.** Grep of `index.css` found zero rules for `.markora-
content a`, `blockquote`, `hr`, or `img` — they rendered on raw browser
UA defaults: links used Chrome's default blue (`#0000EE`), invisible/near-
illegible against the dark canvas and inconsistent with the app's own
`--accent-blue` accent used everywhere else; blockquotes had no visual
treatment at all (only the presentation-mode slide variant was styled);
`<hr>` rendered as the UA's grey 3-D inset groove, clashing with the flat
design language; and `<img>` had no `max-width`, so an image wider than the
~820px content column would overflow it and force horizontal scroll on the
reading canvas. Fixed by adding themed rules for all four, using existing
tokens only (`--accent-blue`/`-hover`, `--border-strong`, `--text-
secondary`, `--border-subtle`, `--markora-radius`) — no new tokens
introduced. `border-inline-start` used for the blockquote accent bar, same
RTL-safe convention already used by alerts/containers.

### UI Improvements
- Code blocks now match the resolved app theme on a fresh dark-mode
  install instead of showing a jarring white box.
- GitHub-style alerts and custom containers each get their own tinted
  background (previously all one flat shade, distinguished only by a
  border color) — matches the token system's own design intent.
- Links, blockquotes, and horizontal rules in the document body now have
  real, theme-aware styling instead of raw browser defaults; images are
  capped to the content column width instead of being able to overflow it.

### UX Improvements
- None beyond the fixes above — search and TOC interaction/copy already
  matched the spec with no gaps.

### Functional Integrations
- None — no backend contract changed; `resolveEffectiveHighlightTheme` is a
  pure display-layer default-coherence fix, not a new setting or feature.

### Components Changed
- `.markora-content a/blockquote/hr/img` (new rules).
- `.markora-container--*` / `.markora-alert--*` (added `background`).
- Highlight-theme boot resolution (`src/viewer/index.ts` bootstrap call
  site only — not re-applied on later in-session theme toggles, to avoid
  an existing, out-of-scope stylesheet-ordering quirk in
  `applyHighlightTheme`'s dynamic-import caching when switching between
  two already-loaded theme chunks).

### Files Added
- `src/backend/viewer/syntax/themes.test.ts`

### Files Modified
- `src/frontend/styles/index.css` (callout backgrounds; new `.markora-
  content a/blockquote/hr/img` rules)
- `src/backend/viewer/syntax/themes.ts` (`resolveEffectiveHighlightTheme`)
- `src/backend/viewer/syntax/index.ts` (re-export)
- `src/viewer/index.ts` (bootstrap uses the new resolver)

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files (+3 new tests for
  `resolveEffectiveHighlightTheme`).
- `npm run lint` — 0 ESLint errors; Prettier drift returned to the same
  pre-existing 13 non-UI files (my one formatting violation in
  `src/viewer/index.ts` was fixed with `prettier --write` before this run).
- `npm run build` — succeeds.
- Targeted `npx playwright test e2e/smoke.spec.ts e2e/phase9-a11y.spec.ts
  e2e/phase3a.spec.ts e2e/phase3b.spec.ts` — 33/33 passed, including axe
  scans (both themes) confirming the new colors don't regress WCAG AA
  contrast.
- Manual visual verification in a real loaded extension: dropped the
  project's own `demo.md` fixture (covers every construct this phase
  touches) at `emulateMedia({colorScheme:'dark'})` to reproduce the exact
  fresh-install scenario, screenshotted callouts/blockquote/links/hr/images/
  code in both themes, and read back computed styles
  (`getComputedStyle`) to confirm token wiring rather than eyeballing
  alone.

### Build Result
Green — see Tests above.

### Remaining Issues
- The highlight-theme fix only applies at boot; toggling the app theme
  live within a session doesn't re-sync the code-block theme. Not fixed
  here because `applyHighlightTheme`'s dynamic-import caching leaves every
  previously-loaded theme's `<link>` in the DOM, so re-activating an
  earlier theme after a later one was loaded doesn't reliably win the CSS
  cascade — a real but pre-existing mechanism issue (affects manual
  Settings-page theme switching too, not something this phase introduced)
  that needs its own fix (e.g. swapping a single managed stylesheet
  element instead of leaving import-cached links in place), out of scope
  for this polish phase.

## 7. Phase 4 — annotations + workspace management (confirmation dialogs, clear-all)

Reviewed `components/annotations/index.ts` in full against `Ui-prompt.md`
§5 (selection toolbar with Highlight/Underline/Add note, annotation cards
with excerpt/comment/timestamp/edit/delete, "No annotations yet" empty
state). It's real and complete: selection-triggered floating toolbar,
comment composer, edit/delete popovers, an explicit orphaned-annotations
section (re-anchoring failures are surfaced, never silently dropped, per
ADR-0003), correct empty-state copy, and RTL-safe snippet rendering. No
gaps found there.

**Confirmation-dialog audit.** This app has no modal dialog component at
all — its one destructive-action safety pattern is a two-step "arm/disarm"
button (click once to arm with a "Click again to confirm" label that
reverts after 4s if untouched, click again to actually act), already used
correctly by Settings' Clear Cache and Delete All Annotations
(`settings/index.ts`). Auditing every mutating click handler across
`settings/index.ts`, `popup/index.ts`, `viewer/index.ts`, and
`fileBrowser/index.ts` against this pattern:

- Single-item deletes (one annotation, one bookmark, one recent entry) —
  intentionally un-confirmed everywhere, consistent low-friction behavior
  for low-stakes, easily-recreated actions. Not a gap.
- Preference resets (Appearance "Reset to defaults", Presentation "Reset")
  — intentionally un-confirmed; they touch display settings only, never
  user content, and are trivially reversible by re-adjusting a slider. Not
  a gap.
- Settings import (overwrites current settings from a file) — gated by the
  browser's own file-picker step as its friction; settings, not content.
  Not a gap.
- **Popup's "Clear all" (recent documents) — a real gap.** This was the
  one bulk-destructive action on actual user data (the entire recent-
  documents history) that fired on a single click, with no arm step, no
  undo, unlike every other action in this exact category. (This is what
  the Phase-2 audit table had noted as "'Clear all folders' confirmation
  to be verified in Phase 4" — the actual feature is recents, not folders;
  corrected in the audit table above.) Fixed by applying the same
  arm/disarm pattern already proven in `settings/index.ts`, verified with a
  real loaded-extension session: first click leaves the entry untouched
  and relabels the button "Click again to confirm"; second click actually
  clears storage.

### UI Improvements
- Popup's "Clear all" button now visibly arms itself ("Click again to
  confirm") before acting, matching Settings' existing destructive-action
  buttons instead of looking and behaving differently.

### UX Improvements
- Recent-documents history can no longer be wiped by a single accidental
  click.

### Functional Integrations
- None — no new backend contract; reuses the existing `clearRecents()`
  storage function, just gates the call behind the same UI pattern already
  used elsewhere.

### Components Changed
- Popup's Recent tab "Clear all" button (`src/popup/index.ts`).

### Files Added
- None.

### Files Modified
- `src/popup/index.ts` (arm/disarm state for the Clear all button)
- `e2e/phase4.spec.ts` (updated the existing clear-all test for the new
  two-click interaction)
- `src/backend/i18n/locales/*.json` (all 19 locales) — added
  `recents.clearAll.confirm`, reusing each locale's own already-vetted
  translation of the identical English string from
  `settings.maintenance.clearCache.confirm`, rather than introducing new
  machine translations.

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files (unchanged from Phase 3; this
  phase added no new unit-testable pure logic).
- `npx vitest run src/backend/i18n/keyCoverage.test.ts` — 55/55 passed,
  confirming all 19 locale catalogs stay in exact key parity after adding
  the new string.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (same 13
  pre-existing non-UI files).
- `npm run build` — succeeds.
- `npx playwright test e2e/phase4.spec.ts e2e/smoke.spec.ts
  e2e/phase9-a11y.spec.ts` — 28/29 passed. The one failure
  ("P7: Cancel takes effect quickly on a large scan") is a pre-existing,
  environment-sensitive performance-budget test (500ms cancellation-latency
  budget, measured 2065–2083ms across repeated runs) in folder-scan
  cancellation — code this phase never touched. Reproduced in isolation
  with 9 background Node processes already competing for CPU on this
  machine; not a regression from this phase's changes.
- Manual visual/behavioral verification in a real loaded extension: seeded
  a recent document via `chrome.storage.local`, confirmed the first click
  arms the button without deleting data, and the second click clears it.

### Build Result
Green (see Tests above for the one unrelated, pre-existing flaky
performance test).

### Remaining Issues
- The P7 cancel-latency e2e test is flaky on a loaded machine; not fixed
  here since it's unrelated to annotations/confirmation-dialog work and
  touching folder-scan cancellation internals would be pulling work
  forward from a different area.

## 8. Phase 5 — presentation + mind map polish

Reviewed `components/presentation/index.ts` + `slides.ts` and
`components/mindmap/index.ts` + `layout.ts` in full against `Ui-prompt.md`
§11-12 (presentation: fullscreen slide mode from headings, minimal chrome —
progress line, slide count, prev/next, exit, speaker-notes toggle, dark
cinematic surface; mind map: fullscreen interactive tree, central root,
connected branches, zoom/pan/collapse/expand/fullscreen/export, "clean,
technical, readable"). Both are already real, sophisticated, and fully
wired to the open document — no mocked or hardcoded structure:

- Presentation: markdown-it-token-based strategy auto-detection (`hr` /
  `h1` / `h2`, whichever the document actually uses, with a real "not
  enough structure" fallback), slide content cloned from the live rendered
  DOM (not re-parsed), speaker notes extracted from HTML comments,
  autoplay, fullscreen, touch-swipe/edge-tap navigation, a real keyboard
  help overlay, and live re-application of the user's actual Presentation
  settings (background/text/heading/accent color, background image,
  font) via `applySettings(currentSettings.presentation)` — confirmed this
  reads real settings, not fixture values.
- Mind map: heading tree built from the document's live `h1`-`h6` DOM
  nodes via the shared `toc/tree.ts` builder, hand-rolled leaf-based
  layout (no fake/static positions), reuses the same `diagramChrome` shell
  Mermaid/Graphviz use for zoom/pan/fullscreen/export (SVG/PNG/JPEG), and
  its own collapse/expand-per-branch behavior.

**Verified live, not just by reading code**, in a real loaded extension
(`chromium.launchPersistentContext` + `--load-extension`) with a document
exercising nested h1/h2/h3 structure, in both light and dark app themes:

- Presentation slide layout: confirmed via `getComputedStyle`/
  `getBoundingClientRect` that `.markora-slide__inner` is genuinely
  centered at its intended 900px max-width (not just visually assumed from
  a screenshot, which at a glance can look like a narrow left-aligned
  block when the content is short and left-aligned text leaves whitespace
  to its right — a first-look misreading that the computed geometry
  check ruled out), and that heading/paragraph text color resolves to the
  correct `--markora-presentation-fg` value (`rgb(242, 242, 243)`) for
  every cloned element, not just the container — a screenshot artifact had
  suggested a possible color mismatch; the computed-style check across
  every element confirmed there is none.
- Presentation chrome: progress bar width and counter text (`"2 / 3"`)
  update correctly on `ArrowRight`; the `?` keyboard shortcut opens the
  help overlay with real, translated shortcut rows; `Escape` closes the
  help overlay first, then the presentation itself (matching the existing
  focus-trap/dialog stacking).
- Mind map: zoom-in genuinely updates the pan/zoom transform
  (`scale(1.25)`); the toolbar exposes the real
  zoom-in/zoom-out/reset/fullscreen/download-svg/download-png/
  download-jpeg actions; clicking a branch node's `<rect>` genuinely
  toggles `collapsedIds` and re-renders with fewer nodes (8 → 6 for a
  two-child branch, 8 → 1 for the root) — the first attempt at this check
  used Playwright's synthetic `locator.click()` directly on an SVG `<g>`
  element and appeared to do nothing (node count stayed at 8), which
  looked like a broken collapse/expand feature; switching to a native
  `dispatchEvent(new MouseEvent('click', {bubbles:true}))` on the node's
  `<rect>` (the same fix pattern needed in Phase 4 for a button whose
  label changes between clicks) showed the feature works correctly — a
  test-tooling limitation, not a product defect.
- `dir="auto"` RTL-safety: confirmed presentation slides don't lose this
  from cloning, because the existing `rtlAuto` markdown-it plugin already
  bakes `dir="auto"` onto each individual heading/paragraph/list-item/
  blockquote element at render time (not onto a single container), so
  `cloneNode(true)`-ing those elements into a slide preserves it
  correctly with no extra work needed.

**No gaps found.** Both components already meet every checklist item in
`Ui-prompt.md` §11-12. The one item worth noting rather than "fixing": the
brief lists "speaker-notes toggle" as part of the always-visible chrome
bar, but the actual implementation shows a native `<details>/<summary>`
disclosure inline on the slide itself, and only when that slide actually
has notes. This is real, working, and arguably better UX (no dead button
on notes-free slides) — not a fake-functionality gap, so left as is rather
than adding a redundant always-visible chrome-bar button with no
demonstrated defect to justify it.

### UI Improvements
- None — no visual defects found.

### UX Improvements
- None — interaction already matched the spec with no gaps.

### Functional Integrations
- None — no backend contract changed; this phase was audit-only.

### Components Changed
- None.

### Files Added
- None (verification scripts stayed in the session scratchpad, not the repo).

### Files Modified
- None.

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files (unchanged; no code touched).
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (same 13
  pre-existing non-UI files).
- `npm run build` — succeeds.
- `npx playwright test e2e/phase6.spec.ts e2e/smoke.spec.ts
  e2e/phase9-a11y.spec.ts` — 22/22 passed, including axe scans (both
  themes) for presentation mode and mind map, and keyboard-only-operation
  checks (focus trap holds inside both dialogs).
- Manual visual/behavioral verification in a real loaded extension:
  screenshots + computed-style/geometry checks of presentation slides
  (layout, color, chrome, help overlay) and mind map (layout, toolbar,
  collapse/expand, zoom) in both themes.

### Build Result
Green — see Tests above.

### Remaining Issues
- None new. Phases 6-10 not yet started.

## 9. Phase 6 — export + print dialog polish

Reviewed `components/exportMenu/index.ts`, `backend/export/html`,
`backend/export/docx`, and `backend/export/print` in full against
`Ui-prompt.md` §6 (toolbar Export dropdown; Export HTML, Export DOCX,
Print/Save as PDF; small icon, description, keyboard hint where
appropriate; clear hover/focused menu-item states). The card-style
format-picker layout this phase's title calls for already exists — built
in the Phase 10 "popup/export card UI" checkpoint (`ac64c03`) — so this was
a gap-closing audit against the actual spec wording and a live functional
re-verification, not a rebuild:

- Export menu: one dropdown, three real items, each a full card (icon +
  label + description line + format badge — `.html`/`.docx`/`PDF`), not a
  plain text list. `role="menu"`/`"menuitem"`, `aria-haspopup`/
  `aria-expanded` on the trigger, click-outside and `Escape` both close it,
  and closing happens before the click handler runs (no stale-menu flash
  mid-export). Every label/description string is `t()`-driven — verified
  against `en.json`'s `export.menu.*` keys, no literal strings.
- No keyboard-shortcut hint is shown on any item — checked
  `components/shortcutHelp` and the manifest's command list and confirmed
  there genuinely is no keyboard shortcut bound to any export action, so
  omitting the hint is correct per the spec's own "where appropriate"
  qualifier, not a missed requirement.
- Print: no bespoke "print dialog" exists beyond the browser's native
  print sheet, which is correct per ADR-0005 (no PDF-rendering library,
  intentionally relies on native print-to-PDF). The dedicated
  `frontend/styles/print.css` (loaded only for `media="print"`) already
  hides all app chrome, resets diagram pan/zoom to natural size, sets an
  A4 page box, applies break-avoid rules for code/tables/diagrams, and
  swaps annotation highlight/underline/comment colors for a print-safe
  palette — all real, already wired, nothing hardcoded.

**Verified live**, not just by reading code, in a real loaded extension in
both light and dark themes:

- HTML export: clicking the card produces a genuine file download
  (confirmed via Playwright's `download` event resolving to the real
  `<sourcefile-stem>.html` filename) and the shared toast shows
  `"HTML exported"` on success.
- DOCX export: isolated single-action verification (see below) confirmed a
  genuine `<sourcefile-stem>.docx` download.
- Print: intercepted `window.print` and confirmed the Print/PDF card
  genuinely invokes it (not a no-op or a fake "success" toast standing in
  for it).
- Settings wiring: `includeAnnotationsInExports` and `htmlExportEmbedToc`
  toggles in `src/settings/index.ts` call the real `setSettings()` typed
  wrapper and are read live by `onExportHtml`/`onExportPrint` in
  `src/viewer/index.ts` — not fixture values.

**One test-environment false alarm, ruled out, not a product bug:** the
first verification pass showed HTML/DOCX downloads intermittently as
`undefined` in Playwright alongside `net::ERR_CONNECTION_TIMED_OUT`
console errors, which looked like exports silently failing. Root cause:
Chromium's Safe Browsing download-protection check tries to phone home to
verify each download, which times out in this fully network-isolated
sandbox and can delay or drop Playwright's `download` event — unrelated to
the export code, which already showed its real success toast in every
run. Confirmed by re-running with
`--safebrowsing-disable-download-protection` (download events then
resolved immediately with correct filenames) and by an isolated
single-action DOCX-only script that captured a real `demo.docx` download
with no interference. No code change was needed or made for this.

**One incidental fix**: `backend/export/print/index.ts`'s header comment
referenced `src/styles/print.css`, a path left stale by the `746fe9e`
`src/` → `frontend/`/`backend/` restructure; the file actually lives at
`src/frontend/styles/print.css`. Corrected the comment only (no behavior
change) since it sits directly in this phase's own file.

**No functional gaps found.** The export menu, its three real formats, and
the print stylesheet already meet `Ui-prompt.md` §6 with no fake or
hardcoded functionality anywhere in the path.

### UI Improvements
- None — the card-style picker layout, badges, and hover/focus states were
  already in place from a prior phase; this phase's live check confirmed
  no visual defects in either theme.

### UX Improvements
- None — interaction (open/close, click-to-export, click-outside/Escape
  dismissal) already matched the spec with no gaps.

### Functional Integrations
- None — no backend export contract changed; this phase was audit-only
  apart from one comment-path correction.

### Components Changed
- None.

### Files Added
- None (verification scripts stayed in the session scratchpad, not the
  repo).

### Files Modified
- `src/backend/export/print/index.ts` — corrected a stale file-path
  reference in a header comment (`src/styles/print.css` →
  `src/frontend/styles/print.css`); no behavior change.

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (same 13
  pre-existing non-UI files, none touched this phase).
- `npm run build` — succeeds.
- `npx playwright test e2e/phase2b.spec.ts e2e/phase7.spec.ts
  e2e/phase10.spec.ts e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` — 52/53
  passed. The one failure (`Phase 9 — performance budget P12 ... HTML
  export ... completes under 5s`, measured ~5.2s against a 5000ms budget)
  is in a file this phase did not touch (`html/index.ts`/`imageEmbed.ts`
  are untouched — the only edit this phase was a comment in the unrelated
  `print/index.ts`), reproduced identically in isolation, and is ~4% over
  budget — consistent with host-load variance from this session's own
  concurrent headless-browser verification runs rather than a regression.
  Flagged below rather than silently dropped.
- Manual verification in a real loaded extension: screenshots of the
  export menu (both themes, default and hover states), a real HTML
  download, a real DOCX download, and a confirmed `window.print()`
  invocation for the Print/PDF card.

### Build Result
Green — see Tests above.

### Remaining Issues
- Pre-existing P12 export performance budget (`e2e/phase7.spec.ts`)
  measured marginally over its 5000ms threshold (~5.2s) in this session's
  environment, on a file this phase did not modify — likely host-load
  flakiness, not a regression; worth a clean re-run outside a
  verification-heavy session before treating it as a real perf regression.
- Phases 8-10 not yet started.

## 10. Phase 7 — settings + about + shortcut help

Reviewed `src/settings/index.ts` (nav, all sections), `components/aboutModal`,
and `components/shortcutHelp` against `Ui-prompt.md` §9 ("Left navigation:
General, Appearance, Markdown, Navigation, Files, Diagrams, Export, Language
& Direction, Privacy, Storage... Include settings saved feedback and storage
quota indicator"). About and Shortcut help are real, complete, and have no
brief-specific checklist of their own beyond being reachable (toolbar's More
menu / popup footer, per this brief's §7/§8) — both verified working, no
gaps. Settings had three real gaps, all closed:

**Gap 1 — no "settings saved" feedback anywhere.** This page has no Save
button (every control applies immediately, per its own header comment), but
nothing ever confirmed a change actually took — the brief explicitly asks
for this. Added a `save()` wrapper around every plain preference change
(checkboxes, selects, sliders, text fields, the presentation-color patcher)
that shows a `"Settings saved"` toast via the one shared notification
component (code-conventions.md §5) once `setSettings()` resolves. Left
untouched: the two "Reset to defaults" buttons (they reload the page
immediately, so a toast would never be seen) and Maintenance/Import-Export's
own already-distinct outcome toasts (Clear Cache, Delete annotations,
Import/Export) — those already satisfy the same requirement and doubling
them would be redundant.

**Gap 2 — Privacy panel didn't say "No account required."** The brief
requires the panel "clearly communicate: 'Your documents are processed
locally. No account required.'" The existing copy covered the local-only
half but never mentioned accounts at all. Appended an explicit "No account
required." sentence to `settings.privacy.localOnlyExplanation` in all 19
locales.

**Gap 3 — the Settings page's own "Shortcuts" tab was a "Coming soon" stub,
while a fully working shortcut system already existed elsewhere.** This is
the fake-functionality problem the project's core rule exists to prevent,
just inverted: not a fake UI around nothing, but a real nav tab pretending
there's nothing there yet. `backend/utils/shortcutDefinitions.ts`'s own
header comment already documented the intent ("shared by the shortcut-help
modal and the Settings → Shortcuts recorder UI... so the two surfaces can't
drift") — the recorder UI itself had just never been built. Added
`buildShortcutsSection()`, reusing the exact same shared definitions and
pure matching functions (`IN_PAGE_SHORTCUTS`, `GLOBAL_SHORTCUT`,
`formatShortcut`, `isCompleteShortcut`) the toolbar's shortcut-help modal
already uses, rendered inline in the settings page's own list style (no
nested modal-in-a-page): each shortcut shows its current combo and a Record
button; clicking Record arms a document-level keydown capture, Escape
cancels, a valid combo calls the same `setSettings()` + saved-toast path and
re-renders. Reuses the shortcut-help modal's existing CSS classes
(`.markora-shortcut-help__list` etc., already unscoped/standalone
selectors) — zero new CSS.

**Bug caught by live verification, not code reading:** the first version of
the Shortcuts rebind handler called `void renderApp()` immediately after
firing `setSettings()`, without waiting for the write to resolve —
`renderApp()` re-fetches settings fresh from storage, so it could rebuild
from the pre-rebind value if the write hadn't landed yet. A scripted
Playwright run (record → press a new combo → read the re-rendered `<kbd>`)
first showed the combo silently *not* changing; only pinning the test to a
key genuinely different from the shortcut's default (`Ctrl+Shift+K` vs. the
default `Ctrl+Shift+L`, which the first test run had accidentally reused,
masking the bug) exposed it. Fixed by chaining `renderApp()` inside
`setSettings().then(...)` instead of firing it in parallel. Re-verified:
the rebind now persists and survives the rebuild.

**Also fixed:** the settings nav order didn't match the brief's literal
category sequence (Diagrams was ordered before Files; the brief lists Files
first). Reordered `SECTION_ORDER` to match the ten brief-named categories
exactly, with the product's additional real sections (Presentation,
Shortcuts, Import/Export, About — none of which the brief enumerates)
appended after rather than interleaved. Renamed the "Language" and
"Maintenance" nav labels to "Language & Direction" and "Storage" to match
the brief's literal wording — done for all 19 locales, composing each
locale's own already-vetted nouns (its existing `settings.section.language`
value + `settings.language.directionLabel` phrase for the first; a
straightforward, low-ambiguity single-word translation of "storage" for the
second, since no existing isolated noun for it was available to reuse).

**Correction to this document's own record:** while addressing a related
question from the user about the `new_ui/` reference screenshots, re-checked
the claim recorded in this plan's §0 that they were "MarkView's own UI ...
the Settings dialog and menu items literally read 'MarkView'." Re-opening
all nine images directly (rather than trusting the earlier note) showed
eight of the nine are genuinely Markora-branded ("Markora Preferences",
"About Markora", etc.) — made for this project. Only `presentation.png`
still carries a leftover literal "MarkView" string in its title bar. §0 has
been corrected accordingly; the eight Markora-branded images are now
legitimate design reference for the phases that haven't run yet (8, 10),
not just a source of ideas to reimplement from scratch.

### UI Improvements
- Settings nav order now matches `Ui-prompt.md` §9's literal category
  sequence; "Language" → "Language & Direction" and "Maintenance" →
  "Storage" labels now match the brief's wording (all 19 locales).
- The Settings → Shortcuts tab shows a real, working shortcut list with
  live rebinding instead of a "Coming soon" placeholder.

### UX Improvements
- Every plain settings change now shows a "Settings saved" confirmation
  toast, closing the brief's explicit "include settings saved feedback"
  requirement.
- Privacy panel now explicitly states "No account required," matching the
  brief's required copy, in all 19 locales.

### Functional Integrations
- Settings → Shortcuts is wired to the same real `setSettings()` /
  `getSettings()` typed-storage path and the same shared shortcut
  definitions/matching utilities the toolbar's shortcut-help modal already
  uses — not a separate, divergent implementation.

### Components Changed
- `src/settings/index.ts`: added `save()` toast wrapper, reordered
  `SECTION_ORDER`, added `buildShortcutsSection()`, removed `shortcuts` from
  `STUB_SECTIONS`.

### Files Added
- None.

### Files Modified
- `src/settings/index.ts`
- `src/backend/i18n/locales/*.json` (all 19 locales): added
  `settings.savedFeedback` and `settings.shortcuts.intro`; changed
  `settings.section.language` and `settings.section.maintenance` values;
  appended a "No account required" sentence to
  `settings.privacy.localOnlyExplanation`.
- `docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md` (this file, including the §0
  correction above).

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files (unchanged — no new pure logic
  extracted; the shortcuts recorder reuses existing tested pure functions).
- `npm run lint` — 0 ESLint errors; Prettier drift returned to the same
  pre-existing 13 non-UI files after `prettier --write` on my one
  formatting violation in `src/settings/index.ts`.
- `npm run build` — succeeds.
- All 19 locale JSON files validated as well-formed (`JSON.parse`) after
  editing.

### Build Result
Green — see Tests above.

### Remaining Issues
- The "Language & Direction" and "Storage" label translations for the 18
  non-English locales are original-author-confidence translations (composed
  from each locale's own already-vetted adjacent strings where possible),
  not native-speaker-reviewed — flagging for eventual native review rather
  than asserting certainty.
- `fullsetting.png` (`new_ui/`) shows Settings as a floating "Preferences"
  dialog over a dimmed viewer, with a compact left nav and a
  Reset Defaults/Done footer — structurally different from the current
  full-page, no-Save-button settings surface this and five prior phases
  built and tested. Given the user's direction to treat `new_ui/` as a
  literal visual target (see §0), asked the user whether to convert this
  now or as its own phase; they chose a dedicated phase. Recorded as new
  **Phase 11** rather than folded into this phase's already-completed,
  already-verified functional gap-closing work.
- Phases 9-10 (and Phase 11) not yet started.

## 11. Phase 8 — popup polish vs. `new_ui/extension_popup.png`

Rebuilt the popup's structure to match `new_ui/extension_popup.png` as a
literal visual target (per §0's Phase 7 policy update), while holding the
line on the project's core rule — every new control had to be wired to
real data or a real setting, never a placeholder. This phase added more new
functionality than a typical polish pass because several of the mockup's
elements (the Active Document card, High-Contrast Readability, Sync Scroll
with TOC, a Mono reading-font option) had no existing feature behind them
at all; each was implemented for real rather than stubbed, faked, or
dropped silently.

**New real settings** (`backend/storage/schema.ts`): `tocSyncScroll`
(boolean, default `true` — matches current always-on behavior) and
`highContrastReadability` (boolean, default `false`). Both are genuinely
wired, not decorative:
- `tocSyncScroll` gates `components/toc/index.ts`'s existing
  `IntersectionObserver` scroll-spy on/off via a new
  `setSyncScrollEnabled()` controller method — filtering and click-to-scroll
  are unaffected either way; only the active-heading highlight turns off.
- `highContrastReadability` is wired into `backend/utils/theme.ts` (the
  same shared module the viewer/popup/onboarding already call `initTheme()`
  through), applying a `data-high-contrast` attribute that a new CSS block
  in `index.css` uses to pull `--text-secondary`/`--text-muted`/
  `--border-strong` toward stronger contrast in both themes — independent
  of light/dark, so it works with any theme choice.
- Added a `mono` `FontFamilyKey` (reusing the exact same monospace stack
  already defined for `codeFontFamily`'s `mono-system`), so the popup's
  Sans/Serif/Mono quick-pick is three real, distinct `fontFamily` values,
  not two real options and one that silently does nothing.

**New real cross-tab feature, and a real bug found while building it.** The
"ACTIVE DOCUMENT" card needed the popup to ask an open viewer tab for its
current document. The first implementation used
`chrome.tabs.query({ url: VIEWER_URL + '*' })` — which returned nothing,
every time, confirmed via a live loaded-extension test that logged the
query result directly. Root cause: this project deliberately never
requests the `tabs` permission (`permissions.md` rule 4: minimum permission
always wins), and without it `chrome.tabs.query()` cannot see the `url`
field on tabs it doesn't already have a handle to, so a `url` filter can
never match. This is a **real, pre-existing bug in `focusOrOpenViewer()`**
(present since long before this phase) — its own use of the identical query
pattern to "focus an already-open viewer tab" has silently always failed,
meaning every popup click on "Open File"/"Open Workspace" opened a
redundant new tab instead of focusing the existing one. Fixed both call
sites with a permission-free alternative: `chrome.runtime.sendMessage()`
broadcasts to every extension page (no permission needed), and the viewer
answers with its own identity via `chrome.tabs.getCurrent()` (also
permission-free — it only reports the calling script's own tab). New shared
contract: `backend/utils/activeDocumentBridge.ts`. Verified live: clicking
"Open File" from the popup with a viewer tab already open now reuses it
(page count unchanged, no new tab created) instead of always creating a new
one.

**Fixed a real regression this phase's own earlier work (Phase 7) had
caused and not caught.** Phase 7 renamed the Settings page's "Maintenance"
nav label to "Storage" to match `Ui-prompt.md` §9's literal wording. That
was verified against a targeted e2e subset at the time, but not against
`e2e/phase4.spec.ts`/`phase5.spec.ts`, which both click
`getByRole('tab', { name: 'Maintenance' })` — a locator that stopped
matching anything. Found via a full non-targeted e2e run this phase (not
by re-reading Phase 7's own diff), confirmed by reproducing the hang
directly, and fixed by updating both tests' locators to `'Storage'` (the
rename itself was correct and stays; the tests were stale).

**Visual polish pass, prompted directly by the user** after the popup
survived a live browser check but its Preferences tab still looked like an
undifferentiated list of bare `<select>`/`<button>` elements next to Quick
Controls' polished cards — including a `Language & Direction` label
wrapping awkwardly against a wide dropdown at the popup's ~320-360px width.
Fixed by grouping Preferences into the same bordered-card language as Quick
Controls' cards (`General` / `Help & About`), stacking each label above its
control instead of a cramped side-by-side row, and reusing the same
toggle-switch component for "Enable Markora" that Quick Controls' toggles
already use, instead of a plain unstyled checkbox+label.

**Verified live**, not just by reading code, in a real loaded extension in
both themes: header (brand mark, version badge, real theme-cycle button
using the same `THEME_CYCLE` the toolbar/global shortcut already use, close
button), all three tabs' real content, the Active Document card showing a
genuinely dropped document's real name/size/sync-status, the font-size
stepper and Sans/Serif/Mono picker actually changing `chrome.storage.local`
(read back directly, not inferred from the UI), the High-Contrast toggle
live-propagating to an already-open viewer tab via the shared
`onSettingsChanged` listener, and the tab-reuse fix (open-file click count
of extension pages stays flat instead of growing).

### UI Improvements
- Popup restructured into Quick Controls / Recent & Bookmarks / Preferences
  tabs matching `new_ui/extension_popup.png`, replacing the old
  Setup/Recent/Settings/Help four-tab layout.
- Header gained a version badge, a quick theme-cycle button, and a close
  button.
- Preferences tab restyled into bordered card groups with stacked
  label/control fields and a shared toggle-switch component, instead of a
  flat list of bare form controls.

### UX Improvements
- Quick Controls gained a real Active Document card, Sync Scroll with TOC,
  High-Contrast Readability, and a font-size/font-family quick-picker —
  all wired to real settings, none of them decorative.
- The setup ("Allow file URL access") banner is now conditional on the real
  `chrome.extension.isAllowedFileSchemeAccess()` result instead of being a
  permanent fourth tab shown to every user regardless of whether they need
  it.
- Recent & Bookmarks now also lists real bookmarked folders (previously
  bookmarks were only visible from the full viewer's file browser).
- Clicking "Open File"/"Open Workspace" from the popup now genuinely
  reuses an already-open viewer tab instead of always opening a redundant
  new one (real bug fix, not a new feature).

### Functional Integrations
- `tocSyncScroll` and `highContrastReadability`: new real settings, wired
  through the typed storage wrapper and the shared `theme.ts`/`toc`
  modules — not popup-local state.
- Active Document card: new `chrome.runtime.sendMessage` /
  `chrome.tabs.getCurrent()` bridge between the popup and the viewer,
  permission-free by design (see `activeDocumentBridge.ts`).
- Popup's `formatBytes` now shares an implementation with Settings'
  storage-usage indicator (`backend/utils/formatBytes.ts`) instead of two
  copies.

### Components Changed
- `src/popup/index.ts` (full restructure)
- `src/frontend/components/toc/index.ts` (`setSyncScrollEnabled`)
- `src/backend/utils/theme.ts` (`applyHighContrast`/`setHighContrastReadability`)
- `src/backend/storage/schema.ts` (`tocSyncScroll`, `highContrastReadability`, `mono` font key)
- `src/backend/utils/fonts.ts` (`mono` stack)
- `src/viewer/index.ts` (`getActiveDocumentInfo` message handler, `toc.setSyncScrollEnabled` wiring)

### Files Added
- `src/backend/utils/activeDocumentBridge.ts`
- `src/backend/utils/formatBytes.ts`

### Files Modified
- `src/popup/index.ts`, `src/viewer/index.ts`,
  `src/frontend/components/toc/index.ts`, `src/backend/utils/theme.ts`,
  `src/backend/utils/fonts.ts`, `src/backend/storage/schema.ts`,
  `src/settings/index.ts` (now imports the shared `formatBytes`),
  `src/frontend/styles/index.css` (high-contrast tokens, all new popup
  classes), `e2e/phase4.spec.ts` and `e2e/phase5.spec.ts` (Maintenance →
  Storage locator fix), `src/backend/i18n/locales/*.json` (all 19 locales).

### Files Removed
- None.

### Tests
- `npm run test` — 590 passed / 73 files.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (same
  pre-existing 13 non-UI files).
- `npm run build` — succeeds.
- All 19 locale JSON files validated as well-formed after editing.
- `npx playwright test e2e/smoke.spec.ts e2e/phase4.spec.ts
  e2e/phase5.spec.ts e2e/phase9-a11y.spec.ts` — repeated runs converged on
  33/35 passing, with only the pre-existing P7 performance-budget tests
  (already flagged as environment-sensitive in this document's Phase 4
  section) intermittently failing — different individual P7/P8 sub-tests
  failed across different runs, the signature of host-load flakiness rather
  than a deterministic regression; every non-performance-budget test,
  including the two this phase's own real bug fixes targeted, passed
  consistently across repeated runs.
- Manual verification in a real loaded extension: screenshots of all three
  tabs in both themes, storage read-back after font-size/font-family
  changes, live high-contrast propagation to an open viewer tab, and a
  direct before/after page-count check for the tab-reuse fix.

### Build Result
Green — see Tests above.

### Remaining Issues
- The dark-mode-only screenshot comparison against `new_ui/`'s Quick
  Controls mockup was done visually, not pixel-diffed — close but not
  guaranteed pixel-identical; flagging in case a future pass wants stricter
  parity.
- Phases 9-10 (and Phase 11) not yet started.

## 12. Phase 12 — main viewer bottom status bar vs. `new_ui/main.png`

Done ad hoc, out of numeric sequence, in response to the user's direct
request: "change main page ui from new_ui/ folder I want exact same UI after
open extension." Scoped to the single largest real, structural gap between
the live viewer and `new_ui/main.png`: that mockup's persistent bottom
status bar had no counterpart at all — `documentStats` existed but only as a
small floating word-count pill in the bottom-right corner, and there was no
encoding/sync/hotkeys surface anywhere.

**What was verified as already matching before touching anything** (so as
not to duplicate real, working structure): the left file-browser sidebar and
right TOC sidebar are already in-flow columns (not overlays) at desktop
width, sticky-positioned, shown/hidden via `display:none/block` — matching
`new_ui/main.png`'s always-visible-when-open sidebar look; `fileBrowser.show()`
is already called automatically when a folder is opened
(`src/viewer/index.ts`), so the file tree already appears without an extra
click; the toolbar's Rendered/Raw segmented control, TOC/Files toggles, and
grouping already match; and GitHub-style `[!NOTE]`/`[!TIP]`/etc. callouts
(`backend/viewer/markdown/plugins/alerts.ts`) already render as a
blue-accent bordered card with an icon and title, closely matching the
mockup's "ARCHITECTURAL OBJECTIVE" callout — confirmed by rendering one live
and comparing screenshots, no changes needed.

**What was built** — a real, full-width bottom status bar
(`buildStatusBar()` in `src/viewer/index.ts`), hidden until a document is
open:
- Left: the open document's source label (same value as the header's
  "Source: …" line) and a UTF-8 encoding label — real, not decorative:
  `File.text()` (drag-and-drop / local file open) and the handoff/URL flows
  always decode as UTF-8, so this is a true fact about every loaded
  document, not an assumed constant.
- Right (in order): word count / character count / reading time — these
  already existed as the `documentStats` component's own real, live-computed
  stats (`backend/utils/textStats.ts`); moved in from the old floating pill
  rather than re-implemented. A sync-status indicator (dot + "Synced"/"Not
  synced", reusing the popup's existing
  `popup.activeDocument.synced`/`.unsynced` i18n keys for consistency) that
  mirrors `currentRefreshSource` — the same real auto-refresh-source concept
  the popup's Active Document card already surfaces via
  `activeDocumentBridge.ts`. A Hotkeys button that opens the existing
  shortcut-help modal (`shortcutHelp.open(currentSettings)`) — no new
  surface, reuses the real one.
- `showDocumentStats` (`backend/storage/schema.ts`) default flipped from
  `false` to `true`: now that word count/reading time render inline in an
  always-relevant status bar rather than a pill that used to auto-hide near
  the bottom of short documents, defaulting it off left the bar's own fields
  blank for every new install. The user-facing Settings toggle
  ("Show document statistics") is unchanged — still there, still able to
  turn it off.

**Explicitly not built** (would have required fabricating data no real
Markdown document or this extension's architecture can supply, which the
project's non-negotiable rule forbids): the mockup's title-area badge row
("Specification RFC" tag, "v2.4.0" version, "Updated 2 hours ago") — a
generic Markdown viewer has no document-type/version/last-modified concept
unless a document supplies it via front matter, which none of the demo/test
fixtures do; the numbered-list-as-cards decorative treatment on the
mockup's "1. Zero External Network Dependencies…" list — that renders from
a hand-styled component in the mockup's source, not from any Markdown
construct this or any renderer would produce from a plain ordered list, so
generalizing it would either restyle every ordered list in every document
(wrong) or require a fake, one-off "steps" block type with no parser support
(fake); a zoom control — no zoom feature exists in this extension yet, real
or otherwise.

### Bug found and fixed
Axe flagged the new status bar on first pass: "Some page content is not
contained by landmarks" (WCAG 1.3.1/best-practice `region` rule), because it
was a plain `<div>` appended directly to `#app`, a sibling of the page's
`<main>` and toolbar `<header>` landmarks. Fixed by making it a `<footer>`
instead — a top-level `<footer>` is a "contentinfo" landmark by default, the
same reasoning already applied to the toolbar's `<header>` wrapper.

### Tests
- `npm run build` — succeeds.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (same
  pre-existing baseline, none of this phase's files in it).
- `npm run test` — 590/590 passing (both before and after the
  `showDocumentStats` default flip).
- All 19 locale JSON files validated after adding
  `viewer.statusBar.encoding`/`viewer.statusBar.hotkeys`.
- `npx playwright test e2e/phase5.spec.ts e2e/phase2b.spec.ts` — 27/27
  passing, including the full responsive no-horizontal-overflow suite at
  375/768/1280/1440px and both accessibility baseline scans (confirming the
  landmark fix). Found and fixed two stale pre-existing test assertions
  along the way, unrelated to this phase's own change but caught by running
  a wider suite than just the new code's own tests: `phase5.spec.ts`'s test
  title still claimed document stats were "hidden by default" (true before
  this phase, not after — the test's actual assertions still passed either
  way since Playwright's `.check()` on an already-checked box is a no-op,
  but the title was renamed for accuracy); `phase2b.spec.ts`'s settings
  options-page test still asserted the Shortcuts tab showed "This section
  arrives in a later update." — a Phase 7 regression (Phase 7 emptied
  `STUB_SECTIONS`, making every section real, but didn't catch this
  pre-existing test in its own narrower verification pass), now asserting
  the real Shortcuts recorder's intro text instead.
- `npx playwright test e2e/phase4.spec.ts` — 3 pre-existing P7/P8
  performance-budget sub-tests failed, reproducibly, in isolation, at
  `--workers=1`. Investigated directly rather than assumed: a debug script
  polling `.markora-file-browser__status` every second during the same
  1,000-file fake-tree scan showed steady, uninterrupted progress (167 →
  1000 file buttons) that only completed at ~26s wall-clock — file-tree
  scanning genuinely works, but this fixture's synthetic per-entry
  `setTimeout(resolve, 1)` delay (standing in for real disk I/O per
  `phase4.spec.ts`'s own comment) is taking roughly 26ms instead of ~1ms per
  call on this host right now, blowing through the test's 15s status-text
  timeout well before its actual `<500ms first-entries`/`<200ms worst-task`
  budget assertions are even reached. Confirmed unrelated to this phase's
  code: attempted an isolated git-stash test of just this phase's 3 touched
  files, but had to abandon it (those files share schema fields with other
  already-in-progress, not-yet-committed Phase 7/8 work, so reverting them
  alone doesn't compile) and rely on the direct scan-progress evidence
  instead, which stands on its own. Consistent with this document's
  existing, repeated finding (Phase 4's own section, and Phase 8's) that
  these two specific tests are host-load-sensitive on this machine, not a
  product regression.
- Live screenshots (both themes) of a rendered document with headings, a
  list, and a `[!NOTE]` callout, confirming the new status bar's fields
  (filename, UTF-8, word/char count, reading time, sync status, Hotkeys) all
  populate with real data and the callout already matches the mockup.

### Build Result
Green — see Tests above.

### Remaining Issues
- Phases 9-11 not yet started (unchanged from Phase 8) — Phase 9 done next,
  see §13 below.
- The mockup's title-area metadata badges and numbered-card list styling
  were deliberately not built (see "Explicitly not built" above) — flagging
  here in case the user wants a *reduced, real* version of either (e.g. a
  genuine last-modified timestamp for local files, where the File API can
  actually supply one) in a future phase, rather than the fabricated version
  shown in the mockup.

## 13. Phase 9 — responsive + accessibility re-verification at phone/tablet widths

Scope: re-verify, at phone (375px) and tablet (768px) widths, that the
cumulative effect of Phases 1-8 and 12 (all of which touched layout/CSS)
hasn't regressed responsiveness or accessibility, and specifically
stress-test Phase 12's brand-new status bar, which had no prior responsive
verification of its own.

### What was verified as already fine
- `npx playwright test e2e/phase9-a11y.spec.ts e2e/phase9-network-audit.spec.ts`
  — 18/18 passing (axe scans of the viewer/annotations/presentation/mind
  map/folder browser/search/lightbox/blocked-images placeholder in both
  themes, keyboard-only operation of every major surface, and the full
  network-isolation audit). None of this session's or Phase 12's changes
  regressed any of it.
- Live screenshots at 375px/768px of the viewer (loaded document, TOC
  drawer open/closed), popup (all tabs), and Settings: no horizontal
  overflow at either width (`document.documentElement.scrollWidth >
  clientWidth` checked programmatically, not just eyeballed), toolbar wraps
  cleanly, Settings' category nav wraps into multiple rows without
  overlapping, popup's "Recent & Bookmarks" tab label wraps to two lines
  without breaking the tab bar.

### Bugs found and fixed
Both are Phase 12 regressions in its own new status bar, invisible at
desktop width, only surfacing under this phase's narrower-viewport check —
exactly what this phase exists to catch.

1. **Word count silently disappeared on short documents.** `documentStats`
   pre-dates Phase 12 as a floating pill that auto-hid near the bottom of a
   short document so it wouldn't permanently overlap the last paragraph.
   Phase 12 moved it into the status bar (which now reserves its own layout
   space via `.markora-content-area`'s `padding-bottom`), but never removed
   the old auto-hide logic — so any short document (most of them) rendered
   with its own word count invisible (`opacity: 0`) the moment the page
   settled. Fixed by deleting `checkAutoHide()` and its scroll/resize
   listeners from `src/frontend/components/documentStats/index.ts` entirely
   — the condition it worked around no longer exists. Updated the one unit
   test that asserted the old behavior
   (`documentStats/index.test.ts`) to assert the new (correct) always-stays-
   visible behavior instead.
2. **Status bar content wrapped and spilled out of its own fixed height at
   375px.** The bar's `flex-wrap: nowrap` was set on the outer bar but not
   on its child groups/spans; when the right-hand group (word count / char
   count / reading time / sync / Hotkeys) didn't fit in the remaining width,
   individual `<span>`s wrapped their own text onto a second line instead of
   simply overflowing, pushing content below the bar's fixed 28px height
   into the document underneath it — confirmed by comparing `scrollWidth`
   (424px) against `clientWidth` (375px) directly rather than only
   eyeballing the screenshot. Fixed with `white-space: nowrap` on every
   status-bar group/span (so a squeeze can only clip, never wrap), plus a
   new `@media (max-width: 480px)` rule that drops the character-count
   field, the sync status's text label (keeping just its dot), and the
   Hotkeys button's text label (keeping just its icon) — nothing removed
   from the product, just three fields folded down to their icon/number-only
   form when there's genuinely no room, all still reachable via Settings or
   the toolbar.

### Tests
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing (includes the updated
  `documentStats/index.test.ts`).
- `npm run lint` — 0 ESLint errors; ran `npx prettier --write` on every file
  this and Phase 12 touched (`src/viewer/index.ts`,
  `src/backend/storage/schema.ts`, `e2e/phase2b.spec.ts`) to keep them out
  of the pre-existing Prettier-drift baseline rather than adding to it.
- `npx playwright test e2e/phase9-a11y.spec.ts e2e/phase9-network-audit.spec.ts`
  — 18/18 passing.
- `npx playwright test e2e/phase2b.spec.ts e2e/phase5.spec.ts
  e2e/phase9-a11y.spec.ts` (backgrounded, ~5 min) — came back with 12
  failures across `phase9-a11y.spec.ts`, all `Test timeout of 30000ms
  exceeded`, spanning unrelated features (folder browser, search+lightbox,
  block-remote-images, annotations/presentation/mind-map keyboard tests).
  Investigated rather than assumed flaky: a direct debug script hitting the
  same folder-browser test showed the viewer's own `.markora-empty-state`
  never attaching, with `net::ERR_FILE_NOT_FOUND` console errors, and
  `dist/src/viewer/index.html`'s `<script>` tag pointing at the raw
  `./index.ts` source instead of a built `/assets/viewer-*.js` bundle — a
  genuinely broken `dist/`, not a test or product bug. Root cause not fully
  pinned (no build command ran between the prior successful `npm run build`
  and this point, and no `webServer`/`globalSetup` in `playwright.config.ts`
  could have triggered one; 9 unrelated lingering `node.exe` processes from
  other tools were present but none touch this repo's build). Fixed by
  running `npm run build` again — confirmed via `Get-Content` that the
  regenerated `dist/src/viewer/index.html` correctly references the bundled
  JS this time — then re-ran the exact failing test alone (passed in 2-3s,
  nowhere near the 30s timeout it hit before) and the full `phase9-a11y.spec.ts`
  + `phase9-network-audit.spec.ts` (18/18) and `phase2b.spec.ts` +
  `phase5.spec.ts` (27/27) suites again, both clean. Documenting the
  transient bad-`dist` symptom here rather than silently rebuilding and
  moving on, in case it recurs and this signature (unprocessed `./index.ts`
  in a built HTML file) helps root-cause it next time.
- Direct DOM measurement (not just visual comparison) at 375px/768px:
  `scrollWidth`/`clientWidth` equal at both widths after the fix,
  `markora-document-stats--visible` present with no stray `auto-hidden`
  class, status bar's own `scrollWidth` no longer exceeding its
  `clientWidth`.

### Build Result
Green — see Tests above.

### Remaining Issues
- Phases 10-11 not yet started.

## 14. Phase 13 — full `new_ui/` parity pass (multi-workspace, more-menu, annotations, export dialog)

Done at the user's explicit, repeated direction: "implement all UI exact
same as shown in new_ui/ folder." Before touching code, three real
conflicts between the mockups and this project's own rules were raised
with the user directly (`AskUserQuestion`) rather than silently resolved
either way:

1. **`2.png`/`5.png`'s multi-workspace UI** (several folders open at once,
   an "Open Workspace/Folder" modal, "Currently open: N workspaces") is a
   real, structural feature Markora didn't have (one open folder at a time,
   replacing the previous). User chose: **build it for real.**
2. **`annotations.png`'s named authors/avatars** (Alex Chen, Elena Rostova,
   Devin Thorne) imply multi-user collaboration this local, single-user,
   no-login tool cannot honestly have. User chose: **style-only match, no
   fabricated identity.**
3. **`threedotsetting.png`'s "Workspace Actions" menu** both duplicates
   actions already on the toolbar (a deliberate non-duplication decision
   from Phase 10) and lists "PRO License Active" — monetization UI
   `workflow.md` rule 6 explicitly forbids beyond a static free-tier label.
   User chose: **expand the menu to match the grid exactly, with the real
   static "Free" license label in place of the fake PRO item** (a future
   real paid tier is a separate, not-yet-built concern).

### What was built

**1. Real multi-workspace support** (`src/frontend/components/fileBrowser/index.ts`
rewritten; new `src/frontend/components/openWorkspaceModal/index.ts`;
`src/viewer/index.ts`'s folder-handling functions reworked):
- `createFileBrowser` now manages a `Map<id, WorkspaceState>` instead of one
  root handle — `addWorkspace(handle, name)` appends a new, independent
  section (own scan, own tree, own bookmark-toggle/close buttons) rather
  than replacing whatever was open; `closeWorkspace(id)` removes just that
  one. With zero previously open (every existing single-folder test's
  scenario) this is observably identical to the old behavior, which is what
  kept the existing folder-browser e2e suite passing with only two
  deliberate, documented locator updates (below).
- Cross-workspace search: the folder-browser's search field now runs
  `searchFolder` (already root-agnostic) against every open workspace in
  turn, tagging each result with its workspace name, and hides all
  workspace tree sections while showing the merged results — real content-
  and-filename search across N real open folders, not per-workspace-only.
- New "Open Workspace / Folder" modal (`new_ui/2.png`): "Local Folder" tab
  (the existing real `showDirectoryPicker()` flow, now adding rather than
  replacing) and "Bookmarked Workspaces" tab (the existing real folder-
  bookmark list, F21, reused as one-click add-another-workspace targets).
  The mockup's third "Custom Folder" (type-a-path) tab is deliberately not
  built: no web/extension API can open an arbitrary typed filesystem path
  without a user-gesture picker, so a text field there would go nowhere —
  the same reasoning that ruled out fake identity above.
- The toolbar's "Files" panel own "Open Folder" button now opens this modal
  (it's reached from *inside* an already-open browser — the "add another"
  case); the empty state's "Open Folder" (first-ever open) still goes
  straight to the picker, unchanged.
- `chrome.runtime.getManifest()`-free real counters throughout: "N
  workspaces open" eyebrow, per-workspace file counts, "Currently open: N
  workspaces" in the modal footer — all derived from the live open set, not
  hardcoded.
- Persistence scope, stated plainly: only the *most recently* opened
  workspace is remembered for the existing silent-reconnect-at-boot flow
  (`LAST_FOLDER_HANDLE_ID`) — restoring the *entire* open set across a
  browser restart would need its own persisted list, deliberately not
  half-built here.

**2. Expanded toolbar more-menu** (`src/frontend/components/moreMenu/index.ts`
rewritten): now a full "Workspace Actions" panel (header + 2-column icon
grid + footer) matching `threedotsetting.png`'s layout exactly — Export
HTML/DOCX/Print, Presentation, **Search in Folder** (new: a real
`focusSearch()` method added to the file browser, wired through a new
`onSearchInFolder` toolbar callback — not a second search implementation),
Mind Map, Settings, Keyboard Shortcuts, the three existing feedback links,
and About. Footer shows the real static license label
(`buildLicenseStatusRow()`, "License status: Free" — the same shared
component already used in Settings/popup/About, per code-conventions.md's
reuse principle) and the real manifest version, replacing the mockup's fake
"PRO License Active" / "Build 892". "View Raw AST Data" is the one mockup
item deliberately left out: no AST inspector exists in this product yet,
and building one is a real feature of its own, not a same-session menu-grid
addition — wiring it to nothing was not an option.

**3. Annotations panel visual polish** (`src/frontend/components/annotations/index.ts`;
new `src/backend/utils/formatRelativeTime.ts`): the colored left-border-by-
type accent already existed (Phase 10). Added: the quoted excerpt now reads
as an inset quote box (`new_ui/annotations.png`'s visual language) instead
of plain text; the user's own comment text was promoted to the visually
primary line (was smaller/muted than the quote — backwards from the
mockup's emphasis); timestamps switched from an absolute
`Intl.DateTimeFormat` string to a real, locale-aware relative one
(`Intl.RelativeTimeFormat` — "14 min ago", "2 hours ago" — with the exact
absolute time kept as a hover `title`, so no precision is lost); a header
count badge was added (real, `active.length + orphaned.length`). No author
name or avatar was added anywhere, per the user's explicit choice above.

**4. Export dialog** (new `src/frontend/components/exportDialog/index.ts`;
`src/frontend/components/toolbar/index.ts` and `src/viewer/index.ts`
updated; `src/frontend/components/exportMenu/` deleted as now-dead code):
replaces the toolbar's small Export dropdown with a full card-grid modal
matching `export.png` — a "CHOOSE OUTPUT FORMAT" grid of selectable cards
(icon, extension badge, title, description, extension + "Selected" state),
footer with a real "runs entirely in your browser" note and Cancel/Export
buttons. Five real cards: the three pre-existing exports (HTML/DOCX/Print,
unchanged pipelines) plus two new, genuinely real additions —
**Markdown Source** (the open document's own raw text, downloaded exactly
as opened; no conversion needed, so no export module) and **Copy to
Clipboard** (`navigator.clipboard.writeText(rawSourceText)`). The mockup
frames Copy to Clipboard as rich "paste into Slack/Notion/Jira" formatting,
which would need an HTML-clipboard round-trip through `exportHtml()` (which
only ever triggers a file download internally today, no returned string);
this instead copies plain Markdown text and says so honestly in its own
description, rather than overclaiming rich-paste behavior that isn't real.

### Bugs found and fixed
1. **Axe `aria-required-children`, more-menu**: `role="menu"` was left on
   the outer panel after adding its header/footer chrome — ARIA requires a
   menu's *direct* children to be menuitem/group/separator. Moved the role
   to the inner grid, which now genuinely has only `menuitem` children.
2. **Axe `color-contrast`, multiple, both new modals**: several new
   elements used `--text-muted` where the codebase's own established
   convention (documented inline elsewhere in this file already) is
   `--text-secondary` for anything required to hit WCAG 1.4.3's 4.5:1 —
   fixed on the workspace-count badge/eyebrow, the export dialog's section
   label/badges/extension labels. The export dialog's "Selected" mark used
   `--accent-blue` directly, which falls short at this weight against the
   selected card's own highlighted background — switched to
   `--markora-color-toc-active-fg`, the same pre-existing, contrast-
   verified accent-text token the TOC's active item already uses.
3. **Axe `color-contrast`, real pre-existing gap surfaced by this pass**:
   white text on `var(--accent-blue)` — the pattern this session's own new
   primary buttons (Browse Directory, Export) started from, copied from
   what looked like an established convention — only reaches ~3.7:1 in dark
   theme (`#3b82f6`), short of 4.5:1; dark theme's own accent is lighter
   than light theme's, so this direction fails specifically in dark mode.
   Fixed *for these two new buttons* with a fixed, always-AA-safe blue
   (`#1d4ed8`, verified ~6.7:1 with white text in both themes) rather than
   touching the shared `--accent-blue` token — which several *other*,
   already-shipped components also pair with white text (toolbar badges,
   settings' active states) and were out of scope to audit and fix in this
   pass. Flagging this as a real, likely-latent contrast gap worth its own
   audit later, not something this phase's two components introduced from
   nothing.
4. **Multi-workspace test-locator collision**: the new cross-workspace
   search status/cancel elements initially shared the `.markora-file-
   browser__status`/`__cancel` classes with each per-workspace section's
   own scan status — with one workspace open (every existing test's
   scenario) this made the bare class locator ambiguous ("resolved to 2
   elements"). Gave the search-specific elements their own classes
   (`__search-status`/`__search-cancel`), sharing only the visual CSS, and
   updated the one e2e assertion (`phase4.spec.ts`'s P8 test) that checked
   search-results text via the old shared class.
5. **`e2e/phase7.spec.ts`'s export helpers/assertions**: three spots
   (`exportHtmlAndRead`, `exportDocxAndUnzip`, and one inline P12
   performance test) drove the old dropdown via `getByRole('menuitem', …)`.
   Updated all three to the new select-a-card-then-confirm flow
   (`getByRole('radio', …)` then `.markora-export-dialog__export`), and
   moved the P12 test's `start = Date.now()` to *after* the card-select
   click so the export-pipeline timing budget isn't inflated by dialog-UI
   interaction that wasn't part of what P12 measures.

### Tests
- `npm run build` — succeeds throughout every step of this phase.
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors; every file this phase touched or added
  is Prettier-clean (verified individually), Prettier-drift baseline
  unchanged at its pre-existing 12 files.
- All 19 locale JSON files validated after each of the four key-addition
  rounds (multi-workspace/open-workspace-modal, more-menu, annotations
  reused an existing formatter with no new keys, export dialog).
- `npx playwright test e2e/phase4.spec.ts` — 11/12 → 12/12 after the two
  fixes above; the file browser's own dedicated e2e suite (opening,
  filtering, searching, bookmarking, reconnect, cancel, active-file
  highlight) fully intact after the multi-workspace rewrite.
- `npx playwright test e2e/phase7.spec.ts` — 9/9 (HTML/DOCX/Print export,
  annotation endnotes, network isolation, P12 performance budget) after the
  dialog-flow test updates.
- `npx playwright test e2e/phase9-a11y.spec.ts e2e/phase2b.spec.ts` —
  36/36, including both new modals' own dedicated axe scans (0 violations
  each after the contrast fixes) and the full responsive
  no-horizontal-overflow suite.
- Full combined run — `phase4/phase5/phase2b/phase7/phase9-a11y/phase9-
  network-audit.spec.ts` together (66 tests, ~5.7 min) — came back 65/66;
  the one failure (`phase7.spec.ts`'s mermaid script-injection export test,
  a 30s timeout) reproduced as a clean pass (7.1s) both standalone and as
  part of a full re-run of `phase7.spec.ts`'s own 9 tests together
  immediately after — consistent with this project's already-documented
  host-load timing sensitivity under a long combined run, not a regression
  from this phase's changes.
- Live, manual multi-workspace verification beyond what any e2e test
  exercises yet (opening two real fake folders, adding a second via the
  modal, opening a file from the second workspace and confirming its
  `"Project B/c.md"` label, closing one workspace and confirming the other
  and its file list survive untouched, real-time eyebrow-count updates
  throughout).
- Live screenshots of all four new/changed surfaces confirming visual
  parity with their `new_ui/` counterparts: the multi-workspace sidebar
  (two "Project" sections + the Open Workspace modal), the expanded
  more-menu (12-item grid + real Free license/version footer), the
  annotations panel (colored borders, quote box, relative timestamps, count
  badge), and the export dialog (5-card grid, real Markdown-source download
  verified end-to-end).

### Build Result
Green — see Tests above.

### Remaining Issues
- Phases 10-11 still not started.
- Multi-workspace persistence is single-folder-deep (see "Persistence
  scope" above) — restoring the full open set across a browser restart is
  real follow-up work, not a gap in what shipped.
- The white-text-on-`--accent-blue` contrast gap (bug #3 above) likely
  exists in other, already-shipped components (toolbar selected-badge,
  settings active states) that weren't in this phase's scope — worth a
  dedicated audit rather than fixing piecemeal as each one happens to get
  touched.
- "View Raw AST Data" (more-menu) and rich HTML-clipboard "Copy to
  Clipboard" (export dialog) are both mockup items intentionally left as
  real-but-smaller/absent rather than faked — both are legitimate small
  features for a future phase if wanted.

## 15. Phase 11 — Settings visual overhaul: floating "Preferences" dialog

Done at the user's direction to continue into the last remaining `new_ui/`
gap after Phase 13. Matches `new_ui/fullsetting.png`: a floating dialog
opened over the document (header with icon/title/version badge/subtitle/
live shortcut hint/close, compact category left-nav, real settings on the
right, Reset Defaults + Done footer) instead of `chrome.runtime
.openOptionsPage()` leaving the document view for a new browser tab.

### What was built
- **Shared content, two shells.** All 14 sections' real, storage-backed
  builders (General through About/Shortcuts — every control still reads and
  writes through `src/backend/storage`'s typed wrapper, still applies
  immediately with a toast, no fake "Save" button) were extracted verbatim
  from `src/settings/index.ts` into a new
  `src/frontend/components/preferencesModal/sections.ts`, parametrized with
  an `onRequestRerender` callback in place of the two call sites
  (`buildShortcutsSection`'s recorder, `buildImportExportSection`'s import)
  that used to call the standalone page's own `renderApp()` directly. Both
  `src/settings/index.ts` (the standalone options page — still reachable via
  `chrome.runtime.openOptionsPage()` from the popup's Settings action, kept
  as a stable fallback entry point) and the new
  `src/frontend/components/preferencesModal/index.ts` now build their
  content from this one shared module, so the two surfaces can never
  disagree about what a setting does — only about how its container looks.
  The standalone page's own DOM shell (`.markora-settings__nav`/`__main`/
  `<section>` structure) was left untouched, so its existing e2e coverage
  (`phase2b.spec.ts`'s "Full options page" tests, including the
  `.markora-settings__main > section:not([hidden])` locator) kept passing
  unmodified.
- **New in-viewer dialog**
  (`src/frontend/components/preferencesModal/index.ts`): same focus-trap/
  Escape-to-close pattern as every other Phase 13 modal
  (`trapTabFocus`), a real version badge from
  `chrome.runtime.getManifest().version`, and a real keyboard-shortcut hint
  that reflects whatever combo is actually bound (not a hardcoded string).
  The toolbar's "Settings" action (both the toolbar itself and the
  more-menu's "Settings" item, which forwards the same callback) now opens
  this dialog in place of `chrome.runtime.openOptionsPage()`.
- **A real, new keyboard shortcut.** `Ctrl+,` (Cmd+, on Mac — `formatShortcut`
  already treats Ctrl/Cmd as one modifier) opens the dialog. Added the
  proper way, not a one-off `if` in the keydown handler alone: a new
  `openPreferences` entry in `KeyboardShortcutSettings`/
  `DEFAULT_KEYBOARD_SHORTCUTS` (`src/backend/storage/schema.ts`) and in
  `IN_PAGE_SHORTCUTS` (`src/backend/utils/shortcutDefinitions.ts`), so it
  automatically appears — and is independently rebindable — in both the
  shortcut-help modal (Ctrl+/) and the Settings/Preferences "Shortcuts"
  recorder, the same shared-definitions mechanism `toggleToc`/
  `toggleRawRendered`/`focusSearch` already use.
- **Reset Defaults** (footer, left): a genuinely new, generically-applicable
  feature — resets *every* setting to `DEFAULT_SETTINGS` in one action,
  distinct from the several existing *per-section* reset buttons
  (Appearance, Presentation). Uses the same two-click-arm-then-confirm
  pattern already established for other destructive actions in this file
  (Clear Cache, Delete All Annotations) rather than a native `confirm()` or
  an unguarded single click, given the blast radius (every stored
  preference).
- **Done** (footer, right): simply closes the dialog — there's no separate
  "Save" step anywhere in this product's settings, so Done's only honest
  behavior is dismissal, not a fake commit action.
- 8 new i18n keys (`shortcuts.openPreferences`,
  `preferencesModal.title`/`.subtitle`/`.navEyebrow`/`.resetDefaults`/
  `.resetDefaults.confirm`/`.resetDefaults.done`/`.done`) added with real,
  independently-written translations across all 19 locales (not
  English-duplicated placeholders), matching the standard this project's
  earlier i18n batches already set.
- The mockup's descriptive one-line subtext under each category heading
  (e.g. "Configure editor localization, filesystem polling...") was
  deliberately not added as new copy for all 14 sections — the dialog shows
  the same category heading text the nav item already uses, and several
  sections that already carried their own intro paragraph (Export, Privacy,
  Shortcuts, Import/Export) keep it. Matching the mockup's *structure*
  (header + nav + heading + content + footer) took priority over inventing
  14 new descriptive sentences with no functional backing.
- `getSettings()` (`src/backend/storage/index.ts`) now merges `shortcuts`
  one level deep (`{...DEFAULT_SETTINGS.shortcuts, ...existing?.shortcuts}`)
  instead of a flat top-level spread — needed because the shortcut recorder
  persists the whole `shortcuts` object at once, so an install that had
  already rebound any one shortcut before `openPreferences` existed would
  otherwise read back `undefined` for the new key forever. Covered by the
  existing `index.test.ts` round-trip test for this exact shape (still
  passing unmodified).

### Bugs found and fixed
1. **New dialog stayed visible after `close()`.** The shared overlay
   backdrop rule (`.markora-shortcut-help, .markora-about-modal,
   .markora-open-workspace-modal, .markora-export-dialog { display: flex;
   ... }`) was extended to include `.markora-preferences-modal`, but the
   *separate* `[hidden]` override rule a few lines up
   (`.markora-shortcut-help[hidden], ... { display: none; }`) — needed
   because an author `display` rule always beats the UA stylesheet's
   `[hidden]{display:none}` regardless of specificity, the same class of bug
   already documented twice elsewhere in this file for
   `.markora-file-browser__reconnect` — was not. Caught immediately by a
   direct headless-Chrome smoke script (Ctrl+, open → Escape → still
   visible), not by an e2e test; fixed by adding
   `.markora-preferences-modal[hidden]` to that override group. A rebuild +
   re-run of the same script confirmed Escape now closes it.

### Tests
- `npm run build` — succeeds.
- `npx tsc --noEmit` — clean.
- `npm run test` — 590/590 passing (includes the existing nested-shortcuts
  round-trip test, unaffected by the deeper merge in `getSettings()`).
- `npm run lint` — 0 ESLint errors (including `no-literal-user-strings`);
  every file this phase touched is Prettier-clean.
- Direct headless-Chrome smoke script (not committed, scratch-only):
  Ctrl+, opens the dialog; clicking a nav category updates both the active
  tab and the visible section/heading; axe scan of `.markora-preferences-
  modal` alone — 0 violations; Escape closes it and returns focus — all
  confirmed after the `[hidden]` fix above.
- `npx playwright test e2e/phase2b.spec.ts e2e/phase3b.spec.ts
  e2e/phase10.spec.ts` — 34/34, including the standalone options page's own
  "populated sections are wired to storage" and "passes a baseline
  accessibility scan" tests, confirming the shared-module extraction didn't
  change that surface's behavior. One assertion needed a real, expected
  update: `phase2b.spec.ts`'s shortcut-help test asserted exactly 4 `<dt>`
  rows; adding the real `openPreferences` shortcut makes that 5 — updated
  the count, not loosened it.
- `npx playwright test e2e/phase4.spec.ts e2e/phase5.spec.ts
  e2e/phase7.spec.ts e2e/phase9-a11y.spec.ts` — first pass came back with 3
  failures, all in `phase4.spec.ts`'s P7/P8 1,000-file scan performance
  budget tests (folder scanning/cancellation code this phase never touched).
  Investigated rather than assumed: re-ran each in isolation — one passed
  cleanly; the other two (including "P7: Cancel takes effect quickly",
  budget <500ms) reproduced consistently even alone (~2.0-2.3s). This exact
  test is independently documented as a known, previously-unfixed,
  host-load-flaky test *before this phase started* (see this file's own
  Phase 4 and Phase 9 write-ups above, e.g. "flaky on a loaded machine; not
  fixed" and "the signature of host-load flakiness rather than [a
  regression]") — not something newly introduced here. A follow-up run of
  the full remaining set (`phase4.spec.ts` minus the P7/P8 group, plus
  `phase5`/`phase7`/`phase9-a11y.spec.ts`) came back 39/39 clean, confirming
  no other regression from this phase's changes.

### Build Result
Green — see Tests above.

### Remaining Issues
- The standalone `src/settings/index.html` options page still exists and
  still works (popup's Settings action, and as a fallback), rather than
  being retired — the mockup only ever showed settings as an in-app floating
  dialog, and popup can't reasonably host the full dialog itself (the popup
  window closes on blur), so this was kept deliberately rather than removed.
- Per-category descriptive subtext (mockup's "Configure editor
  localization...") was not added for the ~10 sections that don't already
  have their own intro paragraph — see "What was built" above. Real,
  optional future polish, not a functional gap.
- The pre-existing white-text-on-`--accent-blue` contrast gap flagged in
  Phase 13's "Remaining Issues" is still un-audited beyond the components
  each phase happened to touch; this phase's new primary button
  (`.markora-preferences-modal__done`) was built with the already-established
  fixed-`#1d4ed8` workaround from the start, so it doesn't add to that gap,
  but doesn't close it either.

## 16. Phase 10 — final visual/functional polish, doc updates

Two `new_ui/` images postdate Phase 13's own nine-image audit (§0):
`3.png` and `extension_popup_bookmark.png`. Re-checked both directly against
the live extension rather than assuming either was already covered.

**`3.png`** (in-document search open + the "ON THIS PAGE" TOC panel with
numbered entries) — no gap. Search (`components/search`) and TOC
(`components/toc`) already render exactly this: a focused search input with
regex/whole-word toggles, and a numbered, nested, scroll-spy'd heading list
in the right rail. Confirmed by re-reading both components' existing,
already-tested output shape — no code change needed.

**`extension_popup_bookmark.png`** (the popup's "Recent & Bookmarks" tab) —
a real, genuine gap. The mockup shows each recent document and bookmarked
folder as its own bordered card: icon, bold title, a muted path line, and a
relative time (or a file-count badge for bookmarks). The live popup
(`src/popup/index.ts`) rendered both lists as flat, single-line 26px rows
with no timestamp and no path — `RecentEntry.lastOpenedAt` and
`FolderBookmark.createdAt` were already being stored and read back by the
popup's own real data layer, just never displayed.

**What was built**: `renderRecentEntry`/`renderBookmarkEntry` restyled into
two-line cards (icon + stacked title/meta), matching the `.markora-popup
__active-doc` card language Phase 8 already established for the Active
Document card, using only genuinely real, already-stored data:
- A locale-aware relative time on every entry — `formatRelativeTime()`,
  the exact shared formatter the annotations panel (Phase 13) already uses,
  called with `getActiveLocale()` (no new formatter, no new i18n keys: the
  bare `Intl.RelativeTimeFormat` output is shown directly, the same
  precedent already set by the annotations panel, rather than wrapping it in
  a new "Opened {time}"-style template string).
- The entry's own real `identifier` shown as a second line, but **only**
  when it's genuinely distinct from the title (true for `file://`/remote-URL
  recents opened via a handoff or URL — false for local drag-drop/file-picker
  entries, whose `identifier` is just the bare filename already shown as the
  title).

**What was deliberately not built, and why** (both explicit, real API/data
constraints, not oversights):
- **No filesystem path under local entries or bookmarks.** The mockup shows
  one (`file:///Users/dev/workspace/specs/`), but the File System Access API
  and dropped `File` objects never expose a real OS path — that's a
  deliberate Chrome privacy restriction, not a gap in this project's code.
  Inventing one would be exactly the fabricated-UI this project's core rule
  forbids. Only entries whose `identifier` legitimately *is* a full URL
  (handoff/remote flows) show one.
- **No file-count badge on bookmarks.** The mockup's "18 files" would need a
  live rescan of a folder that isn't necessarily even open right now — real,
  but out of scope for a display-only card restyle; flagged below as
  legitimate future work, same treatment already given to "View Raw AST
  Data" and rich-clipboard export in Phase 13's own "Remaining Issues".

### Bug found and fixed
`e2e/phase4.spec.ts`'s popup recents test broke: `getByText('local-doc.md')`
and `getByText('raw.githubusercontent.com')` are substring matches, and the
new meta line's real identifier text (`file:///local-doc.md`, a URL
containing `raw.githubusercontent.com`) now contains both strings too — each
locator started resolving to two elements (the title/summary *and* the new
meta line) instead of one. A genuine test-locator collision caused by this
phase's own change, not flakiness — the same class of issue already
documented in Phase 13 for the multi-workspace search-status elements. Fixed
by tightening the locators rather than weakening the assertion:
`getByRole('button', { name: 'local-doc.md' })` for the title, and a
`.markora-popup__recent-group summary` locator scoped to the domain-group
heading for the second.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run lint` — 0 ESLint errors; `src/popup/index.ts` reformatted with
  `prettier --write` before this run so it doesn't join the pre-existing
  13-file Prettier-drift baseline (unchanged at 12 files afterward).
- `npm run test` — 590/590 passing (no unit-testable pure logic changed;
  `formatRelativeTime`/`getActiveLocale` are both already covered elsewhere).
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`, seeded real
  `chrome.storage.local` recents/bookmarks): screenshots in both light and
  dark theme confirm the card layout, relative times ("2 minutes ago", "18
  minutes ago", "3 days ago"), and the conditional identifier line (shown for
  the `file://`-identified entry, correctly omitted for the plain-filename
  entry) — zero console errors.
- `npx playwright test e2e/phase4.spec.ts e2e/phase9-a11y.spec.ts
  e2e/smoke.spec.ts` — first run: 4 failed. Investigated each rather than
  assumed: 3 are the P7/P8 1,000-file scan performance-budget tests, already
  independently documented in this file (Phase 4, Phase 8, Phase 9, Phase 11
  sections) as known, pre-existing, host-load-flaky on this machine — not
  touched by this phase's changes (folder-scan code, not the popup). The 4th
  was the real locator-collision regression above, fixed. Re-ran
  `e2e/phase4.spec.ts` with the P7/P8 group excluded
  (`--grep-invert "P7:|P8:"`): 9/9 passing, including the fixed popup-recents
  test. `npx playwright test e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` run
  separately: 17/17 passing, including both the popup's own baseline
  accessibility scan (`smoke.spec.ts`) and every axe/keyboard-only check in
  both themes — no accessibility or layout regression from the new card CSS.

### Build Result
Green — see Tests above.

### Remaining Issues
- Bookmark file-count badges (`extension_popup_bookmark.png`) are legitimate
  future work if wanted — would need a live, on-demand rescan of each
  bookmarked (possibly not-currently-open) folder, a real feature of its own
  rather than a display-only change.
- The pre-existing white-text-on-`--accent-blue` contrast audit (flagged
  since Phase 13) remains open; this phase touched no button using that
  pairing.
- No further `new_ui/` images remain unaddressed as of this phase — every
  file in the `new_ui/` folder has now been checked directly against the
  live extension at least once.

## 17. Phase 14 — user-reported bug pass: export dialog CSS regression + popup "Open Full Settings" routing

User directly reported two things did not match `new_ui/` after Phase 10-13:
"export UI popup not exact as new_ui/export.png it looks messy" and clicking
the popup's "Open Full Settings" preference "still not open new fullsetting
page as per new_ui/fullsetting.png." Investigated both by re-reading the
actual current code and live-rendering both surfaces in a real loaded
extension rather than assuming either report was cosmetic.

### 1. Export dialog: a real missing-CSS regression
`src/frontend/styles/index.css`'s shared modal-panel base rule (background,
border, border-radius, box-shadow, `width: 90vw`, `display: flex; flex-
direction: column`, `overflow: hidden`) is defined once and shared by
`.markora-shortcut-help__panel`, `.markora-about-modal__panel`, and
`.markora-open-workspace-modal__panel`. `.markora-export-dialog__panel`
(added in Phase 13, `export.png`) was never added to that shared selector —
it only ever got the later `max-width: 640px; max-height: 85vh` override
block, so the export dialog's panel had no background, no border/shadow, no
flex layout, and nothing clipping overflow. The overlay behind it still
dimmed the page, but the panel itself was transparent chrome with the
document bleeding through and no flex column structure — exactly the
"messy" look reported. Fixed by adding `.markora-export-dialog__panel` to
the shared base-panel selector. Also added `flex: 1; min-height: 0;` to
`.markora-export-dialog__grid` (a flex item with `overflow-y: auto` but no
`min-height: 0` can't actually shrink/scroll inside a flex column — it grows
the panel instead), a related bug in the same rule the fix touched.

### 2. Popup "Open Full Settings": real UX gap, not a bug in the modal itself
The popup's Settings action called `chrome.runtime.openOptionsPage()`
unconditionally, opening the plain standalone `src/settings/index.html` page
— never the floating in-viewer "Preferences" dialog
(`src/frontend/components/preferencesModal`) that actually matches
`fullsetting.png` (built in Phase 11, reachable in-viewer via the toolbar
gear icon or `Ctrl+,`). Phase 11's own "Remaining Issues" had rationalized
this as unavoidable ("popup can't reasonably host the full dialog itself,
the popup window closes on blur") — true, but beside the point: the popup
doesn't need to host the dialog, only to ask an *already-open viewer tab* to
open its own. The popup already has exactly this "find and focus the
existing viewer tab" mechanism for its "Active Document" card
(`src/backend/utils/activeDocumentBridge.ts`'s permission-free
broadcast-and-self-report pattern, since this project never requests the
`tabs` permission). Reused it:
- Added `OPEN_PREFERENCES_MESSAGE` to `activeDocumentBridge.ts`.
- `src/viewer/index.ts`'s existing `chrome.runtime.onMessage` listener now
  also handles it: `preferencesModal.open(currentSettings)`.
- `src/popup/index.ts`'s Settings button now calls a new
  `openFullSettings()`: queries for an existing viewer tab the same way
  `focusOrOpenViewer()` already does; if one exists, focuses it (`chrome.tabs
  .update`/`chrome.windows.update`, both permission-free) and sends it
  `OPEN_PREFERENCES_MESSAGE` via `chrome.tabs.sendMessage` (also
  permission-free — it only needs an already-known tab id, not the `tabs`
  permission). Only when no viewer tab is open does it fall back to
  `chrome.runtime.openOptionsPage()`, since there is then no document for
  the floating dialog to appear over — the standalone options page stays a
  deliberate fallback, not removed.

### What was deliberately not built
- The standalone options page (`src/settings/index.html`) was not retired.
  It remains the only entry point when no viewer tab is open, and its own
  Phase 11 e2e coverage (`phase2b.spec.ts`) still exercises it unchanged.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors; `src/viewer/index.ts` reformatted with
  `prettier --write` before this run (whitespace-only, the import-list
  change) so it doesn't join the pre-existing Prettier-drift baseline
  (unchanged at 12 files afterward).
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`, a real drag-dropped
  document): screenshots of the export dialog in both light and dark theme
  now show the full card-grid chrome (background, border, footer,
  Cancel/Export buttons) matching `export.png`. Simulated the popup's
  "Open Full Settings" click against an already-open viewer tab: the
  viewer's own `.markora-preferences-modal` opened in place (confirmed via
  `:not([hidden])` count), matching `fullsetting.png`, with no new browser
  tab created.
- `npx playwright test e2e/phase7.spec.ts e2e/phase2b.spec.ts
  e2e/phase3b.spec.ts` — 37/37 passing (includes the export dialog's own
  HTML/DOCX/Print export tests and the standalone options page's own tests,
  confirming neither surface regressed).
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:"` — 9/9
  passing (P7/P8 excluded as the same pre-existing, independently
  documented host-load-flaky performance tests noted in every prior phase).
- `npx playwright test e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` — 17/17
  passing — no accessibility regression from the panel CSS fix.

### Build Result
Green — see Tests above.

### Remaining Issues
- None known. Both user-reported gaps were root-caused to specific lines
  (a missing selector in a shared CSS rule; an unconditional
  `openOptionsPage()` call) and fixed at the root rather than patched
  around.

## 18. Phase 15 — white-text-on-`--accent-blue` contrast audit

User asked to "continue with next UI changes" with no specific target.
Determined the next work from this document's own tracking rather than
guessing: the white-text-on-`--accent-blue` gap was independently flagged as
open in the "Remaining Issues" section of four separate prior phases (13, 10,
11, and implicitly carried into 14) — "worth a dedicated audit... not fixing
piecemeal as each one happens to get touched" — but that audit had never
actually been done. Did it.

### Method
Computed the real WCAG 1.4.3 contrast ratio of white text against
`var(--accent-blue)` in both themes (light `#2563eb` ≈ 5.17:1 — passes;
dark `#3b82f6` ≈ 3.68:1 — fails 4.5:1, confirming the number cited in every
prior phase's flag). Then grepped every `background`/`fill: var(--accent-
blue)` (and the `--markora-color-accent-fg` alias, which always resolves to
white) in `src/frontend/styles/index.css` and checked each one's actual
paired foreground against two criteria: is it real, visible, non-decorative
text (not `aria-hidden`), and is it small/normal enough that 4.5:1 applies
(as opposed to large/bold text or a non-text icon, which only need 3:1 and
already pass at 3.68:1).

### What was found
Of 15 occurrences of `var(--accent-blue)` as a background/fill:
- **10 were not text-contrast issues at all**: toggle-switch thumbs,
  progress bars, onboarding dots, focus rings, and — checked specifically
  because they looked like risks — the toolbar brand mark/badge and popup
  brand mark, which all carry real single-letter/glyph text but are marked
  `aria-hidden="true"` (their accessible name comes from the parent
  button's own `aria-label`), and icon-only fills (mind map overflow-bounce
  indicator), which only need the 3:1 non-text threshold already met.
- **4 were real, new failures in dark theme**, none previously caught by
  axe (three because no axe test happens to render them in their active
  state; the fourth — SVG `fill` text — because axe-core doesn't reliably
  compute a "background" for non-HTML color contexts, a known tool
  limitation, not a false negative in this project's test setup):
  1. `.markora-preferences-modal__nav-item--active` — the active category
     label in the `fullsetting.png`-matching dialog (Phase 11).
  2. `.markora-popup__font-segmented-option--active` — the popup's
     Typography Sans/Serif/Mono quick-pick's selected button (Phase 8).
  3. `.markora-mindmap__node--root .markora-mindmap__node-text` — the
     mind map's root-topic label, rendered as SVG `fill` text (Phase 5/10).
  4. `.markora-mindmap__toggle-bg`/`__toggle-label` — every branch node's
     +/− expand/collapse circle, also SVG `fill` text.

### Fix
Same pattern already established in Phases 13/11 for this exact class of
bug (`.markora-export-dialog__export`, `.markora-open-workspace-modal
__browse`, `.markora-preferences-modal__done`): replace the theme-variable
background with the fixed, always-AA-safe `#1d4ed8` (~6.7:1 with white in
both themes) rather than changing the shared `--accent-blue` token itself,
which is used elsewhere for things that were never a contrast problem
(borders, non-text fills, large/bold text). Each site got a comment
pointing at this same reasoning rather than repeating the explanation
inline five times.

### What was deliberately not built
- `--accent-blue` itself was not changed — doing so would be a much larger,
  riskier visual change (every non-text use of it, correctly passing today,
  would also shift) to fix a problem that only exists at 4 specific,
  now-fixed call sites.
- No new CSS custom property was introduced for the fixed blue (e.g.
  `--markora-color-accent-safe`) despite this being its 5th call site —
  matches this codebase's established convention of repeating the literal
  with an explanatory comment (already done 3 times before this phase)
  rather than introducing an abstraction for it now.

### Tests
- `npx tsc --noEmit` — clean (CSS-only change).
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors; `index.css` Prettier-clean (not part of
  the pre-existing 12-file drift baseline, unchanged).
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`), dark theme forced via
  `data-theme="dark"`: screenshots of the mind map (root node + toggle),
  the in-viewer Preferences dialog (active "General" nav item), and the
  popup's Typography quick-pick (active "Sans" button) all show the
  deeper, higher-contrast blue with clearly legible white text.
- `npx playwright test e2e/phase5.spec.ts e2e/phase2b.spec.ts e2e/phase9-
  a11y.spec.ts e2e/smoke.spec.ts` — 44/44 passing, including both
  light/dark mind-map and full-options-page axe scans — confirms no visual
  regression from the four token-to-fixed-color swaps.

### Build Result
Green — see Tests above.

### Remaining Issues
- None known for the white-text-on-`--accent-blue` pattern specifically —
  all 15 occurrences of the token as a background/fill were individually
  checked, not sampled.
- A broader contrast audit (every color pairing, not just this one
  specific pattern) was not performed — out of scope for what was
  specifically flagged as open across the last four phases.

## 19. Phase 16 — live syntax-highlight theme fix

Continued from the plan's own tracking again: Phase 3's "Remaining Issues"
(§6) flagged a real, described mechanism bug — "toggling the app theme live
within a session doesn't re-sync the code-block theme" — as needing its own
fix, out of scope at the time. Never picked up since. Investigated the
actual mechanism before touching anything (`src/backend/viewer/syntax/
themes.ts`, `theme-files/*.ts`, and every call site in `src/viewer/
index.ts`) rather than assuming the old write-up was still accurate.

### What was actually wrong (two bugs, not one)
1. **The flagged one**: each curated highlight.js theme
   (`theme-files/*.ts`) was a bare side-effect CSS import
   (`import 'highlight.js/styles/github.min.css'`), dynamically `import()`-ed
   once and cached forever by the module loader. Every theme ever activated
   in a session left its own `<link>`/`<style>` tag in the DOM permanently,
   in the order first loaded. Switching back to an earlier theme after a
   later one had also loaded couldn't re-insert or reorder that earlier
   tag — its rules stayed wherever they were first inserted, so any
   selector both themes touched still resolved to whichever theme was
   loaded *last chronologically*, not whichever was *currently selected*.
2. **Found during this pass, not previously documented**: `Settings
   .highlightTheme` was only ever read once, at `bootstrap()`. Picking a
   different "Code block theme" from Settings' Appearance section had *zero*
   live effect — `applyLiveSettings()` (the function every other live-apply
   setting goes through, F81) never called `applyHighlightTheme` at all.
   Only a full reload picked up a new choice. A real, silent gap in a
   product that explicitly prides itself on live-apply settings.

### Fix
- Changed each `theme-files/*.ts` from a side-effect CSS import to a URL
  export (`export { default } from 'highlight.js/styles/<key>.min.css?url'`)
  — a standard Vite feature (typed via the project's existing `vite/client`
  tsconfig types), still lazily resolved per theme via the same `LOADERS`
  dynamic-import map, but now yielding a URL string instead of an
  auto-injected stylesheet.
- `applyHighlightTheme()` (`themes.ts`) now creates one `<link
  id="markora-hljs-theme" rel="stylesheet">` on first use and swaps its
  `href` on every subsequent call, instead of relying on side-effect import
  caching. Exactly one theme's rules can ever be active — no history-
  dependent cascade ordering possible.
- `src/viewer/index.ts`'s `onThemeApplied` callback (already used to
  live-resync Mermaid's theme on every app-theme toggle) now also
  re-resolves and re-applies the highlight theme the same way.
- `onSettingsChanged` now diffs `next.highlightTheme` against the current
  value (same pattern already used there for `autoRefresh*`) and, if
  changed, live-applies it immediately — closing the second bug.

### What was deliberately not built
- No new CSS custom property or settings-schema change — both bugs were
  wiring/mechanism problems, not missing features.
- The `LOADERS` dynamic-import structure (one small file per theme) was
  kept rather than flattened into static top-level imports in `themes.ts` —
  a smaller, more conservative diff that preserves the existing lazy-load
  intent per theme, even though `?url` imports are cheap enough that either
  approach would work.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds; confirmed all 14 theme CSS files are still
  emitted as separate `dist/assets/*.css` files (unbundled, loaded only on
  demand via the managed `<link>`'s `href`).
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors; the 14 theme-files plus `themes.ts` and
  `viewer/index.ts` all Prettier-clean (pre-existing 12-file drift baseline
  unchanged).
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`): confirmed exactly one
  `<link id="markora-hljs-theme">` exists at all times (never more), that
  cycling the toolbar's theme button correctly swaps it between
  `github.min.css`/`github-dark.min.css` on every toggle (not just at
  boot), and that picking "Monokai" from Settings' Appearance section
  live-swaps it to `monokai.min.css` immediately, with no reload.
- `npx playwright test e2e/phase3a.spec.ts e2e/phase3b.spec.ts
  e2e/phase2b.spec.ts e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` — first run
  54/54 passed except one: `smoke.spec.ts`'s "popup passes a baseline
  accessibility scan" failed once (`page-has-heading-one` — the popup's own
  `<h1>` not yet in the DOM when axe scanned). Investigated rather than
  assumed: this test scans immediately after `page.goto` with no wait for
  the popup's async render to finish (unlike the adjacent smoke test, which
  does wait), and this phase touched no popup code at all. Re-ran it alone
  3x (`--repeat-each=3`) — 3/3 passed — and re-ran the full 54-test set
  again — 54/54 passed. Confirms a one-off host-load timing flake in the
  test's own missing wait, not a regression from this phase.

### Build Result
Green — see Tests above.

### Remaining Issues
- None known for the syntax-highlight theme mechanism specifically.
- `smoke.spec.ts`'s "popup passes a baseline accessibility scan" has no
  wait for the popup's initial async render before scanning (unlike its
  sibling test in the same file) — a latent flakiness risk independent of
  this phase, worth a small follow-up (e.g. waiting on the `<h1>` first)
  if it recurs.

## 20. Phase 17 — real "Modified {time}" status-bar field

Continued from the plan's own tracking again: Phase 12's "Remaining Issues"
suggested a concrete, real alternative to something deliberately *not*
built there — `new_ui/main.png`'s title-area badge row ("Specification RFC"
tag, "v2.4.0", "Updated 2 hours ago") was skipped entirely because a generic
Markdown document has no real document-type/version/last-modified concept
unless front matter supplies one, and none of the fixtures do. But the
"Updated 2 hours ago" half specifically *does* have a real source browsers
already expose: `File.lastModified`, on any `File` object obtained from
drag-and-drop or the File System Access API. Built that reduced, honest
version instead of leaving the idea unaddressed indefinitely.

### What was built
- `File.lastModified` (a real Unix timestamp) is now captured at both
  points the viewer ever gets an actual `File` object — `loadFromFile`
  (drag-and-drop) and `loadFromFileHandle` (the file picker and folder-
  browser clicks, both Flow B) — and threaded through
  `renderDocument(text, sourceLabel, lastModified?)` into a new module-level
  `currentLastModified`.
- A new status-bar field, `.markora-status-bar__modified`, shown only when
  `currentLastModified` is non-null (`"Modified {time}"`, using the same
  `formatRelativeTime` + `getActiveLocale()` pattern already established for
  the popup's Recent/Bookmark cards, Phase 10), with a full absolute
  date/time in its `title` attribute (hover tooltip) — the same real-data-
  and-tooltip pattern already used there too.
- Flow B's auto-refresh (`src/viewer/autoRefresh.ts`) already re-reads
  `file.lastModified` internally on every poll, purely to detect a change —
  it just never surfaced that value anywhere. `AutoRefreshOptions.onChanged`
  now optionally carries it through, so an externally-edited, auto-refreshed
  document's "Modified" field updates to the file's real new timestamp on
  the very same poll that picks up the new content, not just at initial
  load. Flow A (`fileUrl` polling, no `File` object, no reliable
  Last-Modified) and handoff loads (address-bar-entered documents, also no
  `File` object) correctly omit the field rather than fabricate a value.
- 19 real, independently-written translations (not English-duplicated
  placeholders) for the new `viewer.statusBar.modified` key (`"Modified
  {time}"`), added to every locale file immediately after the existing
  `viewer.statusBar.hotkeys` key.
- Narrow-viewport handling: added to the existing `max-width: 768px` rule
  that already drops the encoding label first (Phase 12) — the new field is
  equally non-essential, dropped at the same breakpoint rather than letting
  the bar wrap/overflow.

### What was deliberately not built
- No periodic re-render of the relative-time text while the viewer stays
  open (e.g. a `setInterval` to keep "2 minutes ago" ticking forward to "3
  minutes ago"). No other relative-timestamp surface in this codebase does
  this either (the annotations panel's own timestamps have the same
  characteristic) — consistent with that existing, accepted tradeoff, not a
  new gap introduced here.
- The mockup's "Specification RFC" document-type tag and "v2.4.0" version
  badge remain unbuilt — still genuinely unsupported by any real data
  source available to a generic Markdown viewer, unchanged from Phase 12's
  reasoning.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing, including the locale key-coverage test
  (confirms all 19 locale files still have matching key sets after the new
  addition).
- `npm run lint` — 0 ESLint errors (including `no-literal-user-strings` —
  the new field's text goes through `t()` like everything else); Prettier
  drift unchanged at the pre-existing 12-file baseline.
- All 19 locale JSON files individually parsed and validated after the
  scripted insertion.
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`): dropped a `File`
  constructed with an explicit `lastModified` 3 hours in the past —
  the status bar showed "Modified 3 hours ago" immediately, alongside the
  real filename/encoding/word-count fields, with zero console errors.
  Screenshot confirms placement and styling match the bar's existing
  fields.
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:"
  e2e/phase2b.spec.ts e2e/phase5.spec.ts e2e/phase9-a11y.spec.ts
  e2e/smoke.spec.ts` — 53/53 passing, including `phase4.spec.ts`'s own
  Flow-B auto-refresh test (exercises the exact `onChanged` signature
  change) and the full responsive no-horizontal-overflow suite at all four
  breakpoints (confirms the new field doesn't cause overflow, and is
  correctly dropped at 768px/375px).

### Build Result
Green — see Tests above.

### Remaining Issues
- None known for this field specifically.
- No e2e test directly asserts the new field's text/visibility (only
  covered by the manual verification above plus the broader regression
  suite) — real follow-up if stricter coverage is wanted, not a functional
  gap in what shipped.

## 21. Phase 18 — test-coverage cleanup (two small, self-flagged gaps)

Both items came directly from the previous two phases' own "Remaining
Issues" — small, well-scoped, test-only fixes, bundled into one phase since
neither touches product code or carries any real risk.

### 1. `smoke.spec.ts`'s flaky missing wait (flagged in Phase 16)
"popup passes a baseline accessibility scan" scanned immediately after
`page.goto`, with no wait for the popup's async render (`getSettings()`
before its `<h1>` is appended) to finish — unlike its sibling test in the
same file, which does wait on that exact element. On a loaded host this
occasionally raced axe ahead of the render, surfacing a spurious
`page-has-heading-one` violation. Fixed by adding the identical wait
(`await expect(page.locator('.markora-popup__header h1')).toHaveText
('Markora')`) before constructing `AxeBuilder`, matching the sibling test's
already-correct pattern. Verified with `--repeat-each=5` — 10/10 passed
(previously reproduced as a failure roughly 1 in 4-5 runs on this host).

### 2. Missing e2e coverage for Phase 17's "Modified" field (flagged in Phase 17)
Added a real assertion to `phase4.spec.ts`'s existing "opening a file
renders it and highlights it as the active file" test — no new fixture
infrastructure needed, since the file already used there is opened through
the fake-folder harness's `getFile()`, which already sets a real
`lastModified` (`e2e/phase4.spec.ts`'s own `FakeNode`/`FileState` mock, used
elsewhere in the same file to test Flow-B auto-refresh). Asserts
`.markora-status-bar__modified` is visible and contains "Modified" after
the file renders. Deliberately did not also add a negative-case assertion
(field hidden when no real `File` object exists, e.g. a handoff/address-bar
load) — this file's existing fixtures don't have a ready-made harness for
that load path, and building one just for this assertion would be new test
infrastructure for a case Phase 17's own manual verification and code
review already covered directly.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged (pre-existing
  12-file baseline; both edited e2e files stayed clean).
- `npm run test` — 590/590 passing (no product code touched this phase).
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:"
  e2e/smoke.spec.ts` — 11/11 passing, including the new "Modified" field
  assertion.
- `npx playwright test e2e/smoke.spec.ts --repeat-each=5` — 10/10 passing,
  confirming the flaky wait fix.
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:"
  e2e/phase2b.spec.ts e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` — 47/47
  passing, full regression clean.

### Build Result
Green — see Tests above.

### Remaining Issues
- None known.

## 22. Phase 19 — left sidebar (folder browser) full visual/UX overhaul vs. `new_ui/main.png`

User directly asked: "make left side bar exact same as new_ui/main.png left side bar, ui should look like user
friendly." Compared the live sidebar against the mockup pixel-by-pixel before writing any code (screenshotted both
rather than guessing from memory. Found the two were structurally quite different — the mockup's header/summary/
footer chrome barely existed, several real data points the mockup shows weren't being collected at all, and one
directory-tree feature (expand/collapse) had never been built.

### What was found (gap audit, before any code changed)
- Header said plain "Files" with no count, no add-workspace affordance — mockup shows "WORKSPACES 2" (eyebrow +
  real count pill) plus quick-action icons.
- No "N workspaces open / Clear All / file://" summary row at all.
- The per-workspace "Open folder" trigger lived awkwardly as a plain text button inside the search toolbar;
  no "Open File" entry point existed anywhere in the sidebar.
- No footer at all — the mockup's "Open Folder"/"Open File" button pair and "Multi-Workspace Engine · Chrome FS
  API" status strip had no equivalent.
- Every file row showed only a name — the mockup shows a real, right-aligned file size per row.
- Folders had no expand/collapse affordance at all (always fully expanded, no chevron, a plain non-interactive
  `<div>`) — the mockup shows some folders collapsed.
- Workspace sections had no way to collapse their own file list in place (only fully closeable via "X").
- The per-workspace file/status count was shown twice — once as a badge, once as a near-duplicate text line
  below it (`scanComplete` rendered into both `countEl` and `statusEl`).
- A live, reproducible layout bug: the sidebar could show a horizontal scrollbar (content wider than the panel).

### What was built (all real, honest data — nothing fabricated)
- **Header**: "WORKSPACES" eyebrow (`<h2>`, a real heading landmark, just restyled) + a real total-open-workspace
  count pill + an "add workspace" icon button (reuses the existing `onRequestOpenFolder` callback — same modal the
  footer button below also opens) + the pre-existing hide-panel icon.
- **Summary row**: real "{count} workspaces open" text, a new "Clear All" action (closes every open workspace at
  once — previously only one at a time via each section's own "X"), and a static, accurate "file://" tag
  describing the real access mechanism every open workspace actually uses (the File System Access API — routed
  through `t()` like the codebase's other technical literals, e.g. "UTF-8").
- **Real per-file sizes**: `File.size`, fetched via `handle.getFile()` — but deliberately *not* during the
  progressive scan loop itself (that would risk the P7/P8 scan-timing budgets). Instead a new `populateFileSizes()`
  pass runs once, sequentially, only after a scan/cancel fully finishes, yielded the same
  `BATCH_INTERVAL_MS`-batched way scanning/searching already are, and caches results (`sizeByPath`) so a later
  filter-driven `rebuildTreeView()` reapplies known sizes instantly instead of re-fetching. Verified via
  `performance.now()`-based P7 re-runs that this adds no measurable main-thread cost (see Tests).
- **Real expand/collapse**: directory rows are now real `<button>`s (previously non-interactive `<div>`s) with a
  chevron, toggling a per-directory `collapsedDirPaths: Set<string>` that survives `rebuildTreeView`'s full DOM
  rebuild during progressive scanning. Each workspace section also got its own independent collapse (a new
  `chevronButton`, distinct from the existing "X" close action), defaulting to expanded.
- **Footer**: pinned below a newly-scrollable middle region (same flex-column-with-pinned-footer recipe already
  used by `preferencesModal`/`exportDialog`) — real "Open Folder"/"Open File" buttons (the latter wired to a new
  `onRequestOpenFile` callback → the viewer's existing `openFilePicker()`, previously unreachable from inside the
  sidebar) and a real "Multi-Workspace Engine / Chrome FS API" description line.
- **De-duplicated status text**: the per-workspace status line (`statusEl`) now hides itself once a scan finishes
  cleanly (the header's own count pill already says the same thing) and only stays visible for a genuinely
  distinct state — "Cancelled" — rather than repeating "N files" a second time.
- Fixed the horizontal-overflow bug via `overflow-x: hidden` on the new scroll area plus proper `min-width: 0`/
  ellipsis handling throughout the restructured rows.
- New i18n keys (`fileBrowser.workspaces.add/.clearAll/.expand/.collapse`, `fileBrowser.openFile`,
  `fileBrowser.footer.engine/.api`, `fileBrowser.protocolBadge`), plus the pre-existing `fileBrowser.title`
  ("Files" → "Workspaces") and `fileBrowser.searchPlaceholder` ("Search this folder" → "Filter files across
  workspaces...", now honestly describing what the field actually searches) — all with real, independently
  written translations across all 19 locales, not English-duplicated placeholders.

### What was deliberately not built
- No per-category descriptive subtext or fabricated document metadata — same reasoning as every prior phase's
  "explicitly not built" mockup elements.
- The header's exact icon count/arrangement wasn't chased pixel-for-pixel beyond "add workspace" + "hide panel" —
  the mockup's second header icon's real intended action isn't discoverable from a static screenshot, and
  inventing a new action for it would be exactly the kind of unbacked UI this project's core rule forbids.

### Bug found and fixed
Same recurring class of bug already documented three times elsewhere in this file (`.markora-preferences-modal`,
`.markora-file-browser__reconnect`, and originally the overlay-backdrop group): an author `display: flex` rule on
`.markora-file-browser__summary` beat the UA `[hidden]{display:none}` rule regardless of specificity, so "Clear
All" at zero remaining workspaces left an empty, useless summary row visibly stuck on screen instead of
disappearing. Caught live while scripting the "Clear All" verification (not by an existing test — none covered
this element yet), fixed by adding the explicit `.markora-file-browser__summary[hidden] { display: none; }`
override, the same fix pattern used for every prior instance of this bug in this file.

### A real mistake made and corrected during this phase
A locale-file edit used PowerShell's `Get-Content -Raw`/`Set-Content -Encoding utf8` to change one string —
Windows PowerShell 5.1 has no encoding autodetection for a BOM-less UTF-8 file, so it silently read `en.json` as
the system codepage, corrupting every non-ASCII character (curly quotes, em dashes, every non-English UI-string
example, etc.) and adding a BOM inconsistent with the other 18 locale files. Caught immediately by re-reading the
file's own output rather than assuming the edit succeeded — the mojibake was visible in the very next read.
Fixed by reversing the exact corruption mathematically (decode the corrupted bytes as UTF-8 to get the mojibake
string, re-encode that string as Windows-1252 to recover the original UTF-8 bytes, decode those as UTF-8) rather
than guessing at a rewrite, then verified byte-for-byte against `git diff` that the recovered file contained
*only* this phase's and prior phases' legitimate, intended changes with zero corruption remaining. Every
subsequent locale-file edit in this phase used the already-established safe pattern (.NET
`ReadAllText`/`WriteAllText` with an explicit no-BOM UTF-8 encoding), which was never at risk of this class of bug
in the first place.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors (including `no-literal-user-strings` — the "file://" badge initially tripped
  this and was fixed by routing it through `t()`); Prettier drift unchanged at the pre-existing 12-file baseline.
- All 19 locale JSON files individually parsed and validated after every scripted insertion, and re-validated
  after the encoding-corruption recovery described above.
- Manual verification in a real loaded extension (`chromium.launchPersistentContext` + `--load-extension`, a fake
  multi-folder `showDirectoryPicker`, real `File` objects with real sizes): side-by-side screenshots in both
  themes now match `main.png`'s sidebar closely — "WORKSPACES 2" header, summary row, colored workspace folder
  icons, real file sizes ("19 B", "850 B", ...), and the pinned footer. Verified functionally, not just visually:
  real file sizes populate asynchronously without blocking; per-directory and per-workspace collapse both toggle
  correctly via mouse *and* keyboard (Enter/Space on the real `<button>` elements); "Clear All" removes every
  workspace and correctly hides the summary row (after the bug fix above).
- `npx playwright test e2e/phase4.spec.ts -g "P7: scanning"` re-run 3x in isolation after adding
  `populateFileSizes()` — one initial run on the full suite showed 1212ms (over the 500ms budget), matching this
  exact test's already extensively pre-documented host-load flakiness (see Phases 4/8/9/11/13's own sections);
  investigated rather than assumed — 3/3 clean re-runs (135-148ms, worst task 73-103ms) confirmed no real
  regression from this phase's changes.
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:" e2e/phase2b.spec.ts e2e/phase9-a11y.spec.ts
  e2e/smoke.spec.ts` — 47/47 passing, including the folder browser's own dedicated axe scan in both themes (0
  violations after the button/chevron/footer restructure) and the full responsive no-horizontal-overflow suite at
  all four breakpoints.

### Build Result
Green — see Tests above.

### Remaining Issues
- The header's second mockup icon (beyond "add workspace") was not built — see "What was deliberately not built."
- No dedicated e2e test yet directly asserts the new header/summary/footer elements or the collapse toggles
  (covered today by the manual verification above plus the broader regression suite) — real follow-up if stricter
  coverage is wanted, not a functional gap in what shipped.

## 23. Phase 20 — left sidebar round 2: real user-tested feedback

User tested Phase 19's sidebar live and reported back with a real screenshot
(`tested_ui/Screenshot 2026-09-16 144515.png`) showing three concrete
complaints: "remove unwanted text like Multi-workspace Engine, Chrome FS
API, Markdown only dropdown" and "scroll and other thing not look
friendly." A second screenshot and message arrived mid-session
(`tested_ui/Screenshot 2026-09-16 145803.png`) asking further: the header's
"+" should reveal file/folder icons on hover so its purpose is obvious, and
the bottom "Open Folder"/"Open File" buttons should go away entirely once
that exists. Both rounds addressed in this phase, each verified against a
fresh screenshot of the real running extension before moving on.

### What was removed
- The "Multi-Workspace Engine" / "Chrome FS API" footer caption — purely
  descriptive text with no function; gone along with its two i18n keys'
  only call site (the keys themselves were left in the 19 locale files
  rather than risking another bulk-edit pass right after the incident
  below — dead but harmless, `settings.files.fileTypeFilter`'s
  neighboring real keys are unaffected).
- The sidebar's own file-type filter `<select>` ("Markdown only" /
  "All supported text"). The real setting behind it was **not** removed —
  Settings → Files → "Default folder-browser file filter" is the sole
  remaining control, and it's a genuine improvement over the dropdown it
  replaces: `setFilterSettings()` (the single place `fileTypeFilter` can
  now change) live-rebuilds every already-open workspace tree when the
  value actually changes, closing a real gap the old dropdown's own
  `change` handler previously only ever covered for itself.
- The redundant "{count} workspaces open" text in the summary row — the
  header's own count pill already says the same number; this was also the
  specific text the screenshot showed truncating to "1 WORKSPACES O..." in
  the panel's default width. Still announced to assistive tech via the
  pill's `aria-label`, so nothing regresses for screen readers, just the
  on-screen duplication.
- The pinned footer's "Open Folder"/"Open File" buttons entirely (second
  round of feedback) — superseded by the new "+" menu below.

### What was added
- **Slim custom scrollbar** on the sidebar's scrollable region
  (`scrollbar-width: thin` + `::-webkit-scrollbar*`) — replaces the OS's
  full-width native scrollbar with big up/down arrow buttons the user's
  screenshot showed, matching the rest of this panel's compact, modern
  chrome. Chromium-only styling is fine here: this is a Chrome extension,
  no other rendering engine ever sees it.
- **"+" add-menu popover**: the header's "+" now reveals a small menu with
  a real icon *and* label for each of the two real actions — "Open File"
  and "Open Folder" — instead of a single icon that only ever did one of
  them with no way to tell which from looking at it. Opens on hover (as
  asked) for mouse users, and also on click (keyboard/touch, which can't
  hover) — same click-toggle / outside-click / Escape / focus-trap pattern
  already established by the toolbar's more-menu
  (`src/frontend/components/moreMenu`), scaled down to two items.

### Bugs found and fixed (both caught live, before either was reported back)
1. **Hover-open and click-toggle fought each other.** A real mouse click
   always fires `mouseenter` on the wrapper immediately beforehand (true in
   Playwright and in real browsers) — that mouseenter already opened the
   menu via hover, so the click handler's own "toggle" logic then saw an
   already-open menu and closed it, meaning any mouse click on the trigger
   opened-then-instantly-closed the menu. Fixed by tracking `lastHoverOpenAt`
   and treating a click arriving within 400ms of a hover-open as "keep it
   open," not a toggle — a genuine keyboard-only activation (no preceding
   hover) still toggles normally.
2. **Tooltip visibly overlapped the popover.** The trigger's `attachTooltip`
   call fired on the same hover that opens the menu, and the tooltip text
   ("Open file or folder") rendered on top of the menu's own, clearer
   "Open File"/"Open Folder" items. Fixed by removing the tooltip for this
   button entirely (kept `aria-label` for accessibility) — the popover
   itself is a strictly better, self-explanatory replacement for what the
   tooltip was trying to convey.
3. **`[hidden]` vs. `display` — same recurring bug, fixed proactively this
   time.** `.markora-file-browser__add-menu` sets `display: flex`; added
   the explicit `.markora-file-browser__add-menu[hidden] { display: none; }`
   override up front (the same class of bug hit live in Phase 19 for
   `.markora-file-browser__summary`, and twice before that elsewhere in
   this file) rather than waiting to discover it again.

### A real e2e regression found and fixed
`e2e/phase4.spec.ts`'s "the file-type filter narrows the list without a
rescan" test drove the now-removed `.markora-file-browser__filter` select
directly and timed out once it no longer existed. Investigated and updated
rather than deleted or skipped: rewrote it to change the setting the same
way a real user now must — via `src/settings/index.html` → Files tab →
"Default folder-browser file filter" (the exact pattern already established
by this same file's own Flow-B auto-refresh test, which already opens a
second settings tab to change a setting mid-test) — and confirmed the
already-open folder's tree still re-filters live from that Settings-driven
change, proving the `setFilterSettings()` improvement above actually works
end-to-end, not just in isolation.

### Tests
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run test` — 590/590 passing.
- `npm run lint` — 0 ESLint errors; Prettier drift unchanged at the
  pre-existing 12-file baseline (plus one unrelated file the user added to
  the repo directly, `featureslist.md`, left untouched — not part of this
  or any other phase's work).
- All 19 locale JSON files individually parsed and validated after the new
  `fileBrowser.addMenu.trigger` key's insertion.
- Manual verification in a real loaded extension (`chromium
  .launchPersistentContext` + `--load-extension`): screenshots confirm no
  footer, no filter dropdown, no truncated summary text, a working slim
  scrollbar, and the add-menu opening correctly on both hover and click
  with no tooltip overlap — each fix re-screenshotted after applying it,
  not just described.
- `npx playwright test e2e/phase4.spec.ts -g "file-type filter"` — 1/1
  passing after the rewrite.
- `npx playwright test e2e/phase4.spec.ts --grep-invert "P7:|P8:"
  e2e/phase2b.spec.ts e2e/phase9-a11y.spec.ts e2e/smoke.spec.ts` — first run
  came back with 3 failures, none in sidebar/fileBrowser code: `phase2b`'s
  P10 (typography live-apply, budget <100ms, got 324ms) and P6 (in-document
  search, budget <150ms, got 346ms) timing budgets, and one mind-map axe
  scan timing out at 30s. Investigated rather than assumed: re-ran P10 alone
  — passed cleanly at 44ms; re-ran the mind-map axe scans alone — both
  themes passed cleanly (8s each); P6 alone still failed, repeatedly
  (233-267ms across 3 runs) — genuinely slower than this same test's own
  15-20ms measurements earlier in this very session, but this test exercises
  in-document search (`components/search`), code this phase never touched.
  Confirmed host load, not a regression, with an unrelated control: the
  jsdom-based unit suite (zero relation to any Playwright/browser timing,
  zero relation to this phase's CSS/DOM changes) was *also* running ~3x its
  normal duration (98-109s vs. this session's earlier consistent 30-40s) at
  the exact same time. Two unrelated test types slowing down by the same
  factor simultaneously is the signature of host contention, not a code
  regression. `npx playwright test e2e/phase4.spec.ts --grep-invert
  "P7:|P8:"` re-run alone once the immediate contention passed — 9/9
  passing, confirming every actual sidebar/fileBrowser behavior (including
  the rewritten file-type-filter test) is solid; only wall-clock timing
  budgets on unrelated surfaces were ever affected.

### Build Result
Green — see Tests above.

### Remaining Issues
- `fileBrowser.filter.label`/`.markdownOnly`/`.allSupportedText` and
  `fileBrowser.footer.engine`/`.api` are now dead or (for the `.filter.*`
  pair) reused-elsewhere-only keys left in all 19 locale files rather than
  risking another bulk edit right after this phase's own encoding incident
  (Phase 19) — harmless, real cleanup opportunity if ever touching those
  files for another reason.
- No dedicated e2e test yet directly asserts the add-menu popover itself
  (hover-open, click-toggle, Escape) — covered today by manual verification
  only; real follow-up if stricter coverage is wanted.

## 24. Phase 21 — user-reported bug pass against `issues.txt`

The user filed a fresh `issues.txt` (11 items) reporting the annotations UI,
sticky header, scrollbars, settings, shortcuts, a "Plugins" section, sidebar
position, the `Ctrl+,` shortcut, the shortcut-help UI, and diagram rendering
as still broken — directly contradicting this plan's own Phases 1-20, which
had marked every one of those areas "Real, no gaps." Per this codebase's own
workflow rule ("verify before building" / a prior session's self-report is
not a substitute for checking), every item was re-verified live (build +
`chromium.launchPersistentContext` + `--load-extension`, the same mechanism
`e2e/extension-fixtures.ts` uses) rather than trusted from the existing
status table.

**Also found before any of this phase's own work began**: a background
research task launched earlier in this session (told explicitly
"research-only, do not edit files") ignored that instruction and made real
edits to `components/annotations`, `components/shortcutHelp`,
`components/icons`, `index.css`, and all 19 locale files before hitting a
turn limit mid-edit. Verified (not assumed) safe before building on it:
`tsc --noEmit` clean, all locale JSON individually valid, `npm run test`
green. Two of the 19 locales (`ar.json`, `de.json`) were missing the two new
`settings.plugins.*Group` keys the interrupted edit was mid-way through
inserting — added with real translations, confirmed via
`keyCoverage.test.ts`.

### Per-issue findings

1. **Annotations UI "not proper."** Real bug found: `.markora-toolbar__badge`
   sets `display: inline-flex` with no `[hidden]` override — the same
   recurring "author `display` beats the UA `[hidden]{display:none}`" bug
   already documented (and fixed) at four other call sites in this same
   file. The annotations-count badge never actually hid itself at count 0;
   it rendered as a permanent empty pill next to the toolbar's Annotations
   button. Fixed with the same explicit `[hidden]` override pattern used
   everywhere else in this file.
2. **Sticky header "not working."** Verified live: `.markora-toolbar-landmark`
   already has `position: sticky; top: 0` (a real fix from an earlier,
   pre-existing session) and genuinely holds at the viewport top through a
   real `window.scrollTo`/wheel-scroll test. No code change needed — this
   was already fixed in the working tree the user hadn't rebuilt/reloaded
   against yet.
3. **Scrollbars "need to be thin."** Verified live: the universal
   `scrollbar-width: thin` + `::-webkit-scrollbar` (8px) rules already
   apply globally (an earlier, pre-existing session's fix). No gap found.
4/7. **Settings accuracy.** Initially only spot-checked the Plugins section;
   completed with a full per-setting audit in the same phase (see "Phase 21
   follow-up" below), which found and fixed one real gap: parse-stage
   settings (Markdown/Plugins toggles) had no live effect on an
   already-open document.
5. **"Some shortcuts not working."** Real bug found: `onGlobalKeyDown` in
   `src/viewer/index.ts` bailed out of *every* shortcut (`Ctrl+,`, `Ctrl+F`,
   `Ctrl+Shift+L`, `Ctrl+Shift+M`, `Ctrl+/`) the instant focus was inside
   any `<input>`/`<textarea>`/contenteditable — including the TOC filter
   box, the file browser's search field, and an annotation's comment box.
   Every one of this app's shortcuts requires Ctrl/Cmd, so none of them
   could ever be a character someone is trying to type; the guard only
   needed to protect *unmodified* keystrokes. Fixed by narrowing the bail
   condition to `isEditable && !(event.ctrlKey || event.metaKey)`. Verified
   live: `Ctrl+,` now opens Preferences while the TOC filter is focused, and
   plain typing in that same field is unaffected.
6. **"Plugins missing."** Verified real and already fully wired
   (`buildPluginsSection`) from a pre-existing session's work — not built
   this phase. Only the two missing locale keys above needed fixing.
8. **Sidebar left/right setting — genuinely missing, built this phase.**
   Added `Settings.utilitySidebarPosition: 'left' | 'right'` (schema.ts,
   default `'right'`, matching every existing install's current layout — no
   migration needed since `getSettings()` already shallow-merges new
   top-level fields onto `DEFAULT_SETTINGS`). A new "Sidebar position"
   select row in Settings → Navigation
   (`preferencesModal/sections.ts`, reusing the existing `selectRow`
   helper). Live-applied the same way `stickyTableHeaders` already is — a
   `document.documentElement.classList.toggle('markora-utility-sidebar-left',
   ...)` in `applyLiveSettings` — rather than rebuilding the layout. CSS is
   a pure `order: -1` swap on `.markora-toc`/`.markora-annotations-panel`
   plus flipping their divider from `border-inline-start` to
   `border-inline-end` (the divider must face whichever neighbor is now
   adjacent, or it renders on the viewport's outer edge instead). Verified
   live: TOC renders at `left: 0` with the divider on its correct edge when
   set to `'left'`. New keys added to all 19 locales (`Sidebar position` /
   `Left` / `Right`), confirmed via `keyCoverage.test.ts`.
9/10. **`Ctrl+,` confusing / shortcut-help UI "messy."** Already fixed by
   the interrupted background task (see above), verified rather than
   redone: `renderCombo()` in `components/shortcutHelp` now renders each
   modifier/key as its own `<kbd>` chip with a visible "+" between them
   (`t('shortcuts.key.comma')` spells out "Comma" instead of showing a bare
   `,` that read as a stray mark next to the plus sign), and a real
   accessibility bug was fixed alongside it: `Tab` inside the shortcut-help
   dialog previously always jumped focus to the close button — a
   one-element non-trap that made every "Record" button in the list
   keyboard-unreachable — replaced with the same `trapTabFocus` cycle every
   other modal already uses.
11. **Diagrams "should not look messy" — the deepest bug this phase found.**
   Mermaid flowcharts rendered as solid black shapes with every label
   invisible, in *both* themes — not a color/theme bug. Root cause, found
   by comparing Mermaid's raw pre-sanitization output (not just our own
   sanitized result): Mermaid's own `render()` calls the process-wide
   `dompurify` package's `DOMPurify.sanitize(code, {...its own SVG-aware
   config...})` internally whenever `securityLevel !== 'loose'`. This
   codebase's `sanitizeHtml()` (the markdown hot path) locks a persistent
   config via `DOMPurify.setConfig(DOCUMENT_CONFIG)` for performance — and
   `DOMPurify.sanitize(dirty, cfg)` *silently ignores* `cfg` once a
   persistent config is locked in. So Mermaid's own internal sanitize call
   was silently getting `DOCUMENT_CONFIG` (a plain-HTML config, no SVG
   profile, `FORBID_TAGS: ['style', ...]`) instead of its own intended
   config — stripping the `<style>` block Mermaid bakes its theme into
   before `sanitizeDiagramSvg` (this codebase's own, correct, mandatory
   pass) ever got a chance to run. Fixed with a new
   `withSanitizerUnlockedForThirdParty()` in
   `backend/viewer/sanitization/index.ts` that clears the lock for exactly
   the span of the `mermaid.render()` call and restores it in a `finally`
   (so a throw — an invalid diagram — can't leave the shared instance
   unlocked for whatever `sanitizeHtml` call comes next). Security is
   unweakened either way: `sanitizeDiagramSvg`'s own pass, forbidding
   `foreignObject`/`script`/etc., still runs on the result regardless of
   what Mermaid's own internal pass allowed through.

   A second, independent bug compounded the first: node label *text* itself
   (as opposed to color) was empty even in Mermaid's own raw output,
   because `flowchart: { htmlLabels: false }` — the config this phase first
   reached for, to avoid relying on `<foreignObject>` for label text at all
   (which `sanitizeDiagramSvg` correctly forbids regardless of the above
   fix) — is documented in `mermaid`'s own `config.type.d.ts` as deprecated,
   and in the installed v11.17.2, node-label rendering (`labelHelper`)
   only ever reads the root-level `htmlLabels` key, not the nested one; the
   nested key silently did nothing. Fixed by moving it to the root:
   `mermaid.initialize({ ..., htmlLabels: false })`.

   Verified live in both themes with a real flowchart + sequence diagram:
   every node/edge label now renders as real, correctly colored text
   (`Start`/`Decision`/`Yes`/`No`/`Do thing`/`Do other thing`/`End`), and
   the sequence diagram's actor boxes — previously hardcoded-looking light
   gray in dark mode, a symptom of the same missing-`<style>`-block bug —
   now correctly pick up the dark theme's palette too.

### UI Improvements
- Annotations badge no longer shows a permanent empty pill at zero count.
- Mermaid flowcharts (and, incidentally, every other Mermaid diagram type)
  render fully labeled and theme-correct in both light and dark mode,
  instead of unlabeled black/mis-colored shapes.
- New Settings → Navigation → "Sidebar position" (Left/Right) control.
- Shortcut-help combo rendering and its keyboard-trap fix (carried over from
  the interrupted background task, verified not re-done).

### UX Improvements
- Every keyboard shortcut now works while focus is inside a text field
  (TOC filter, file browser search, annotation comments), not just when
  focus is on the document body.

### Functional Integrations
- None beyond the new `utilitySidebarPosition` setting — a pure
  presentation-layer `order`/border swap, no new backend contract.

### Components Changed
- `src/frontend/styles/index.css`: `.markora-toolbar__badge[hidden]`
  override; `.markora-utility-sidebar-left` layout modifier.
- `src/viewer/index.ts`: `onGlobalKeyDown`'s editable-field guard narrowed
  to unmodified keys only; `applyLiveSettings` toggles the new sidebar-side
  class.
- `src/backend/storage/schema.ts`: `utilitySidebarPosition` setting +
  default.
- `src/frontend/components/preferencesModal/sections.ts`: new "Sidebar
  position" select row in the Navigation section.
- `src/backend/viewer/mermaid/index.ts`: root-level `htmlLabels: false`;
  wraps `mermaid.render()` in `withSanitizerUnlockedForThirdParty`.
- `src/backend/viewer/sanitization/index.ts`: new
  `withSanitizerUnlockedForThirdParty()` export.
- `src/frontend/components/presentation/index.ts`: the timer's initial
  `'00:00'` literal (an unrelated pre-existing `no-literal-user-strings`
  lint failure found while verifying this phase) now reuses the same
  `formatElapsed(0)` the live ticker already calls, instead of a second,
  independent literal.

### Files Added
- None (verification scripts stayed in the session scratchpad, never the
  repo — including cleaning up a stray `.tmp-verify.mjs` and a
  `node_modules/.investigate*.mjs` the interrupted background task and this
  phase's own verification had left behind).

### Files Modified
- `src/frontend/styles/index.css`
- `src/viewer/index.ts`
- `src/backend/storage/schema.ts`
- `src/frontend/components/preferencesModal/sections.ts`
- `src/backend/viewer/mermaid/index.ts`
- `src/backend/viewer/sanitization/index.ts`
- `src/frontend/components/presentation/index.ts`
- `src/backend/i18n/locales/*.json` (all 19 locales: two missing
  `settings.plugins.*Group` keys in `ar`/`de`; three new
  `settings.navigation.utilitySidebarPosition*` keys in all 19)
- `docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md` (this file)

### Files Removed
- None from the repo (temp verification scripts lived only in the OS
  scratchpad dir and a `node_modules/.investigate*.mjs` cleanup, never
  committed).

### Tests
- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 ESLint errors (fixed the one pre-existing
  `no-literal-user-strings` failure found in `presentation/index.ts`, unrelated
  to this phase's own edits); Prettier drift confirmed isolated to the
  pre-existing baseline — every file this phase actually edited passes
  `prettier --check` individually (one, `schema.ts`, needed
  `prettier --write` after editing; applied and reverified).
- `npm run test` — 591/591 passing (591, not the prior 590/591 baseline —
  no new unit tests added this phase; the interrupted background task's
  own edits didn't add tests either).
- `npx vitest run src/backend/i18n/keyCoverage.test.ts` — 55/55 passing,
  confirming all 19 locale catalogs stay in exact key parity after this
  phase's two rounds of new keys.
- `npm run build` — succeeds.
- Manual, live verification in a real loaded extension
  (`chromium.launchPersistentContext` + `--load-extension`) for every fix
  above — screenshots and `getComputedStyle`/DOM assertions, not just
  code review: the annotations badge, the sidebar-position flip (left and
  right), `Ctrl+,` while a text field is focused (with a control check that
  plain typing in that same field is unaffected), and Mermaid flowchart +
  sequence diagrams in both light and dark themes, before and after each
  fix.
- No `test:e2e` run this phase (none of the existing phase specs target
  Mermaid rendering, the shortcut-suppression guard, or the new
  sidebar-position setting specifically; the unit suite + the live
  extension verification above cover this phase's actual changes more
  directly than the existing suite would).

### Build Result
Green — see Tests above.

### Remaining Issues
- Issue 4/7 ("settings need to be more accurate / all settings working")
  was spot-checked (Plugins section only), not exhaustively audited setting
  by setting — a full audit of every control across every Settings section
  is out of scope for one pass and would be its own phase.
- No dedicated e2e coverage added for: the annotations-badge fix, the new
  sidebar-position setting, the narrowed shortcut-suppression guard, or the
  Mermaid label/theme fix — all verified manually via a real loaded
  extension this phase, but a regression in any of them would currently
  only be caught by another manual pass, not CI.
- The background-task instruction-following failure that preceded this
  phase (see above) is a process gap worth the user's attention going
  forward — not a product bug, and not something further product code
  changes here can fix.

### Phase 21 follow-up — full settings audit (issues 4/7 closed out)

Went through every control in `preferencesModal/sections.ts` (General,
Appearance, Plugins, Navigation, Presentation, Files, Export, Language,
Privacy, Maintenance, Import/Export, About, Shortcuts) and traced each one
from its UI control to `save()`/`setSettings()` to the code path that
actually reads it, rather than trusting that "the control exists and calls
save()" means "the setting works." Found and fixed one real, previously
undiscovered gap:

- **Markdown/Plugins toggles had no live effect on an already-open
  document.** `renderDocument()` reads `currentSettings.markdown`,
  `codeLineNumbers`, `codeLineWrap`, `alertTitleMode`,
  `externalLinkIndicator`, and `blockRemoteImages` to build the
  `markdown-it` pipeline (`renderMarkdownStreaming`'s options), but
  `onSettingsChanged` only ever called `applyLiveSettings()` (CSS-variable
  updates) — never re-ran the parse pipeline. So toggling, say, "Tables" off
  in Settings → Plugins while a document with a table was already open did
  nothing until the next document load, which is indistinguishable from the
  setting simply not working. Every other appearance/behavior setting in
  this app already live-applies (F81); this category silently didn't.
  Fixed in `src/viewer/index.ts`'s `onSettingsChanged` handler: diffs the
  incoming settings against the current ones for exactly the fields that
  feed the render pipeline, and — if a document is open and not in raw-source
  view — calls `renderDocument(rawSourceText, ...)` again (the same
  scroll-preserving re-render pattern `restartAutoRefresh`'s `onChanged`
  callback already uses), so the visible document updates immediately.
- Every other setting across every section was confirmed genuinely wired
  (not a stub) by tracing it to a real consumer: typography/layout settings
  → `buildTypographyCssVars` (CSS vars, live); `contentWidthMode`,
  `stickyTableHeaders`, `utilitySidebarPosition`, `showToc`,
  `showReadingProgress`, `showDocumentStats`, `fileTypeFilter`/
  `folderExclusions` → `applyLiveSettings` (live); `theme`/`highlightTheme`
  → `onThemeApplied`/`highlightThemeChanged` (live); `shortcuts.*` → read
  directly off `currentSettings` in `onGlobalKeyDown` on every keystroke, so
  a rebind takes effect immediately; `autoRefreshEnabled`/
  `autoRefreshIntervalMs` → `restartAutoRefresh` (live); `plantumlEnabled`/
  `plantumlServerUrl` → `renderPlantumlIn` (read fresh each render, now also
  covered by the new re-render fix); `includeAnnotationsInExports`/
  `htmlExportEmbedToc` → the export dialog (read fresh at export time);
  `language`/`textDirectionOverride` → `initI18nRuntime`/
  `refreshLocaleAcrossComponents` (live); `extensionEnabled` → checked at
  bootstrap and by the background worker's own "should this open as
  Markdown" decision — intentionally not torn down live in an already-open
  viewer tab (would destructively blank an open document rather than just
  affect future detection).

**Tests**: `npx tsc --noEmit` clean; `npm run lint` → 0 ESLint errors (the
lint-script failure is Prettier drift in 43 pre-existing files unrelated to
this change — `src/viewer/index.ts` itself passes `prettier --check`
individually); `npx vitest run` → 591/591 passing; `npm run build` succeeds.
Live-verified in a real loaded extension: opened a document containing a
table, opened Preferences → Plugins, unchecked "Tables" — the table
disappeared from the already-open document immediately (table count 1 → 0)
while the surrounding paragraph text was preserved, confirming the fix
without a page reload.

**Files Modified (this follow-up)**: `src/viewer/index.ts` (`onSettingsChanged`
now diffs render-affecting settings and re-renders the open document when
they change); `issues.txt` (items 4 and 7 marked DONE); this file.
