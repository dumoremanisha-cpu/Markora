# Markora — Phase-Wise Implementation Plan

- Status: Planning complete, awaiting approval to begin Phase 0
- Date: 2026-09-08
- Product: Markora (working name "MarkdownView Pro"), Chrome MV3 extension
- Source specs: `docs/specs/00-overview.md` through `docs/specs/08-glossary-references.md`, `referenece/projectDetails.md`
- Related ADRs: `docs/adr/0001-file-access-and-detection.md`, `0002-diagram-rendering-strategy.md`, `0003-annotation-identity-and-reanchoring.md`, `0004-storage-schema-and-quota.md`, `0005-export-architecture.md`, `0006-viewer-surface-and-content-acquisition.md`, `0007-i18n-architecture.md`, `0008-mdx-handling-and-safe-degradation.md`, `0009-user-custom-css-sanitization.md` (Proposed — gates Phase 12)
- Revision 2026-09-08 (post-audit): Phase 2 split into 2-A/2-B; demo document (F46) moved to Phase 2-A; i18n key system + English catalog moved to Phase 1 per ADR-0007; F05 opt-in descoped; annotation-in-export tasks added to Phases 7-A/7-B; Clear Cache scope pinned; Phase 9 network-audit criterion corrected
- Revision 2026-09-28 (post-v1 checklist audit): Phases 0–10 are complete. Auditing the user-maintained `featureslist.md` (125 items) against the shipped code added feature-matrix rows F82–F88 and two post-v1 phases — **Phase 11** (back-to-top, zen mode, rich clipboard copy, diagram-preserving DOCX, extra reading surfaces) and **Phase 12** (user custom CSS, gated on ADR-0009 being Accepted). F88 (self-hosted Gitea) is recorded as a design note in `docs/specs/07-permissions-compliance.md` §2 amendment 4 and is deliberately **not scheduled**. `featureslist.md` #96 ("no true PDF encoder") was assessed and closed as resolved-by-design — see `docs/specs/02-feature-matrix.md`. Module paths in the pre-2026-09-28 sections below predate the `src/frontend/` ÷ `src/backend/` restructure; Phases 11–12 use current paths
- Revision 2026-09-08b (audit close-out): quality gate extended to the full F-range (`06 §3`/`§5`); performance budgets P1–P14 defined in `06 §1a` and cited by every phase that previously said "measured, not assumed"; the `activeTab` "Render this page as Markdown" action given an owning task (Phase 2-B task 11, adds `activeTab` + `scripting`); Flow A `file://` E2E reclassified from Integration to Manual with the predicate unit-tested

## How to use this document

This plan exists so that **each phase can be implemented in its own,
context-limited Claude Code session**, without that session needing to read
the entire spec set or this entire plan. Every phase section is
self-contained: it states its own dependencies, its own feature scope, and
its own recommended session prompt. A session implementing Phase N should
read: this document's Phase N section only, the ADR(s) that section
references, the feature-matrix rows for its assigned F-IDs, and whichever
`docs/specs/` sections its own "Technical tasks" cite — not the whole spec
set or the whole plan.

**Repository state as of this plan (2026-09-08):** no implementation exists.
No `package.json`, no `src/`, no build tooling, no lockfile. Only
documentation (`docs/specs/`, `docs/adr/`, `docs/plans/`, `referenece/`,
`UI/` screenshots). Phase 0 is the first phase that touches the filesystem
in a way that creates project scaffolding — but does not write feature code.

**Monetization stance (applies to every phase):** v1 ships 100% free. No
phase implements payment, subscriptions, accounts, a license server, or
feature gating. The only monetization-adjacent work is the reserved
`licenseStatus: "free"` storage field (ADR-0004) and the static "License
status: Free" UI element (F58, Phase 10) — neither has any backing
validation logic.

## Phase overview

| Phase | Name | Depends on | Feature count |
|---|---|---|---|
| 0 | Repository & Architecture Validation | — | 0 (spikes only) |
| 1 | Foundation & Core Viewer | 0 | 11 (+ F37 partial: i18n system) |
| 2-A | Markdown Pipeline & Content Rendering | 1 | 14 |
| 2-B | Reading UI, Navigation & Settings | 2-A | 11 |
| 3-A | Math & Core Diagrams (KaTeX, Mermaid) | 2-A, 2-B | 3 |
| 3-B | Extended Diagrams (Graphviz, PlantUML) | 3-A | 2 |
| 4 | File & Project Management | 1, 2-B | 13 |
| 5 | Reading Productivity & Annotations | 2-A, 2-B | 6 |
| 6 | Presentation & Mind Map | 2-B, 3-A | 4 |
| 7-A | Export: HTML & Print/PDF | 2-B, 3-A, 3-B, 5 | 3 |
| 7-B | Export: DOCX | 3-A, 5, 7-A | 1 |
| 8 | Internationalization & RTL | 1, 2-B, 6, 7-A, 7-B | 2 |
| 9 | Complete QA, Security & Performance | all above | 3 (+ full re-verification) |
| 10 | Production Polish & Release | 9 | 5 |
| 11 | Reading-Experience & Export-Fidelity Follow-ups *(post-v1)* | 10 | 5 |
| 12 | User Custom CSS *(post-v1, gated on ADR-0009)* | 10, 11 | 1 |

78 of 81 v1 feature IDs are mapped (F61, F66, F77 are intentionally unused —
see `docs/specs/02-feature-matrix.md`). The 2026-09-28 revision adds F82–F88:
F82–F86 to Phase 11, F87 to Phase 12, and F88 unscheduled by decision — so
84 of the 88 defined IDs are mapped to a phase. Full traceability table is in
"Feature-to-phase mapping" at the end of this document.

**Why Phase 2 is split (revision 2026-09-08):** the original single Phase 2
carried 24 features and 18 technical tasks — far larger than any other phase
and incompatible with this plan's own one-session-per-phase premise. 2-A owns
the Markdown pipeline and everything that renders *inside* the document; 2-B
owns the reading UI *around* it (TOC, toolbar, search, settings, lightbox,
responsive layout). 2-B depends on 2-A only for having content to attach to.

**Why 7-A/7-B now depend on Phase 5:** annotations must be reproduced in
exports (`docs/specs/01-functional-requirements.md` §21/§24, ADR-0005) —
previously an unnoticed gap between the parity record and the requirement set.

---

## Phase 0 — Repository & Architecture Validation

### 1. Goal

Stand up the empty project skeleton (manifest, TypeScript, Vite, lint/test
config) and run the small number of technical spikes needed to de-risk
decisions the rest of the plan depends on — **before** any feature code is
written. This phase produces no user-facing functionality.

### 2. Dependencies

None. This is the first phase.

### 3. Features

None. This phase validates architecture, it does not implement features.

### 4. Technical tasks

1. Initialize `package.json`, TypeScript config, Vite config with an MV3
   extension plugin (e.g. `@crxjs/vite-plugin` or equivalent — verify current
   MV3-Vite tooling compatibility with the latest Vite major version before
   committing to a specific plugin).
2. Create the base `src/` module layout per `docs/specs/03-architecture.md`
   §2 (empty directories with a placeholder/index file each — no logic).
3. Write a minimal `manifest.json`: `manifest_version: 3`, name/description
   (original, not MarkView's), version `0.0.0`, only the `storage` permission
   declared so far (every other permission is added by the phase that first
   needs it, per `docs/specs/07-permissions-compliance.md` §3's checklist —
   applied at the point of introduction, not upfront).
4. **Spike 1 — CSP + WASM**: create a throwaway extension page that loads a
   small WASM module under MV3's default `extension_pages` CSP with
   `wasm-unsafe-eval` added to `script-src`, confirm it instantiates. Load
   unpacked in Chrome and confirm no CSP console errors. This validates the
   Graphviz approach in ADR-0002 before Phase 3-B is built on top of it.
5. **Spike 2 — Mermaid under MV3 CSP**: render one Mermaid diagram in a
   throwaway extension page with `securityLevel: 'strict'` and the project's
   locked-down CSP (no `unsafe-eval`/`unsafe-inline`). Confirm no CSP
   violations from Mermaid's internals (its dependency chain — d3, dagre,
   or similar — has occasionally used patterns that trip strict CSPs in some
   versions). Record the exact Mermaid version validated.
6. **Spike 3 — File System Access API from an extension page**: confirm
   `showOpenFilePicker()`/`showDirectoryPicker()` work from a normal
   extension page (not the popup) with a user gesture, and that a
   `FileSystemDirectoryHandle` can round-trip through IndexedDB
   (store → reload extension → retrieve → `queryPermission()`). Validates
   ADR-0001 Flow B before Phase 4.
7. **Spike 4 — content-script path-glob matching**: confirm Chrome accepts
   and correctly scopes `content_scripts.matches` patterns like
   `*://*/*.md` (matches only URLs whose path ends in `.md`, not all URLs)
   by loading the unpacked extension and testing against a few real URLs.
   Validates ADR-0001 §2 before Phase 1.
8. **Spike 5 — content-script → viewer handoff (ADR-0006)**: on a real
   plain-text URL, read `document.body.innerText` from a content script,
   pass it to the service worker, store it in extension-origin IndexedDB,
   `location.replace()` to an extension page, read the record back, and
   confirm (a) a ~5 MB payload survives the round-trip, (b) `location.hash`
   is preserved, (c) Back returns to the previous site rather than
   re-triggering the redirect. Validates the backbone of Phase 1.
9. Set up `eslint` + `prettier` (or equivalent) and `vitest` with a single
   trivial passing test, confirming `npm run test` and `npm run lint` both
   execute cleanly on the empty skeleton. Include a `dev` script
   (`npm run dev`) alongside `build`/`test`/`lint`, per
   `referenece/projectDetails.md` §54.
10. Set up Playwright with a minimal extension-loading smoke test (loads the
    built `dist/` as an unpacked extension in a persistent context, opens
    the popup, asserts it renders) — establishes the E2E harness pattern
    every later phase's E2E tests will reuse. Also add the axe-core
    accessibility helper here so later phases can assert a clean a11y pass
    on each new surface rather than deferring all of F38 to Phase 9.

### 5. Architecture changes

Creates (empty/skeleton only): `src/background/`, `src/content/`,
`src/viewer/`, `src/components/`, `src/export/`, `src/settings/`,
`src/popup/`, `src/i18n/`, `src/storage/`, `src/utils/`, `src/styles/`,
`manifest.json`, `vite.config.ts`, `tsconfig.json`, `.eslintrc`,
`vitest.config.ts`, `playwright.config.ts`.

### 6. Data/storage changes

None yet — `src/storage/` is an empty placeholder; ADR-0004's schema is
implemented starting in Phase 1.

### 7. Security requirements

- `manifest.json`'s `content_security_policy.extension_pages` is set from
  the start to the strict baseline (`script-src 'self'; object-src 'self'`)
  plus `wasm-unsafe-eval` (validated by Spike 1) — never loosened further by
  any later phase without a new ADR.
- No permission beyond `storage` is declared in this phase.

### 8. Tests

- Unit: one trivial Vitest test confirming the test runner works.
- Integration: none yet.
- Security: none yet (nothing renders content yet).
- Manual: load unpacked `dist/` at `chrome://extensions`, confirm it
  installs with zero console errors and zero permission warnings beyond
  `storage`.

### 9. Verification commands

```
npm install
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- `npm run build` produces a loadable unpacked `dist/`.
- All five spikes (CSP+WASM, Mermaid+CSP, FSAA+IndexedDB round-trip,
  content-script path-glob matching, content-script→viewer handoff) pass and
  are recorded with the exact library/Chrome versions validated.
- Lint, unit test, and Playwright smoke test all pass with zero errors.
- `manifest.json` requests only `storage`.

### 11. Known limitations

- None yet — this phase exists specifically to surface limitations before
  they become expensive. Any spike that *fails* must be recorded here with
  its fallback (e.g. if Mermaid's default build fails the strict-CSP spike,
  record which Mermaid version/config does pass).

### 12. Documentation updates

- Create `README.md` stub (install/build commands only — full content in
  Phase 10).
- Create `DEVELOPMENT.md` documenting the spike findings and exact tool
  versions chosen (Vite plugin, Vitest, Playwright, ESLint config).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 0 (Repository & Architecture Validation) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. Read: this
> plan's Phase 0 section, `docs/specs/03-architecture.md` §1–2,
> `docs/specs/07-permissions-compliance.md` §1, and
> `docs/adr/0006-viewer-surface-and-content-acquisition.md` §2 (for Spike 5).
> The repository currently has no implementation — confirm that first. Do
> not implement any feature beyond scaffolding and the five spikes described. Run the verification
> commands listed in Phase 0 §9, fix anything they surface, then update
> `DEVELOPMENT.md` with spike results and stop. Do not start Phase 1.

---

## Phase 1 — Foundation & Core Viewer

### 1. Goal

A working, minimal end-to-end path: open a local Markdown file (both access
flows) or a curated raw-Git-host URL, and see it rendered — safely
sanitized, unstyled-but-functional — in the viewer extension page, with a
basic popup and the theme/notification/storage foundations every later
phase builds on.

### 2. Dependencies

Phase 0 complete (scaffolding, spikes passed).

### 3. Features

F01, F02, F03, F04, F05, F06, F07 (file-open only; folder-open UI deferred
to Phase 4), F34, F40, F54, F78, **F37 in part** (the i18n key system,
`t()` accessor, English catalog, `_locales/en`, and the no-literal-strings
lint rule — per ADR-0007; the other 18 locales, "Auto" resolution, live
switching and RTL remain Phase 8).

### 4. Technical tasks

1. Implement the **ADR-0006 handoff mechanism** first — every other detection
   task depends on it: content script reads the already-loaded document text
   (no `fetch`), `chrome.runtime.sendMessage({type:'handoff/create', …})` →
   service worker writes a single-use, TTL-swept record into extension-origin
   IndexedDB → content script `location.replace()`s to
   `viewer.html?src=…&h=<token>` + the original `location.hash`. The viewer
   reads the record once and deletes it. Implement the two-message contract
   (`handoff/create`, `detection/ping`) and nothing wider.
2. Implement ADR-0001 Flow A: `file:///*`-matching content script, path-
   suffix detection (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`), feeding
   the same handoff path. Declare `"file:///*"` in `host_permissions` (inert
   until the user enables the file-URL toggle) — needed by Phase 4's
   auto-refresh, per ADR-0006 §4.
3. Implement ADR-0001 Flow B (file only, not folder yet): "Open file" via
   `showOpenFilePicker()` from the viewer page.
4. Implement ADR-0001 §2 narrow content-script path-glob matching for the
   curated raw-Git-host list + generic `.md`/`.markdown`/`.mdown`/`.mkd`/
   `.mdx` suffix patterns + the exact filename `llms.txt`. **No `*.txt` glob
   and no content-type sniffing** (ADR-0001 §2, `docs/specs/03-architecture.md`
   §5).
5. Implement the never-auto-replace policy (F05): GitHub blob/repo, GitBook
   and Read the Docs URLs are simply absent from the match patterns.
   **No opt-in toggle and no settings stub is built** — the override is
   descoped from v1 (ADR-0001 §3 amendment, `03-architecture.md` §5). Add a
   detection unit test asserting those URL shapes never match.
6. Preserve the source URL for display: the viewer shows the original
   path/URL in its document header with a copy action (ADR-0006 §5 — the
   address bar now shows `chrome-extension://`).
7. Implement drag-and-drop (F06) onto the viewer page with a visible drop
   zone.
8. Build the core pipeline skeleton: load raw text → minimal markdown-it
   parse (GFM defaults, no plugins yet — those arrive in Phase 2-A) →
   DOMPurify sanitize → mount into viewer DOM. This establishes the
   parse → sanitize → enhance separation from `03-architecture.md` §3 that
   every later rendering phase extends.
9. Implement `src/storage/` per ADR-0004: typed wrapper, schema version 1,
   `Settings` type with the fields needed so far (theme, `language`,
   `licenseStatus`), migration registry (empty), plus the
   `chrome.storage.onChanged` broadcast subscription every surface uses to
   pick up settings changes made elsewhere (foundation for F81).
10. **Implement the i18n system per ADR-0007** (moved here from Phase 8 —
    `docs/specs/01-functional-requirements.md` §28 requires it from the first
    line of UI code): `src/i18n/` catalog loader (bundled JSON, lazy per
    locale, never remote), typed `t(key, params)` with escaped-text
    interpolation, key convention `area.component.element`, English catalog,
    `_locales/en/messages.json` + `__MSG_*__` manifest substitution with
    `default_locale: "en"`, English-only fallback behaviour, and the
    **`no-literal-user-strings` lint rule** wired into `npm run lint`. Every
    subsequent phase writes `t('…')` from its first commit — there is no
    retrofit pass.
11. Implement theme system (F34): light/dark/system, CSS custom properties
    in `src/styles/`, persisted via storage wrapper, applied to the viewer
    shell (content-area theming expands as content types are added in later
    phases).
12. Implement the unified notification/toast component (F78): 4 types
    (success/error/warning/info), used from this phase onward for every
    transient message in the product — no feature after this point may build
    its own ad hoc toast.
13. Build the popup shell (F40): tabbed structure (Setup / Recent
    Documents-placeholder / Settings / Help-placeholder), lightweight only —
    no full app logic in the popup. Setup tab implements the file-URL-access
    onboarding UX (F02) matching the screenshot-verified flow in
    `docs/specs/08-glossary-references.md` §4. Per
    `docs/specs/01-functional-requirements.md` §31 and
    `03-architecture.md` §8, the popup also carries a **theme control**
    (F34) and **"Open file" / "Open folder" launchers** — the launchers
    focus (or open) the viewer page and trigger the File System Access
    picker *there*, never in the popup (ADR-0001 Flow B); "Open folder" is
    wired to a viewer-side handler that stays disabled until Phase 4.
    Folder *browsing* and bookmark *management* never live in the popup.
14. Implement the master "Extension Enabled" toggle (F54) in the popup
    Settings tab — when off, the content scripts/viewer no-op cleanly (must
    not partially render then bail).
15. Implement baseline malformed-Markdown robustness: confirm the pipeline
    never crashes/blanks on broken input (best-effort render + continue),
    per `docs/specs/01-functional-requirements.md` §2.

### 5. Architecture changes

New/filled-in modules: `src/content/` (detection + match-pattern handling +
handoff producer), `src/background/` (message routing and handoff record
store only — no business logic per `03-architecture.md` §8),
`src/viewer/markdown/` (parse pipeline entry point),
`src/viewer/sanitization/` (DOMPurify config + URL/protocol allowlist),
`src/storage/` (incl. the IndexedDB handoff store, ADR-0006), `src/i18n/`
(ADR-0007), `src/popup/`, `src/styles/` (design tokens, light/dark themes),
`src/components/notifications/`, `src/components/toolbar/` (empty shell
only — full toolbar in Phase 2-B).

### 6. Data/storage changes

Implements ADR-0004's schema version 1 for the `Settings` slice only
(theme, `language`, `licenseStatus`, `extensionEnabled`). Adds the
extension-origin IndexedDB database with the `handoff` object store
(ADR-0006). Recents/bookmarks/annotations schemas are added in their
respective phases (4, 4, 5) — not created empty here, to avoid speculative
schema that Phase 4/5 might need to change.

### 7. Security requirements

- DOMPurify sanitization is mandatory on **every** path that produces HTML
  from document content, from this phase forward — no exceptions, no
  "temporary" unsanitized render path, even for internal testing.
- Safe URL handling (block `javascript:`/other script-executing schemes) in
  the sanitizer config from the first commit — this is foundational, not
  deferred.
- Confirm the content script cannot message the background service worker
  with anything beyond the narrow, typed message contract needed for
  hand-off (no generic "eval this" message shape) — exactly the two message
  types in ADR-0006 §7.
- Handoff records are single-use, deleted on read, and TTL-swept at service
  worker start-up; a test asserts no document text remains in IndexedDB after
  the viewer has rendered (ADR-0006 §2).
- Assert via a Playwright network assertion that opening a matched remote URL
  produces **no re-fetch of the source URL** by the extension (the viewer
  renders handed-off text, per ADR-0006 §2).

### 8. Tests

- Unit: markdown-it pipeline (headings/paragraphs/basic GFM render
  correctly), sanitizer strips `<script>`/event handlers/`javascript:`
  URLs, storage wrapper read/write/migration-registry-noop.
- Unit: the **detection predicate** (does this URL/path/contentType qualify?)
  against a fixture table of `file://`, raw-Git-host, suffix-glob,
  `llms.txt`, and must-not-match URLs (GitHub blob/GitBook/RTD, arbitrary
  `.txt`). This is the automated half of Flow A coverage.
- Integration: content-script detection and handoff fire on a mocked
  raw-Git-host URL; drag-and-drop loads a file into the viewer.
- **Manual (not automatable — corrected 2026-09-08):** the full Flow A
  `file://` round-trip. Chrome's "Allow access to file URLs" toggle cannot
  be set by a launch flag, by Playwright, or by the extension itself, so
  there is no way to exercise this path automatically. The predicate is
  unit-tested above; the end-to-end path is verified by hand via
  `docs/specs/06-testing-quality-gate.md` §4 **step 3a** (and step 3b
  confirms Flow B works with the toggle *off*). Do not write a test that
  pretends to simulate the permission — it would assert nothing real.
- Security: XSS payloads (script tags, event-handler attributes,
  `javascript:` links/images) all render inert — first instance of the
  security test set from `docs/specs/06-testing-quality-gate.md` §3, run
  early rather than deferred to Phase 9.
- Manual: install unpacked, open a real local `.md` file via both flows,
  open a real raw GitHub URL, confirm theme toggle and extension-enabled
  toggle both work.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```
Plus manual Chrome install pass per `docs/specs/06-testing-quality-gate.md`
§4 steps 1–3 (build, load unpacked, and **both** local-file flows — 3a
`file://` with the toggle on, 3b picker with the toggle off) and step 4 (raw
GitHub Markdown). Step 3a is the documented manual substitute for the
un-automatable Flow A E2E path.

### 10. Exit criteria

- A real local `.md` file opened via double-click (Flow A, with the toggle
  enabled) renders correctly.
- A real local `.md` file opened via "Open file" (Flow B) renders correctly.
- A real `raw.githubusercontent.com` URL auto-renders.
- Drag-and-drop works.
- Theme toggle (light/dark/system) works from both the viewer and the popup,
  and persists across reload.
- Master enable/disable toggle works.
- Every user-facing string in the viewer and popup resolves through `t()`;
  `npm run lint` fails on a deliberately re-introduced literal string
  (proves the ADR-0007 lint rule is actually enforcing, not just configured).
- Opening a matched remote URL performs no re-fetch of that URL by the
  extension, and leaves no handoff record behind.
- The security XSS test set passes (renders inert, never executes).
- Malformed Markdown does not crash or blank the viewer.

### 11. Known limitations

- Folder opening exists in the popup only as a disabled/placeholder launcher
  (full implementation in Phase 4).
- No syntax highlighting, TOC, diagrams, or math yet — plain sanitized GFM
  only.
- **GitHub-blob/GitBook/RTD opt-in rendering is not built and is not a stub —
  it is descoped from v1** (ADR-0001 §3 amendment). F05 ships as the
  unconditional negative behaviour: those sites are never matched.
- The address bar shows the extension viewer URL rather than the source URL
  (ADR-0006 §5); mitigated by the source-URL display + copy action in the
  document header.
- Only the English catalog exists; the UI is English-only until Phase 8, but
  every string is already a catalog key (ADR-0007) — no retrofit is pending.
- If Chrome downloads rather than displays a matched resource, no content
  script runs and no handoff occurs; the documented fallback is "Open file"
  or drag-and-drop (ADR-0006 §Consequences).
- **Flow A (`file://`) has no automated end-to-end coverage** — the
  file-URL toggle cannot be set programmatically by any available mechanism.
  Mitigated by unit-testing the detection predicate and by a mandatory
  manual step (`06 §4` step 3a) in every install pass; stated plainly rather
  than papered over with a fake "simulated permission" test.

### 12. Documentation updates

- `docs/specs/02-feature-matrix.md`: no edits (spec docs stay authoritative
  as-is); implementation status tracking happens in this plan's
  traceability table, updated as phases complete.
- `SECURITY.md` stub created, documenting the sanitization approach
  implemented so far.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 1 (Foundation & Core Viewer) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> the current repository state (Phase 0 should already be complete — verify
> what actually exists in `src/`, `manifest.json`, and config files before
> assuming anything). Read: this plan's Phase 1 section,
> `docs/adr/0006-viewer-surface-and-content-acquisition.md` **in full** (it
> defines the handoff mechanism the rest of this phase hangs off),
> `docs/adr/0001-file-access-and-detection.md`,
> `docs/adr/0007-i18n-architecture.md` (§1–2, §5–6),
> `docs/adr/0004-storage-schema-and-quota.md` (Settings/schema-version
> sections only), and feature-matrix rows F01–F07, F34, F37, F40, F54, F78 in
> `docs/specs/02-feature-matrix.md`. Implement only what's listed in this
> phase's Technical tasks — no syntax highlighting, diagrams, math, TOC, or
> folder browsing (those are later phases), and no locale catalogs beyond
> English. Do **not** build a GitHub-blob/GitBook/RTD opt-in toggle — it is
> descoped from v1. Run the verification commands and manual test steps in
> Phase 1 §9, fix anything they surface, update `SECURITY.md`, report what
> was implemented and tested, and stop. Do not start Phase 2-A.

---

## Phase 2-A — Markdown Pipeline & Content Rendering

### 1. Goal

Bring the *document* to full richness: complete GFM plus extensions, custom
containers, GitHub alerts, front matter, safe MDX, syntax highlighting with
selectable themes, Unicode-safe anchors and deep-linking, external-link
treatment, and sticky tables. Everything in this phase renders **inside** the
document; the reading UI around it is Phase 2-B.

### 2. Dependencies

Phase 1 complete (pipeline skeleton, sanitizer, theme system, storage
wrapper, i18n system, notifications, popup shell all exist).

### 3. Features

F08, F09, F10, F25, F26, F43, F44, F46 (demo/fixture document — created
here, extended by later phases, finalized in Phase 10), F60, F67, F68, F69,
F70, F72. Settings *controls* for F69/F70 land in Phase 2-B's options page;
this phase makes both configuration-driven.

### 4. Technical tasks

1. Extend the markdown-it pipeline with GFM plugins: tables, footnotes, task
   lists, definition-list-style content, front matter parsing (F43 —
   rendered as an info card, not raw YAML), typographer, line-breaks —
   **each individually toggleable** through a pipeline config object (F69),
   not one bundled GFM switch. The config is read from `Settings`; its UI
   arrives in 2-B.
2. Implement custom containers (F67: `:::info`, `:::warning`/`:::caution`,
   `:::danger`, `:::details` collapsible, `:::spoiler`) as a markdown-it
   plugin producing styled callout components.
3. Implement GitHub-style alerts (F44: the five `> [!NOTE]` etc. types),
   visually distinct from but consistent with the custom containers, with
   titles resolved through `t()` from the first commit (English catalog now,
   other locales in Phase 8) and a setting to show literal keywords instead.
4. Implement graceful-degradation handling for extended doc-component
   syntax (F68 — Mintlify-style tabs/callouts): strip the unrenderable
   component wrapper while preserving inner text content, never showing raw
   unrendered tags. This shares its implementation with task 5's component
   rules (ADR-0008 rules 4–5).
5. Implement safe MDX handling (F09) **exactly per
   `docs/adr/0008-mdx-handling-and-safe-degradation.md`**: a pre-parse text
   transform (ESM statements removed, capitalized component tags stripped
   with inner content preserved, self-closing components replaced by a
   visible placeholder chip, all component attributes discarded, `{/* */}`
   comments removed, other braces left literal, code/math regions extracted
   and restored untouched) feeding the normal markdown-it + DOMPurify path.
   **Never** invoke an MDX compiler, `eval`, or `new Function`. Transform
   failure falls back to rendering the source as a fenced code block with an
   inline notice.
6. Integrate a syntax highlighter (highlight.js or equivalent) covering the
   spec's minimum language list, with per-block language label, copy
   button, optional line numbers, optional line wrap, and a selectable set
   of ~14 curated highlight themes (F70) working in both light and dark app
   themes; themes load on demand rather than all at once (final exact
   14-theme list is an implementation-time curation choice within this
   phase, not a re-litigated spec decision).
7. Implement Unicode-safe heading-anchor generation and URL-fragment
   deep-linking on load (F60) — slugification must handle non-ASCII headings
   correctly, and a `#fragment` carried through the ADR-0006 handoff must
   scroll to and highlight the right heading. TOC wiring is 2-B.
8. Implement external-link indicators (F25) shown only on text links, not
   image-wrapped links (F72), with safe target/`rel` handling; hover-
   preview stays **off by default** and, if built at all, only shows the URL
   itself locally — no background metadata fetch (any richer preview is
   explicitly a disclosed, opt-in network feature, out of scope unless
   separately prioritized — do not silently add a network call here).
9. Implement sticky table headers (F26) with preserved horizontal scroll
   and responsive behavior.
10. Build the **bundled demo/fixture document (F46)** — moved here from
    Phase 10 because it is the manual-test vehicle every later phase needs.
    It covers this phase's constructs now (headings, table, code, task
    lists, blockquotes, links, images, containers, alerts, front matter,
    an `.mdx` companion sample) and is **extended by each later phase** as
    Mermaid/Graphviz/PlantUML/KaTeX/annotation/presentation content becomes
    real. Phase 10 finalizes it and wires it into onboarding.
    Also commit the **performance fixtures** every later phase measures
    against: a ~1 MB and a ~5 MB Markdown document (hundreds of headings,
    many code blocks, many images) — the inputs for budgets P1–P5 in
    `docs/specs/06-testing-quality-gate.md` §1a. The 1,000-file folder tree
    (P7/P8) and 50-annotation fixture (P9) are generated by Phases 4 and 5
    respectively and committed the same way.

### 5. Architecture changes

Expands `src/viewer/markdown/` (plugin registration, container/alert/front-
matter plugins, `mdx/` transform per ADR-0008), `src/viewer/syntax/`
(highlighter integration + on-demand theme loading), link-handling utilities
under `src/viewer/markdown/links/`, table enhancement under
`src/components/` (sticky headers), and the demo document as a static asset.

### 6. Data/storage changes

Extends the `Settings` schema (ADR-0004) with the per-feature Markdown
toggles (F69), highlight-theme selection (F70), alert-title-localization
preference, and link-indicator/hover-preview flags — added to the typed
`Settings` interface in one place, with defaults. UI for them is 2-B.

### 7. Security requirements

- Every new markdown-it plugin (containers, alerts, front matter, etc.)
  output still passes through the same DOMPurify sanitization pass — no
  plugin gets a bypass.
- The MDX transform is **not** a sanitizer and must never be treated as one:
  DOMPurify remains the boundary (ADR-0008 §Consequences). Verify that
  component attributes (`onClick={…}`, `dangerouslySetInnerHTML={…}`) never
  reach the output at all, and that brace expressions render as literal text.
- External-link hover preview (if built) must not perform any network
  fetch — verify via Playwright network-request assertions.
- Front-matter values are rendered as text into the info card, never as HTML.

### 8. Tests

- Unit: each markdown-it plugin (containers, alerts, front matter,
  footnotes, task lists) against valid + malformed input; anchor-ID
  slugification against Unicode/non-English headings; the MDX transform
  against every row of ADR-0008's threat-case table plus real `.mdx` samples
  with imports/JSX; per-feature toggle matrix (each plugin on/off).
- Integration: deep-link URL fragment scrolls to and highlights the right
  heading on load; highlight-theme switching; copy button; sticky headers on
  a long table.
- Security: malicious SVG (embedded `<script>`, `onload`, `foreignObject`
  abuse) via image/inline-HTML paths renders inert; every ADR-0008 threat
  case renders inert with zero network requests and zero script execution.
- Manual: `docs/specs/06-testing-quality-gate.md` §3 "Markdown" rows against
  the new demo document.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- All GFM + extension features render correctly against the demo document
  and fixture set (tables, footnotes, task lists, containers, alerts, front
  matter, definition lists).
- Syntax highlighting works across the minimum language list with theme
  switching in both app themes.
- MDX samples render their readable content, show placeholder chips for
  components, and pass every ADR-0008 threat case.
- Unicode headings produce working anchors; a `#fragment` deep-link lands
  correctly on load.
- External-link indicators appear on text links only; sticky table headers
  work.
- The demo document exists and renders end-to-end with no console errors.
- Budgets **P1** (first paint < 1 s @1 MB), **P2** (< 3 s @5 MB) and **P4**
  (no load task > 500 ms) from
  `docs/specs/06-testing-quality-gate.md` §1a are measured against the
  1 MB/5 MB fixtures and met — the parse/render path is chunked if needed to
  hit them.

### 11. Known limitations

- Diagrams and math are not yet rendered (fenced ```` ```mermaid ```` /
  math blocks show as plain code blocks until Phase 3-A/3-B); the demo
  document contains those sections but they render as code for now.
- Markdown feature toggles and the highlight-theme picker have no UI yet
  (Phase 2-B) — they are configuration-driven only.
- MDX support is partial by design (readable content + placeholders, no
  component rendering) per ADR-0008.

### 12. Documentation updates

- `ARCHITECTURE.md` stub: document the pipeline as it actually landed
  (plugin order, where the MDX transform sits relative to sanitization).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 2-A (Markdown Pipeline & Content Rendering) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phase 1 actually built in `src/viewer/`, `src/i18n/`, `src/storage/`
> and `src/styles/` — do not assume, verify by reading the code; all new
> user-facing strings must go through the existing `t()` catalog. Read: this
> plan's Phase 2-A section, `docs/adr/0008-mdx-handling-and-safe-degradation.md`
> in full, and feature-matrix rows F08–F10, F25–F26, F43–F44, F46, F60,
> F67–F70, F72 (cross-reference `docs/specs/01-functional-requirements.md`
> §2, §3, §4, §9, §19, §20, §38, §39 only as needed per task). Implement
> only document-rendering work — no TOC, toolbar, search, settings UI,
> lightbox, diagrams, math or folder browsing (those are Phase 2-B and
> later). Run the verification commands and tests in Phase 2-A §9, fix
> issues, update `ARCHITECTURE.md`, report what was implemented and tested,
> and stop. Do not start Phase 2-B.

---

## Phase 2-B — Reading UI, Navigation & Settings

### 1. Goal

Build the reading experience *around* the document: TOC with scroll-spy,
toolbar, in-document search, image lightbox, raw/rendered toggle, the full
typography/layout settings surface and options-page scaffold, drag-to-resize
sidebars, live-apply, keyboard shortcuts, and the responsive layout
mechanism. By the end of this phase the product is a fully usable Markdown
*reader* (no diagrams/math/annotations/export yet, and only the English
locale).

### 2. Dependencies

Phase 2-A complete (there must be rendered document content, heading
anchors, and a settings schema to attach this UI to).

### 3. Features

F15, F18, F24, F35, F39, F41, F48, F49, F50 (baseline responsive layout —
full cross-device verification in Phase 9), F73, F81, **plus F04's on-demand
fallback action** (see task 11). Also surfaces the settings controls for
Phase 2-A's F69/F70.

### 4. Technical tasks

1. Build the TOC (F15): auto-generated H1–H6 from Phase 2-A's anchors,
   collapsible sidebar, nested hierarchy, scroll-spy, smooth scroll, a
   filter/search input inside the sidebar, mobile drawer conversion, toggle
   shortcut.
2. Build the raw/rendered toggle (F18) with instant switch and configurable
   shortcut.
3. Build the image lightbox (F24): fullscreen, zoom, pan, gallery
   next/prev, counter, close, keyboard nav, lazy loading, graceful broken-
   image placeholders.
4. Build typography/layout settings (F35): font family (bundle ~9 curated
   fonts locally, no CDN — per `docs/specs/04-security-privacy.md` §1),
   size, line height, content width + centered/full-width toggle, code
   font, heading scale, sidebar widths (numeric + drag-to-resize, F73),
   visibility toggles for TOC/progress/stats, code line-wrap, sticky-table
   toggle — all settings apply live without reload (F81), including in
   already-open viewer tabs via the Phase 1 `storage.onChanged`
   subscription.
5. Build the toolbar (F48): back/forward (tab history plus in-viewer
   `pushState` navigation, per ADR-0006 §5), TOC toggle, file-browser toggle
   (wired to Phase 4 once it exists), search, raw/rendered toggle, theme,
   presentation/mind-map/annotations/export entry points (wired to their
   respective later phases — visible but clearly "coming later" stubs),
   settings; becomes compact/sticky on scroll. Also surfaces the source
   path/URL display + copy action introduced in Phase 1.
6. Build in-document search (F49): query input, live match count,
   next/prev, highlighting, keyboard nav, optional case sensitivity.
   Highlighting must wrap matches without re-parsing or re-injecting HTML
   from document content.
7. Build the Settings page scaffold (F41): General, Appearance, Markdown,
   Navigation sections populated with this phase's settings **plus the
   controls for Phase 2-A's Markdown feature toggles (F69) and
   highlight-theme selector (F70)**; Diagrams, Files, Export, Language,
   Privacy, Maintenance, Shortcuts sections exist as empty-but-navigable
   stubs, populated by their owning phases.
8. Implement baseline responsive layout (F50): sidebars collapse to
   drawers, toolbar simplifies, typography stays readable at narrow
   widths — full multi-device verification is a Phase 9 activity, but the
   CSS/layout mechanism is built now, not retrofitted later.
9. Wire baseline keyboard shortcuts (F39): theme toggle, TOC toggle,
   in-document search, `Esc` to close overlays; shortcut-help modal
   (`Ctrl+/`) and user-recordable custom shortcuts (in-page shortcuts are
   app-recordable; `chrome.commands`-registered globals are re-bound by the
   user at `chrome://extensions/shortcuts` — the UI must say which is which).
10. Accessibility baseline for every surface built here (standing
    requirement from this phase onward, not a Phase 9 discovery): keyboard
    reachable, visible focus, labelled controls, focus-trapped dialogs,
    `prefers-reduced-motion` honoured. Each surface must pass the axe
    helper established in Phase 0 and §3's Accessibility area in
    `docs/specs/06-testing-quality-gate.md`.
11. **Build the "Render this page as Markdown" popup action** (F04's
    on-demand fallback — the feature that justifies `activeTab`, which
    until now was declared with nothing implementing it). On click:
    request/consume `activeTab` for the current tab, inject the existing
    detection/handoff content script via `chrome.scripting.executeScript`,
    and let the normal ADR-0006 handoff run. Add `activeTab` **and
    `scripting`** to the manifest at this point (not earlier), each with the
    four-question answer recorded per
    `docs/specs/07-permissions-compliance.md` §3. The action must:
    - be visible/enabled only for a plain-text-looking document
      (`document.contentType` of `text/plain`/`text/markdown`, or a
      single-`<pre>` body) and decline with a clear notification otherwise —
      never render the visible text of an HTML page as Markdown;
    - never fire without an explicit click, and grant no persistent access;
    - be verified by a Playwright test asserting zero activity on any tab
      the user did not click the action for.
    No `contextMenus` permission in v1 — the popup button is sufficient and
    keeps the permission set minimal.

### 5. Architecture changes

New `src/components/toc/`, `src/components/lightbox/`,
`src/components/toolbar/` (full implementation), `src/components/sidebar/`
(TOC container; file-browser sidebar arrives Phase 4),
`src/components/search/`, `src/settings/` (full options-page shell).

### 6. Data/storage changes

Extends the `Settings` schema (ADR-0004) with every field introduced in
this phase's tasks 4, 7, 8, 9 — added to the typed `Settings` interface in
one place, with defaults. No new storage keys beyond `markora.settings`.

### 7. Security requirements

- Search highlighting must wrap matched text nodes directly; it must never
  re-serialize and re-parse document HTML (that would create a second,
  unsanitized injection path into an already-sanitized DOM).
- Lightbox image loading respects the sanitizer's URL-scheme allowlist —
  a `javascript:`/`data:`-scheme image never becomes clickable content.
- The settings UI writes only through the typed storage wrapper; no raw
  `chrome.storage` calls from components (ADR-0004's module boundary).
- Every string added here goes through `t()` — the Phase 1 lint rule must
  still pass with zero suppressions.

### 8. Tests

- Unit: settings defaults/persistence round-trip; shortcut registration and
  conflict detection; responsive breakpoint logic.
- Integration: TOC scroll-spy stays in sync while scrolling a long document;
  search finds/highlights/navigates matches and restores the DOM cleanly on
  close; lightbox gallery next/prev/keyboard nav; drag-to-resize sidebars;
  live-apply of font/size/width changes with no reload, propagating to a
  second open viewer tab.
- Accessibility: keyboard-only traversal of TOC, search, toolbar, lightbox
  and the options page; focus returns correctly after every dialog closes;
  automated axe pass on the viewer and options page.
- Manual: `docs/specs/06-testing-quality-gate.md` §3 "UI" rows at several
  viewport widths.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- TOC (with scroll-spy and filter), in-document search, raw/rendered toggle,
  and the image lightbox all work end-to-end.
- Typography/layout settings apply live, no reload required, and propagate
  to a second open viewer tab.
- The options page exists with this phase's sections populated and later
  phases' sections present as navigable stubs; the Markdown-toggle and
  highlight-theme controls from Phase 2-A are wired and functional.
- Toolbar is present and every wired-up action works (stubs for
  not-yet-built features are visibly "coming in a later phase," not
  silently broken).
- Responsive layout holds at narrow widths; sidebars become drawers.
- "Render this page as Markdown" works on a suffix-less plain-text Markdown
  page, declines cleanly on an HTML page, and touches no tab the user didn't
  click it for; `activeTab` and `scripting` are now justified by shipped
  behaviour.
- Keyboard-only operation of every surface built here works, and the axe
  pass is clean.
- Budgets **P6** (search < 150 ms @1 MB) and **P10** (live-apply < 100 ms,
  no re-parse) from `docs/specs/06-testing-quality-gate.md` §1a are measured
  and met.

### 11. Known limitations

- Diagrams and math are not yet rendered (fenced ```` ```mermaid ```` /
  math blocks show as plain code blocks until Phase 3-A/3-B).
- File browser toolbar button is present but not yet functional (Phase 4).
- Export/annotations/presentation/mind-map toolbar entries are stubs
  (Phases 4–7).
- UI is English-only until Phase 8 (all strings are already catalog keys).

### 12. Documentation updates

- `ARCHITECTURE.md`: extend Phase 2-A's entry with the finalized UI/module
  layout as it actually landed (vs. the spec's proposed layout — note any
  deviations).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 2-B (Reading UI, Navigation & Settings) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phases 1 and 2-A actually built in `src/viewer/`, `src/i18n/`,
> `src/storage/`, `src/popup/`, `src/styles/` — do not assume, verify by
> reading the code; all new strings go through the existing `t()` catalog.
> Read: this plan's Phase 2-B section and feature-matrix rows F15, F18, F24,
> F35, F39, F41, F48, F49, F50, F73, F81 in
> `docs/specs/02-feature-matrix.md` (cross-reference
> `docs/specs/01-functional-requirements.md` §9, §12, §18, §26, §30–32,
> §34–36 only as needed per task — don't re-read the whole file). Implement
> only what's listed in this phase's Technical tasks — no diagrams, math,
> folder browsing, annotations, export, or locale catalogs (those are later
> phases; UI stubs for them are fine). Task 11 adds the first new manifest
> permissions since Phase 0 (`activeTab`, `scripting`): record the
> four-question justification from
> `docs/specs/07-permissions-compliance.md` §3 in your commit. Measure
> budgets P6 and P10 from `docs/specs/06-testing-quality-gate.md` §1a — cite
> the numbers, don't claim "feels fast". Run the verification commands and
> tests in Phase 2-B §9, fix issues, update `ARCHITECTURE.md`, report what
> was implemented and tested, and stop. Do not start Phase 3-A.

---

## Phase 3-A — Math & Core Diagrams (KaTeX, Mermaid)

### 1. Goal

Add KaTeX math rendering and Mermaid diagram rendering — the two
fully-client-side, no-CSP-relaxation-needed renderers — with full
interactivity (fullscreen/zoom/pan/download for Mermaid) and theme sync.

### 2. Dependencies

Phases 2-A and 2-B complete (rendering pipeline, theme system, toolbar all
exist).

### 3. Features

F11, F12, F79.

### 4. Technical tasks

1. Integrate KaTeX for inline `$...$` and display `$$...$$` math via a
   markdown-it plugin, per ADR-0002's KaTeX section: bundle KaTeX fonts
   locally, wrap invalid-LaTeX errors in the project's standard inline-error
   component (not KaTeX's raw default markup).
2. Integrate Mermaid per ADR-0002: `securityLevel: 'strict'`, direct-DOM
   rendering, mandatory DOMPurify pass on the generated SVG before
   insertion. Recognize both ```` ```mermaid ```` fences and
   `:::mermaid ... :::` containers (F79) as equivalent input.
3. Support the required Mermaid diagram types (flowchart, sequence, class,
   state, ER, Gantt, pie, journey, mindmap-where-supported).
4. Build diagram chrome: fullscreen mode, zoom, pan, reset zoom, download
   as SVG/PNG.
5. Implement invalid-Mermaid handling: clear inline error, rest of document
   unaffected.
6. Implement theme sync: re-render (not just re-color) Mermaid diagrams on
   light/dark/system theme change, debounced against rapid toggles; ensure
   this also works correctly once Presentation Mode exists (Phase 6 — note
   the dependency but don't implement presentation-specific wiring yet).
7. Ensure both KaTeX and Mermaid output are deferred/incremental (not
   blocking first paint of surrounding text) per the performance
   requirements in `docs/specs/06-testing-quality-gate.md` §1.

### 5. Architecture changes

New `src/viewer/math/` (KaTeX adapter), `src/viewer/mermaid/` (Mermaid
adapter + strict-mode config + post-render sanitization step), diagram
chrome components under `src/components/` (shared by Mermaid now, reused by
Graphviz in 3-B and mind map in Phase 6 — build the fullscreen/zoom/pan
chrome as a shared component from the start, not duplicated per-renderer).

### 6. Data/storage changes

Adds Mermaid/KaTeX-related settings (e.g. "diagrams enabled" toggles) to the
`Settings` schema per ADR-0004's pattern.

### 7. Security requirements

- Mermaid's `strict` mode configuration is verified, not assumed — a test
  must confirm click-bindings/HTML-injection paths are actually disabled.
- The DOMPurify pass on Mermaid's output SVG is mandatory and tested
  explicitly (a malicious-diagram-source security test, not just a
  functional one).
- KaTeX invalid-input handling must not leak raw unescaped LaTeX source
  into the DOM in a way that could be misinterpreted as HTML.

### 8. Tests

- Unit: KaTeX inline/display render correctly; invalid LaTeX produces the
  wrapped error component, not a crash.
- Integration: each supported Mermaid diagram type renders; fullscreen/
  zoom/pan/download all function; theme toggle re-renders diagrams
  correctly.
- Security: crafted Mermaid source attempting to break out of the renderer
  (per `docs/specs/04-security-privacy.md` §4's Mermaid security test)
  renders inert; confirm via the Spike-1/Spike-2 findings from Phase 0 that
  the shipped config matches what was validated.
- Performance: budget **P5** from `docs/specs/06-testing-quality-gate.md`
  §1a — a document with 10 Mermaid diagrams + 50 math expressions must not
  regress text first-paint by more than **20 %** against the same document
  with them removed; **P3** (no main-thread task > 50 ms during scroll)
  still holds while diagrams render. Measured against both fixtures and
  recorded, not asserted.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 steps 6 (Mermaid
  portion) and 7 (math).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- All required Mermaid diagram types render correctly with full chrome
  (fullscreen/zoom/pan/download).
- Invalid Mermaid shows a clear inline error without breaking the document.
- KaTeX inline and display math render correctly; invalid LaTeX shows a
  clear inline error.
- Theme changes correctly re-render diagrams.
- Mermaid security test set passes.
- Diagram/math rendering is deferred and doesn't block first paint —
  demonstrated by meeting budget **P5** (< 20 % text-paint regression) with
  **P3** holding, not by inspection.

### 11. Known limitations

- Graphviz and PlantUML are not yet supported (fenced ```` ```dot ```` /
  ```` ```plantuml ```` blocks still show as plain code until Phase 3-B).
- Diagram export beyond SVG/PNG (e.g. mind-map-specific export chrome) is
  built in Phase 6, reusing this phase's shared chrome components.

### 12. Documentation updates

None beyond inline code comments where a non-obvious constraint (e.g. the
strict-mode + DOMPurify rationale) needs a pointer back to
`docs/adr/0002-diagram-rendering-strategy.md`.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 3-A (Math & Core Diagrams: KaTeX, Mermaid) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phases 2-A/2-B actually built, especially the rendering pipeline in
> `src/viewer/markdown/` and any shared component patterns in
> `src/components/`. Read: this plan's Phase 3-A section,
> `docs/adr/0002-diagram-rendering-strategy.md` (Mermaid and KaTeX sections
> only), and feature-matrix rows F11, F12, F79. Also check Phase 0's
> `DEVELOPMENT.md` for the recorded Mermaid-under-CSP spike findings before
> choosing a Mermaid version/config. Implement only KaTeX and Mermaid — not
> Graphviz or PlantUML (Phase 3-B). Run the verification commands and tests
> in Phase 3-A §9, fix issues, report what was implemented and tested, and
> stop. Do not start Phase 3-B.

---

## Phase 3-B — Extended Diagrams (Graphviz, PlantUML)

### 1. Goal

Add Graphviz/DOT rendering via a bundled WASM renderer, and PlantUML support
via the opt-in, disclosed, off-by-default remote-rendering path — the two
diagram engines with a materially different integration shape from Phase
3-A's fully-local renderers.

### 2. Dependencies

Phase 3-A complete (shared diagram chrome components — fullscreen/zoom/pan —
already exist and are reused here).

### 3. Features

F13, F14.

### 4. Technical tasks

1. Add a WASM Graphviz library (e.g. `@hpcc-js/wasm`) as a bundled
   dependency; confirm the `.wasm` asset is included in the build output
   and declared in `web_accessible_resources` — **not** fetched from a CDN
   at runtime, per ADR-0002.
2. Add `wasm-unsafe-eval` to the manifest's `content_security_policy`
   (validated already in Phase 0's Spike 1 — apply the exact config found
   to work).
3. Recognize `dot`/`graphviz` fenced blocks, render client-side, produce
   SVG, pass through the shared DOMPurify-before-insertion step.
4. Wire Graphviz output into the shared diagram chrome from Phase 3-A
   (fullscreen/zoom/pan/download) rather than building parallel chrome.
5. Implement invalid-DOT handling: clear inline error, no document breakage.
6. Implement the PlantUML settings surface: an **off-by-default**, clearly
   labeled toggle (not merged into any general "enable diagrams" setting),
   with explicit disclosure text naming the configured server before the
   toggle can be turned on, and a configurable server URL field.
7. Implement the PlantUML render call: only fires when the toggle is on;
   sends only the diagram source text (nothing else) to the configured
   server; renders the returned image/SVG through the same sanitize-before-
   insert step as every other renderer.
8. Implement the disabled/unavailable state: when PlantUML rendering is off
   (the default) or a network call fails, show a clear inline message and
   continue rendering the rest of the document normally.
9. Add the PlantUML opt-in disclosure to the Settings → Privacy section
   (F41/§32) alongside the general local-only-processing explanation.

### 5. Architecture changes

New `src/viewer/diagrams/graphviz/` (WASM adapter), `src/viewer/diagrams/
plantuml/` (opt-in remote-render adapter, network call isolated to this
module only — no other module makes network requests). Extends
`src/settings/` with the Diagrams section (Mermaid/Graphviz always-on
toggles if desired, PlantUML's dedicated opt-in surface) and the Privacy
section.

### 6. Data/storage changes

Adds `plantumlEnabled: boolean` (default `false`) and
`plantumlServerUrl: string` to the `Settings` schema — the one settings
field pair in the entire product whose default materially changes network
behavior, called out explicitly in code comments and in `PRIVACY.md`.

### 7. Security requirements

- The WASM module is verified to be a local, bundled asset in the built
  `dist/` — no runtime fetch to any external host for the Graphviz
  renderer, checked via a Playwright network-request assertion (zero
  requests to any host during Graphviz rendering).
- PlantUML network calls are verified to fire **only** when the toggle is
  explicitly on, and to send **only** the diagram source text — a
  Playwright network-request assertion here too (confirm payload content
  and confirm zero calls when the toggle is off, including on documents
  that contain `plantuml` fenced blocks).
- Graphviz SVG output passes through the same DOMPurify step as every other
  renderer (defense-in-depth, not solely trusting the WASM renderer's
  output to be inherently safe).

### 8. Tests

- Unit: DOT parsing/rendering against valid + malformed input.
- Integration: Graphviz fullscreen/zoom/pan/download via the shared chrome;
  PlantUML toggle on/off behavior; PlantUML server-unavailable fallback
  message.
- Security: confirm zero network calls for Graphviz; confirm PlantUML makes
  no network call while disabled; confirm only diagram-source text (not
  full document content) is sent when enabled.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 step 6 (Graphviz and
  PlantUML on/off portions).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- Graphviz/DOT diagrams render correctly, fully offline, with full chrome.
- Invalid DOT shows a clear inline error.
- PlantUML is off by default; enabling it requires the explicit disclosed
  opt-in; when enabled, valid PlantUML source renders; when disabled or the
  server is unreachable, a clear fallback message appears and the rest of
  the document renders normally.
- Network-call assertions (Graphviz: zero; PlantUML: only when opted in,
  only diagram source) pass.

### 11. Known limitations

- **PlantUML has no client-side rendering path in v1** — this is a
  documented feasibility finding (ADR-0002), not a bug. Users who want
  PlantUML rendering without any network call have no option in v1.
- Graphviz WASM bundle size adds to the extension's overall package size —
  acceptable per the spec's locked stack decision, but worth noting in the
  final size/performance report (Phase 9).

### 12. Documentation updates

- `PRIVACY.md`: document the PlantUML opt-in exception explicitly (this is
  the first and, per ADR-0002, only planned network-capable feature in the
  product besides an optional future link-preview feature).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 3-B (Extended Diagrams: Graphviz, PlantUML) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phase 3-A actually built — especially the shared diagram-chrome
> components (fullscreen/zoom/pan) in `src/components/`, which this phase
> must reuse, not duplicate. Read: this plan's Phase 3-B section,
> `docs/adr/0002-diagram-rendering-strategy.md` in full (Graphviz and
> PlantUML sections), Phase 0's `DEVELOPMENT.md` for the WASM+CSP spike
> result, and feature-matrix rows F13, F14. Implement only Graphviz and
> PlantUML. PlantUML must ship off by default with the exact disclosed
> opt-in flow described — do not skip the disclosure step. Run the
> verification commands and the network-call security assertions in Phase
> 3-B §7–8, fix issues, update `PRIVACY.md`, report what was implemented
> and tested, and stop. Do not start Phase 4.

---

## Phase 4 — File & Project Management

### 1. Goal

Full folder browsing (File System Access API), folder full-text search,
folder bookmarks, recent documents, and auto-refresh — the complete local
file/project workflow beyond single-file opening.

### 2. Dependencies

Phase 1 (file-open flows, storage wrapper, `file:///*` host permission),
Phase 2-B (toolbar file-browser button and sidebar container exist as stubs
to wire up).

### 3. Features

F19 (extends F07's folder-open action from Phase 1), F20, F21, F22, F23,
F55, F59, F63, F64, F65, F74, F75, F80.

### 4. Technical tasks

1. Implement "Open folder" (completing F07) via `showDirectoryPicker()`
   from the viewer page, per ADR-0001 Flow B.
2. Build the folder-browser sidebar (F19) in the viewer (not the popup, per
   spec): directory tree, file list, open-on-click, active-file
   highlighting (F64).
3. Implement progressive, cancellable folder scanning (F65): render the
   tree incrementally as entries are discovered, with a visible Cancel
   action for large trees — never block the UI thread.
4. Implement folder exclusion list (F63): user-configurable skip-list
   (default: `node_modules`, `.git`, `dist`), applied during scanning.
5. Implement file-type filter (F64): narrow the visible list (Markdown-only
   vs. all supported text types).
6. Implement folder full-text search (F20): filename + content search,
   case-insensitive, result highlighting, file-path display, quick-open —
   reuses the same progressive/cancellable scan and exclusion list as the
   file browser; runs off the main thread (Web Worker) for large trees.
7. Implement folder bookmarks (F21): add/remove/rename/reopen, stored
   locally via the storage wrapper.
8. Implement recent documents (F22, F59, F75): local history keyed by
   filename/source/timestamp; grouped by source type (Local Files
   collapsible group; remote entries grouped by domain); duplicate
   detection (reopening updates the existing entry, not a new row); **only**
   address-bar-entered remote navigations are captured (per ADR-0001 §4 —
   never passive `webNavigation` monitoring).
9. Wire the popup's "Recent Documents" tab (stubbed in Phase 1) to this
   real data: search box, grouped list, refresh, clear-all.
10. Implement persisted FSAA folder permission (F80) per ADR-0001 Flow B:
    IndexedDB-stored handle, `queryPermission()` check on load, one-click
    "Reconnect folder" fallback affordance when silent re-grant isn't
    available.
11. Implement auto-refresh (F23, F74) for **both** access flows per
    ADR-0001: Flow A polls the `file://` content itself (hash/length diff,
    since reliable `Last-Modified` isn't available); Flow B polls
    `handle.getFile().lastModified`. Both run from the **viewer page**, not
    the background service worker (MV3 service-worker lifetime makes a
    background timer unreliable — see ADR-0001's findings). Default ~2s
    interval, user-configurable on/off and interval; on change, reload
    content while preserving scroll position and theme/settings; applies to
    `.txt` files too.
12. Implement focus-aware polling (F74): pause the auto-refresh loop when
    the document's tab/window isn't focused/visible (`document.hidden` /
    `visibilitychange`), resume immediately on refocus.
13. Implement "Clear Cache" maintenance action (F55) in both the popup and
    the full Settings page, per ADR-0004's sharded-storage design and the
    **exact scope table now in
    `docs/specs/01-functional-requirements.md` §32**: clears
    `markora.recents`, `markora.bookmarks`, folder-scan/search caches and
    stale handoff records; **never** touches `markora.settings`, the stored
    File System Access handles, or (once they exist) `markora.annotations.*`.
    Show current storage usage alongside the action.
    **Phase 5 dependency:** when annotations land, Phase 5 adds the separate
    "Delete all annotations" action with a confirmation dialog — it does
    **not** get folded into Clear Cache. Leave the maintenance section
    structured so that action can be added without rework.
14. Implement storage-quota monitoring per ADR-0004: check
    `chrome.storage.local.getBytesInUse()` periodically; when usage crosses
    the warning threshold, prompt the user and, only on explicit consent,
    request the `unlimitedStorage` optional permission via
    `chrome.permissions.request()`.

### 5. Architecture changes

New `src/components/browser/` (folder-browser sidebar), search worker under
`src/utils/` or a dedicated `src/workers/` module, extends
`src/storage/` with recents/bookmarks/folder-scan-cache slices and the
quota-monitoring logic, extends `src/background/` only for the narrow
`chrome.permissions.request()` flow (still no business logic there —
permission requests are a legitimate background-worker responsibility per
`03-architecture.md` §8).

### 6. Data/storage changes

Per ADR-0004: adds `markora.recents`, `markora.bookmarks` top-level keys,
and the IndexedDB-based FSAA-handle store (separate from
`chrome.storage.local`, per ADR-0001). Adds `unlimitedStorage` to
`optional_permissions` in the manifest (not statically declared) — this is
also where `docs/specs/07-permissions-compliance.md` §2's permission table
should be noted (in this phase's PR/commit, not by editing the spec file)
as needing the ADR-0004 amendment reflected in a future spec revision.

### 7. Security requirements

- Folder scanning never uploads any content — verified via a Playwright
  network-request assertion (zero requests during folder scan/search for
  any local operation).
- The `unlimitedStorage` permission request only fires after the documented
  usage threshold is crossed and only after explicit user consent through
  the `chrome.permissions.request()` prompt — never requested speculatively
  at install time.
- FSAA handles stored in IndexedDB are never exposed to content scripts or
  any page outside the extension's own pages.

### 8. Tests

- Unit: exclusion-list filtering, duplicate-detection logic for recents,
  quota-threshold calculation.
- Integration: full folder-open → browse → search → open-file flow;
  progressive scan renders incrementally and Cancel actually stops it;
  bookmarks add/remove/rename/reopen; auto-refresh reflects an external file
  edit within one polling interval for both access flows; focus-aware pause/
  resume; FSAA permission "Reconnect folder" flow after simulating a lost
  grant.
- Performance: budgets **P7** and **P8** from
  `docs/specs/06-testing-quality-gate.md` §1a against a **1,000-file**
  synthetic tree — no main-thread block > 200 ms, first entries visible
  < 500 ms, Cancel effective < 100 ms, and folder search running off the
  main thread with P3 holding throughout. First performance-specific test in
  the plan, establishing the fixture Phase 9 re-runs.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 steps 9 (folder
  browsing/search) and re-run step 3 with auto-refresh active against a
  real external editor.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- Folder open/browse/search/bookmarks/recents all function correctly with
  real local folders of realistic size.
- Progressive scanning with cancellation works and never blocks the UI, at
  the P7/P8 budgets on a 1,000-file tree.
- Auto-refresh works for both file-access flows, is focus-aware, and
  preserves scroll/theme across reload.
- Folder permission persists across a normal reload; the reconnect
  affordance appears correctly when it doesn't.
- Clear Cache works and is correctly scoped (doesn't wipe settings).
- Zero unexpected network calls during any file/folder operation.

### 11. Known limitations

- Flow A's auto-refresh (content diff, not timestamp) is a weaker
  change-detection signal than Flow B's `lastModified` — document this
  asymmetry plainly rather than implying parity between the two flows.
- FSAA permission durability across browser restarts is not 100%
  guaranteed by Chrome — the "Reconnect folder" affordance is the
  documented mitigation, not a claim of zero-friction persistence.

### 12. Documentation updates

- Note the `07-permissions-compliance.md` amendment (ADR-0004's
  `unlimitedStorage` addition) as a follow-up for the next spec-review pass
  — do not silently edit that spec file in this phase.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 4 (File & Project Management) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phases 1–2-B actually built: the file-open flows in `src/content/`
> and the viewer-page picker logic (Phase 1), the toolbar's file-browser
> stub button and sidebar container pattern (Phase 2-B), and the storage
> wrapper's
> current schema (Phase 1). Read: this plan's Phase 4 section,
> `docs/adr/0001-file-access-and-detection.md` in full, and
> `docs/adr/0004-storage-schema-and-quota.md` in full. Also read
> feature-matrix rows F19–F23, F55, F59, F63–F65, F74–F75, F80. Implement
> only file/folder/recents/bookmarks/auto-refresh functionality — no
> annotations, presentation, or export. Run the verification commands and
> tests in Phase 4 §9, fix issues, report what was implemented and tested,
> and stop. Do not start Phase 5.

---

## Phase 5 — Reading Productivity & Annotations

### 1. Goal

Reading progress, document statistics, and the annotation system
(highlight/underline/comment with the ADR-0003 re-anchoring model), plus the
redesigned right-sidebar tabbed layout combining outline (TOC) and
annotations.

### 2. Dependencies

Phase 2-A (rendered-document text access), Phase 2-B (TOC/sidebar patterns).

### 3. Features

F16, F17, F27, F51, F62, F71.

### 4. Technical tasks

1. Implement the reading-progress bar (F16): smooth scroll-position/
   percentage indicator, enable/disable setting.
2. Implement the optional completion celebration effect (F62): purely
   cosmetic, independently toggleable, **off by default**, and fully
   suppressed when `prefers-reduced-motion` is set.
3. Implement document statistics (F17): word count, character count,
   estimated reading time, computed locally, shown in a non-intrusive
   info panel that may auto-hide near the bottom of short documents.
4. Implement CJK-aware counting (F71): character-based counting for
   Chinese/Japanese/Korean script runs instead of naive whitespace
   splitting.
5. Implement the annotation data model and engine per ADR-0003: selection
   capture (exact text + prefix/suffix context + char offset + content
   fingerprint), the re-anchoring algorithm (fast-path fingerprint match →
   exact-text search with prefix/suffix disambiguation → orphaning), sharded
   per-document storage per ADR-0004.
6. Build annotation UI: highlight/underline/comment creation from a text
   selection, view/edit/delete existing annotations, visible "Orphaned"
   section for annotations that failed re-anchoring.
7. Build the redesigned right sidebar (F51): tabbed layout combining the
   Outline (TOC, reusing Phase 2-B's component) and Annotations panels in one
   sidebar surface.
8. Confirm annotations never mutate the source Markdown file — no
   "apply to document" write-path exists in v1 (explicitly not built, not
   partially stubbed).
9. Add the **"Delete all annotations"** maintenance action to the Settings →
   Maintenance section built in Phase 4, behind an explicit confirmation
   dialog stating how many annotations will be lost. Clear Cache (F55) must
   remain unchanged and must still not touch `markora.annotations.*`
   (`docs/specs/01-functional-requirements.md` §32, ADR-0004 clarification).
10. Emit the annotation data that exports will consume: a stable,
    document-scoped list of resolved ranges (anchor offsets + type +
    comment text, excluding orphaned entries) exposed to the export modules
    built in Phases 7-A/7-B — plus the **"Include annotations in exports"**
    setting (default on) from `docs/specs/01-functional-requirements.md`
    §21. Phase 5 owns the data and the setting; Phases 7-A/7-B own the
    rendering into each format.

### 5. Architecture changes

New `src/components/annotations/`, `src/viewer/annotations/` (anchoring
engine, per ADR-0003, as testable pure logic separate from the UI
components), extends `src/components/sidebar/` for the tabbed
outline+annotations layout (replacing Phase 2-B's TOC-only sidebar shell).

### 6. Data/storage changes

Adds the sharded `markora.annotations.<documentId-hash>` keys per
ADR-0004/ADR-0003; adds reading-progress/stats-related settings
(celebration-effect toggle, stats visibility) and the
`includeAnnotationsInExports` flag (default `true`, consumed by Phases
7-A/7-B) to the `Settings` schema.

### 7. Security requirements

- Annotation comment text goes through the same sanitization pipeline as
  any other user-facing rendered content before display (comments could
  themselves contain pasted HTML-like text).
- Confirm no code path writes annotation data back into the original file
  content or into any location outside `chrome.storage.local`.

### 8. Tests

- Unit: ADR-0003's re-anchoring algorithm — exact fingerprint match
  (fast path), single unambiguous exact-text match after edits, multiple-
  match disambiguation via prefix/suffix similarity, zero-match orphaning,
  ambiguous-match orphaning; CJK word-counting against real CJK sample
  text.
- Integration: create/edit/delete annotations, reload the document with
  minor edits applied externally and confirm correct re-anchoring or
  correct orphaning (not silent loss or mis-placement); reading-progress
  bar and stats panel update correctly while scrolling.
- Performance: budget **P9** from
  `docs/specs/06-testing-quality-gate.md` §1a — **50 annotations against a
  5 MB document, re-anchored on load in < 500 ms total with no single task
  > 50 ms** (chunk the work if needed). This is the concrete bar ADR-0003's
  "Phase 5's performance test should confirm this holds" refers to.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 step 12 (annotations
  create/edit/delete/persist across reload).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- Reading progress and stats (with CJK-aware counting) work correctly.
- Annotations can be created, edited, deleted, and persist correctly across
  reload.
- Re-anchoring behaves exactly per ADR-0003's algorithm, including visible
  orphaning when it can't confidently re-anchor, and meets budget **P9**.
- The tabbed outline+annotations right sidebar works.
- No annotation data ever reaches the source file or leaves
  `chrome.storage.local`.
- "Delete all annotations" exists behind a confirmation dialog, and Clear
  Cache (F55) still leaves annotations untouched.
- The resolved-annotation data structure and the
  `includeAnnotationsInExports` setting are in place for Phases 7-A/7-B.

### 11. Known limitations

- Re-anchoring uses text-quote + context heuristics, not a formal diff/
  patch algorithm — pathological edits (e.g. the exact same short phrase
  repeated many times with near-identical surrounding context) can still
  produce an orphaned annotation even though a human could resolve the
  ambiguity; documented as an accepted trade-off in ADR-0003.

### 12. Documentation updates

None beyond code-level references back to ADR-0003 for the anchoring logic.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 5 (Reading Productivity & Annotations) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phase 2-B built for the TOC/sidebar (you will be replacing the
> sidebar shell with a tabbed version, not building from scratch) and what
> Phase 1 built in `src/storage/`. Read: this plan's Phase 5 section, and
> `docs/adr/0003-annotation-identity-and-reanchoring.md` in full (this is
> the most important reference for this phase — implement its algorithm
> exactly, don't invent a different one), plus feature-matrix rows F16,
> F17, F27, F51, F62, F71. Implement only reading-progress/stats/
> annotations — no presentation mode or export. Run the verification
> commands and the re-anchoring unit tests in Phase 5 §8–9, fix issues,
> report what was implemented and tested, and stop. Do not start Phase 6.

---

## Phase 6 — Presentation & Mind Map

### 1. Goal

Turn a document into a slide presentation and into an interactive mind map
generated from its heading structure — the two "advanced view mode"
features.

### 2. Dependencies

Phase 2-B (theme system, toolbar, settings surfaces), Phase 3-A
(Mermaid/KaTeX must render correctly inside slides too).

### 3. Features

F28, F29, F56, F76.

### 4. Technical tasks

1. Implement the three slide-splitting strategies (F76): `---`-delimited
   sections, one-slide-per-H1, one-slide-per-H2; auto-detect (prefer `---`
   if present, else headings — requiring at least 3 H1-or-H2 headings to be
   viable, else show a clear "not enough structure to present" message).
2. Build presentation navigation: next/prev, arrow keys, PageUp/PageDown,
   Space, Escape, Home/End, number keys 1–9, fullscreen (`F`/`F11`),
   progress indicator, slide counter, touch swipe + tap-edge-vs-center
   navigation, keyboard-help overlay (`?`), auto-play (default key `P`,
   ~5s interval, pauses at final slide, both configurable).
3. Implement speaker notes from HTML-comment source markup where present.
4. Ensure Mermaid diagrams (theme-synced) and KaTeX math render correctly
   inside slides, reusing Phase 3-A's renderers unchanged.
5. Disable the image lightbox while presenting (F28 note — clicking a slide
   image must not interrupt the presentation).
6. Implement the overflow scroll indicator (subtle bounce animation) for
   slides whose content exceeds the viewport.
7. Implement presentation style customization (F56): background/text/
   heading/accent color, slide font, background-image URL + opacity — each
   field defaulting to "inherit from active theme" (empty = no override),
   plus a single "Reset presentation settings" action.
8. Build the mind-map view (F29): generate hierarchy from heading structure
   only, zoom/pan/collapse/expand/fullscreen, reusing Phase 3-A/3-B's shared
   diagram-chrome components where their interaction model fits (zoom/pan/
   fullscreen), with SVG/PNG/JPEG export.

### 5. Architecture changes

New `src/components/presentation/`, `src/components/mindmap/`. Presentation
style settings extend `src/settings/` (dedicated Presentation section, per
the screenshot-confirmed options-page layout in
`docs/specs/08-glossary-references.md` §4).

### 6. Data/storage changes

Adds presentation-style settings and mind-map preferences (if any, e.g. last
zoom level — optional) to the `Settings` schema.

### 7. Security requirements

- Speaker notes (sourced from HTML comments in the Markdown) pass through
  the same sanitization as any other rendered content before display —
  HTML comments are not inherently safe just because they're normally
  invisible in standard rendering.
- Mind-map generation reads only the document's own heading structure — no
  external input, no network call.

### 8. Tests

- Unit: slide-splitting strategy selection logic (auto-detect priority and
  the ≥3-heading viability threshold) against fixture documents; mind-map
  hierarchy generation from a heading tree including edge cases (skipped
  heading levels, duplicate heading text).
- Integration: full presentation keyboard/touch navigation set; auto-play
  start/stop/pause-at-end; presentation style customization + reset; mind-
  map zoom/pan/collapse/expand/export (SVG/PNG/JPEG).
- Manual: `docs/specs/06-testing-quality-gate.md` §4 steps 10 (presentation)
  and 11 (mind map).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- All three slide-splitting strategies work, including the auto-detect
  heuristic and the "not enough structure" fallback message.
- Full presentation keyboard/touch/auto-play navigation works; always
  returns cleanly to normal document view.
- Presentation style customization + reset works.
- Mind map generates correctly from headings, with working zoom/pan/
  collapse/expand/fullscreen and SVG/PNG/JPEG export.
- Mermaid/KaTeX render correctly inside slides with correct theme sync.

### 11. Known limitations

- Mind-map layout algorithm choice (a hand-rolled SVG tree layout vs. a
  small D3-based layout library) is an implementation-time decision within
  this phase, not pre-selected by this plan — document whichever is chosen
  and why in the phase's own commit/PR description.

### 12. Documentation updates

None required beyond standard code comments.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 6 (Presentation & Mind Map) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phase 2-B built for theming/toolbar and what Phase 3-A built for
> Mermaid/KaTeX rendering and the shared diagram-chrome components (reuse
> the zoom/pan/fullscreen chrome for the mind map rather than rebuilding
> it). Read: this plan's Phase 6 section and feature-matrix rows F28, F29,
> F56, F76 (cross-reference
> `docs/specs/01-functional-requirements.md` §22–23 for the full behavioral
> detail on slide-splitting strategies and the extended keyboard set).
> Choose and document a mind-map layout approach as part of this phase's
> own work. Run the verification commands and tests in Phase 6 §9, fix
> issues, report what was implemented and tested, and stop. Do not start
> Phase 7.

---

## Phase 7-A — Export: HTML & Print/PDF

### 1. Goal

Standalone HTML export and print/PDF export — the two export formats that
reuse the already-rendered viewer DOM, per ADR-0005.

### 2. Dependencies

Phase 2-B (rendering pipeline + export menu surface), Phase 3-A/3-B
(diagrams/math must be present in the DOM to export correctly), **Phase 5**
(annotation ranges and the "Include annotations in exports" setting must
exist — `docs/specs/01-functional-requirements.md` §21/§24).

### 3. Features

F30, F32, F33 (diagram/mind-map SVG/PNG/JPEG export was built in Phases
3-A/3-B/6; this phase's F33 scope is verifying that export continues to
work correctly once embedded in a full HTML export, not re-implementing it).

### 4. Technical tasks

1. Implement HTML export per ADR-0005: serialize the current rendered,
   sanitized DOM → tree-shaken CSS inlining (only rules matching present
   elements) → base64 image embedding (cap ~5 MB/image, link-out fallback
   beyond cap) → `<a download>` file save.
2. Respect the current code line-wrap and light/dark setting at export time
   (snapshot, not live-updating).
3. Add an optional embedded-TOC setting for HTML export.
4. Implement print/PDF export per ADR-0005: dedicated `print.css` (hide app
   chrome, A4 page size, ~2.5cm/2cm margins, page-break rules for code
   blocks/tables/diagrams), force-load any lazy-loaded images before
   `window.print()` is invoked.
5. Confirm diagrams render as vector SVG (not rasterized) in both HTML
   export and print output.
6. **Render annotations into both formats** (F27 × F30/F32, ADR-0005's
   annotation-export section): highlight/underline styling reproduced
   inline; comments rendered as a numbered marker at the anchor plus a
   comment list (footer section for HTML, numbered endnotes for print),
   with a print-safe highlight palette in `print.css`. Governed by the
   "Include annotations in exports" setting (default on); orphaned
   annotations are never exported; the exported HTML needs **no JavaScript**
   to display them.

### 5. Architecture changes

New `src/export/html/` (serializer, CSS tree-shaker, image embedder),
`src/export/print/` (print stylesheet, lazy-image force-loader,
print-trigger wiring from the toolbar's export menu).

### 6. Data/storage changes

Adds export-related settings (HTML embedded-TOC toggle, any export
defaults) to the `Settings` schema.

### 7. Security requirements

- Exported HTML must not include any executable script beyond what's
  strictly needed for static rendering (ideally none) — verify the
  exported file itself passes the same XSS test set as the live viewer,
  since it's now a standalone artifact a user might share.
- Confirm the CSS tree-shaking step doesn't accidentally include or leak
  any application-internal state/comments into the exported file.

### 8. Tests

- Unit: CSS tree-shaking selects only used rules against fixture documents;
  base64 image-embedding cap/fallback logic.
- Integration: full HTML export round-trip (export → open the resulting
  file standalone in a browser → confirm typography/tables/code/diagrams/
  math/alerts/containers all render correctly with no external
  dependencies); print export produces correct page breaks and no cut-off
  tables/code against representative fixture documents.
- Security: run the standard XSS test set against a rendered *and
  re-opened* exported HTML file, not just the live viewer.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 step 8 (HTML/print
  portions) and §3 "Export" row (HTML, print/PDF).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- HTML export produces a fully self-contained, offline-viewable file
  preserving typography, tables, code+highlighting, images, Mermaid,
  KaTeX, alerts, containers, basic styling.
- Annotations appear correctly in both HTML and print output when the
  setting is on, and are absent when it is off; orphaned annotations never
  appear in either.
- Print/PDF output hides app chrome, uses correct page setup, doesn't cut
  tables incorrectly, preserves code/diagrams/math, and doesn't blank out
  lazy-loaded images.
- Exported HTML passes the same XSS test set as the live viewer.
- Budget **P12** (HTML export of a 1 MB document with 20 images completes
  < 5 s with staged progress) is measured and met.

### 11. Known limitations

- Very large embedded images (over the 5 MB cap) link out to their
  original source rather than embedding — the exported file is not
  guaranteed fully offline in that specific case, by design (documented
  trade-off, not a bug).

### 12. Documentation updates

None beyond eventual `README.md` export-usage instructions (Phase 10).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 7-A (Export: HTML & Print/PDF) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> the current rendered-DOM structure produced by Phases 2/3-A/3-B (you are
> serializing this DOM, not re-parsing the document). Read: this plan's
> Phase 7-A section, `docs/adr/0005-export-architecture.md` (HTML and
> Print/PDF sections only — skip the DOCX section, that's Phase 7-B), and
> feature-matrix rows F30, F32, F33. Implement only HTML and print/PDF
> export — not DOCX. Run the verification commands and the standalone-file
> XSS re-test in Phase 7-A §8–9, fix issues, report what was implemented
> and tested, and stop. Do not start Phase 7-B.

---

## Phase 7-B — Export: DOCX

### 1. Goal

DOCX export via a custom AST-to-OOXML mapping module, with the tiered math
fallback strategy — the largest single piece of custom logic in the export
system, per ADR-0005's finding that no off-the-shelf converter meets the
spec's fidelity bar.

### 2. Dependencies

Phase 3-A (KaTeX rendering, for the raster-image math fallback tier), Phase
5 (annotation ranges + the include-in-exports setting), Phase 7-A
(establishes the export-menu UI/progress-notification pattern this phase
reuses).

### 3. Features

F31.

### 4. Technical tasks

1. Add the `docx` npm package (OOXML document builder) as a dependency.
2. Build the AST-to-OOXML mapper (`src/export/docx/`): walks the same
   markdown-it token stream used for rendering (not the DOM), emitting
   `docx` API calls for headings (H1–H6), bold/italic/strikethrough, inline
   code, code blocks (with syntax-highlighting-derived run formatting),
   ordered/unordered/task lists, blockquotes, tables (with alignment),
   links, footnotes, horizontal rules, images.
3. Implement the three-tier math strategy per ADR-0005: (1) direct LaTeX→
   OMML conversion for a defined, testable set of simple constructs; (2)
   ~2x-scale rasterized KaTeX-output image fallback for anything tier 1
   can't map; (3) italic LaTeX source text as the last resort.
4. Implement image embedding for DOCX supporting local file, `http(s)`,
   `data:`, and `blob:` sources — fetched/decoded and embedded into the
   package at export time.
5. Implement staged progress reporting (parsing → conversion → image
   processing → file generation → download) via the unified notification
   component from Phase 1, not an indefinite spinner.
6. **Render annotations into the DOCX, best-effort** (F27 × F31, ADR-0005's
   annotation-export section): resolve Phase 5's annotation ranges onto the
   token stream via the ADR-0003 anchoring data, then emit highlights as
   text shading/highlight runs, underlines as underline runs, and comments
   as **native Word comments** where the builder supports them — falling
   back to numbered endnotes rather than dropping a comment. Governed by
   the same "Include annotations in exports" setting; orphaned annotations
   are never exported. State in this phase's commit which of the two
   comment mechanisms actually shipped.

### 5. Architecture changes

New `src/export/docx/` (mapper, OMML math-tier logic, image embedder,
progress-stage emitter).

### 6. Data/storage changes

None beyond any DOCX-specific export defaults added to the `Settings`
schema, if needed.

### 7. Security requirements

- Image fetches during DOCX export (for `http(s)` sources) are scoped only
  to the specific image URLs present in the document — not a general
  network capability; verify via a Playwright network-request assertion
  that only expected image URLs are requested.
- Confirm the AST-to-OOXML mapper never evaluates or executes any document
  content — it only reads token data and writes to the `docx` builder API.

### 8. Tests

- Unit: mapper output for each Markdown construct against fixture
  documents (headings, formatting, lists including task lists, tables with
  alignment, code blocks, links, footnotes, images); tier-1 OMML mapping
  against the explicitly defined "simple construct" set from this phase's
  exit criteria; tier-2/tier-3 fallback triggering for constructs outside
  that set.
- Integration: full DOCX export round-trip (export → open the resulting
  file in a real DOCX-capable application or a DOCX-parsing test library →
  confirm structural fidelity) against a representative fixture document
  covering every construct in the spec's DOCX preservation table
  (`docs/specs/01-functional-requirements.md` §24).
- Security: network-request assertion confirming only in-document image
  URLs are fetched.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 step 8 (DOCX portion),
  opening the exported file in a real word processor.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```

### 10. Exit criteria

- DOCX export preserves headings, all inline formatting, code blocks
  (with formatting), tables with alignment, all list types including task
  lists, blockquotes, links, footnotes, horizontal rules, and images.
- The three-tier math fallback behaves correctly and predictably: this
  phase's own commit must state the exact "simple construct" set that hits
  tier 1, so the boundary is testable, not vague.
- Progress reporting shows real stages, not an indefinite spinner.
- Annotations appear in the exported DOCX (shading/underline runs, plus
  native Word comments or endnotes) when the setting is on, and not at all
  when it is off; no comment is ever silently dropped.
- Exported file opens correctly in a real word processor with no
  corruption.

### 11. Known limitations

- Tier-1 direct OMML conversion covers only a defined subset of LaTeX —
  anything more complex falls to the image or text tiers, which is an
  accepted, documented trade-off (Word has no native arbitrary-LaTeX
  support), not a defect.

### 12. Documentation updates

None beyond eventual `README.md` export-usage instructions (Phase 10).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 7-B (Export: DOCX) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> what Phase 7-A built for the export-menu UI and progress-notification
> pattern (reuse it) and confirm the markdown-it token stream shape
> produced by Phase 2-A's pipeline (you are consuming that token stream, not
> the DOM). Read: this plan's Phase 7-B section,
> `docs/adr/0005-export-architecture.md` (DOCX section in full — this is
> the most technically involved single ADR section in the project), and
> feature-matrix row F31 plus
> `docs/specs/01-functional-requirements.md` §24's DOCX preservation table
> and math-handling tier description. This is a large, self-contained
> module — do not attempt to also touch HTML/print export (Phase 7-A,
> already done). Define and document the exact tier-1 OMML "simple
> construct" set as part of this phase's own work. Run the verification
> commands and tests in Phase 7-B §8–9, fix issues, report what was
> implemented and tested, and stop. Do not start Phase 8.

---

## Phase 8 — Internationalization & RTL

### 1. Goal

Full i18n architecture (19-language baseline) and RTL support across every
surface the spec requires (text, lists, tables, code blocks, TOC,
presentation, print/export, mind-map layout where practical).

### 2. Dependencies

Phase 1 (the i18n system, `t()` accessor and English catalog already exist —
ADR-0007), Phase 2-B (all UI surfaces must exist to be translated), Phase 6
(presentation/mind-map RTL), Phase 7-A/7-B (export RTL).

### 3. Features

F36, F37.

### 4. Technical tasks

1. **No retrofit pass exists** (changed 2026-09-08, ADR-0007): the loader,
   `t()` accessor, key convention, English catalog, `_locales/en` manifest
   substitutions and the `no-literal-user-strings` lint rule all shipped in
   Phase 1, and every phase since has written catalog keys. This phase's
   first task is therefore a *verification* one — run the lint rule and a
   key-coverage report over the whole codebase and confirm the English
   catalog is complete and canonical before translation begins. Fix any
   stragglers found (there should be few, and each one is a lint-rule gap
   worth closing).
2. Populate the remaining 18 locale catalogs (Spanish, French,
   German, Italian, Portuguese-Brazil, Dutch, Polish, Russian, Chinese
   Simplified, Chinese Traditional, Japanese, Korean, Vietnamese,
   Indonesian, Arabic, Persian, Urdu, Hebrew) — translation quality bar:
   correct and complete for UI chrome and settings-panel content (including
   individual Markdown/diagram feature-toggle names/descriptions), machine-
   assisted translation is acceptable for v1 with a documented note, not a
   blocker.
3. Implement the "Auto" language option per ADR-0007 §3 (resolution order,
   base-tag fallback, and the explicit Chinese alias map — `zh`/`zh-CN`/
   `zh-Hans` → Simplified, `zh-TW`/`zh-HK`/`zh-Hant` → Traditional) in both
   the popup quick-settings and the full options page, plus live catalog
   swapping via the `i18n:changed` event and per-locale `_locales`
   coverage for the manifest strings.
4. Implement RTL: `dir="auto"` at the appropriate block/paragraph
   granularity (native browser bidi algorithm handles most inline mixed-
   direction text for free) rather than a custom per-character detection
   algorithm; manual direction override in settings and per-document; code
   blocks stay LTR even inside RTL documents.
5. Verify RTL correctness across every listed surface: text alignment, list
   markers/indentation, table column order, TOC, presentation mode,
   print/export output, mind-map layout (best-effort where the layout
   library allows).
6. Ensure language/appearance changes apply live without reload (already a
   Phase 2-B requirement, F81 — this phase confirms it holds for language
   switching specifically, including RTL direction changes and open viewer
   tabs other than the one where the change was made).

### 5. Architecture changes

Extends `src/i18n/` (built in Phase 1) with the 18 additional catalogs,
"Auto" resolution + alias map, live-swap event, and RTL helper utilities.
Touches many components' *styles/direction handling*, but **not** their
strings — those were catalog keys from the start (ADR-0007 §5).

### 6. Data/storage changes

Adds `language` (including `"auto"`) and `textDirectionOverride` to the
`Settings` schema.

### 7. Security requirements

None new — translated strings go through the same rendering path as before
(no new attack surface), but confirm the i18n loader itself only ever loads
locale files bundled with the extension, never a remote translation
service.

### 8. Tests

- Unit: "Auto" locale resolution against various `navigator.language`
  values; RTL `dir="auto"` application logic at block granularity (confirm
  it never flips an entire document to RTL because of one paragraph).
- Integration: switch through several locales and confirm every surface
  updates live; a key-coverage report confirms no catalog is missing keys
  the English one has, and the Phase 1 lint rule still passes with zero
  suppressions (confirmation, not discovery — ADR-0007 §6); RTL rendering
  across TOC, presentation, print/export, mind-map.
- Manual: `docs/specs/06-testing-quality-gate.md` §4 step 14 (RTL content
  and manual override) and §3 "Files" row (RTL-script content).

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```
Plus the key-coverage report (every locale complete against the English
catalog) and the Phase 1 `no-literal-user-strings` lint rule passing with
zero suppressions.

### 10. Exit criteria

- All 19 baseline locales load and display correctly, including the "Auto"
  option in both popup and settings.
- No hardcoded UI-facing strings remain outside the i18n catalog system.
- RTL renders correctly across every surface listed in this phase's
  technical tasks.
- Language/direction changes apply live without reload, within budget
  **P11** (< 300 ms including catalog load) from
  `docs/specs/06-testing-quality-gate.md` §1a.

### 11. Known limitations

- Translation quality for machine-assisted locales is a v1 best-effort, not
  professionally reviewed — documented plainly, not overstated in the
  eventual store listing.
- Mind-map RTL layout is best-effort depending on the layout library chosen
  in Phase 6 — full RTL mirroring of a tree layout may have rough edges,
  documented rather than blocking.

### 12. Documentation updates

None beyond eventual `README.md` language-list mention (Phase 10).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 8 (Internationalization & RTL) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. The i18n
> *system* already exists from Phase 1 (ADR-0007) — do **not** rebuild it,
> and do not expect a retrofit: every UI string should already be a catalog
> key. Start by running the lint rule and a key-coverage report to confirm
> that, fixing only genuine stragglers. Your real scope is the 18 remaining
> locale catalogs, "Auto" resolution with the Chinese alias map, live
> switching, and the RTL sweep across every surface.
> Read: this plan's Phase 8 section, `docs/adr/0007-i18n-architecture.md`
> in full, `docs/specs/05-ux-i18n-accessibility.md` §5–6 (i18n and RTL
> sections) and feature-matrix rows F36, F37. Do not add new features
> beyond i18n/RTL plumbing — you are translating and direction-correcting
> existing UI, not building new surfaces. Run the verification commands,
> the key-coverage report, and tests in Phase 8 §9, fix issues, report what
> was implemented
> and tested (including which locales got full vs. machine-assisted
> translation), and stop. Do not start Phase 9.

---

## Phase 9 — Complete QA, Security & Performance

### 1. Goal

A full, cross-cutting verification sweep against every requirement in
`docs/specs/06-testing-quality-gate.md` — this phase does not implement new
features; it verifies, hardens, and fixes regressions found across the
whole product built in Phases 1–8.

### 2. Dependencies

All of Phases 0–8 complete.

### 3. Features

F38 (accessibility baseline, verified holistically here even though
individual phases built accessible patterns incrementally), F47 (privacy-
first/no-telemetry, verified as a cross-cutting audit), F53 (Chromium
cross-browser compatibility, verified here for the first time end-to-end).
Also re-verifies F50 (responsive layout) at full breadth across device
sizes.

### 4. Technical tasks

1. Run the full manual Chrome installation test pass from
   `docs/specs/06-testing-quality-gate.md` §4, steps 1–18, end to end on a
   fresh build — not incrementally per feature as prior phases did, but as
   one continuous pass simulating a real reviewer.
2. Run the complete security test set from
   `docs/specs/06-testing-quality-gate.md` §3 "Security" and
   `docs/specs/04-security-privacy.md` §4 against the final, integrated
   product (not just per-feature in isolation) — XSS via text/HTML/
   attributes, malicious HTML fragments, malicious SVG, `javascript:`/
   `data:` URLs, embedded `<script>` tags, unsafe Mermaid content.
3. Run the full performance sweep against **every numbered budget P1–P14 in
   `docs/specs/06-testing-quality-gate.md` §1a** — 1 MB/5 MB documents,
   hundreds of headings, many images, many code blocks, multi-diagram
   documents, a 1,000-file folder tree, a 50-annotation document, 20
   sequential document opens for memory hygiene, and the package-size
   tracking line. Record each measured number against its budget; a missed
   budget is a phase failure, not a note.
4. Run a full accessibility audit (F38): keyboard-only navigation of every
   interactive surface across every feature built, visible focus states,
   ARIA labels/roles, semantic HTML, screen-reader spot-check, WCAG AA
   contrast in both themes, `prefers-reduced-motion` respected everywhere
   an animation exists (including the Phase 5 celebration effect and any
   Phase 6 slide transitions).
5. Run a privacy audit (F47) against the **corrected criterion** in
   `docs/specs/04-security-privacy.md` §1 (revised 2026-09-08 — "zero
   network requests" was never achievable for a document viewer and would
   fail on the first README with a badge image). Confirm, via a
   full-product Playwright network audit across a representative session,
   that:
   - zero analytics/telemetry/tracking code exists anywhere in the codebase
     (a dependency + source audit, not just a claim);
   - **no request carries document content, document text, or any user
     identifier**;
   - every request target is either (a) the opt-in PlantUML server while
     that toggle is on, or (b) a subresource URL literally present in the
     open document (images at render time, and at export time for
     embedding);
   - with PlantUML off and "Block remote images" on, the product makes no
     outbound request at all;
   - no request goes to a font CDN or any other third-party asset host —
     all fonts, locales, themes and the Graphviz WASM binary load from the
     extension package.
6. Run cross-Chromium-browser smoke tests (F53): Edge, Brave, Opera,
   Vivaldi at minimum, confirming no Chrome-only API was used without
   justification (cross-check every `chrome.*`/browser API call used across
   all phases against Chromium-standard availability).
7. Run the full responsive-layout sweep (F50) across desktop, laptop,
   narrow-window, and tablet-sized viewports for every major feature
   surface (not just the baseline established in Phase 2-B).
8. Fix every discovered problem before considering this phase complete —
   per the spec's explicit quality-gate rule, a feature is never "done"
   based on "the build succeeded."
9. Produce the quality-gate checklist from
   `docs/specs/06-testing-quality-gate.md` §5 as a literal, filled-in
   checklist (not a restatement) confirming each line item.

### 5. Architecture changes

None expected — this phase fixes bugs/regressions found in existing
modules; any architecture change discovered as necessary here should be
scoped and flagged, not silently absorbed into an ad hoc fix that
contradicts an existing ADR.

### 6. Data/storage changes

None expected, other than any bug-fix-driven schema correction (with a
migration entry added to ADR-0004's registry if a stored-data shape
actually needs to change).

### 7. Security requirements

This entire phase *is* the security-requirements gate — see Technical
tasks 2 and 5 above. No new requirements beyond executing the full,
already-specified security test set against the integrated product.

### 8. Tests

- The full automated suite (`npm run test`, `npx playwright test`) is run
  as a single gate, not per-phase, catching cross-phase interaction bugs
  that per-phase testing couldn't see (e.g. a Phase 8 i18n change breaking
  a Phase 5 annotation UI string, or a Phase 4 auto-refresh interacting
  badly with Phase 6 presentation mode).
- Every manual test row from `docs/specs/06-testing-quality-gate.md` §3
  and §4 is executed and its outcome recorded.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```
Plus the full manual pass described in Technical tasks 1–7 above, and a
`tsc --noEmit` pass confirming zero TypeScript errors project-wide.

### 10. Exit criteria

Every line item in `docs/specs/06-testing-quality-gate.md` §5's quality
gate holds true, verified (not assumed) — this is the plan's hard gate
before Phase 10 polish begins. Specifically:

- No TypeScript errors, no build errors, no console errors during normal
  usage, no broken UI states.
- No obvious security vulnerabilities (full security test set passes).
- No unnecessary permissions requested (final manifest audited against
  `docs/specs/07-permissions-compliance.md` plus ADR-0004's
  `unlimitedStorage` amendment).
- Every section of `docs/specs/06-testing-quality-gate.md` §5's checklist
  holds — build/hygiene, security/privacy/permissions, content rendering,
  navigation/UI/settings, files/project workflow, reading productivity and
  annotations (including visible orphaning), advanced modes and export
  (including annotations in exports), i18n/RTL/accessibility, release
  surfaces and platform, and **every performance budget P1–P14**.
- The Accessibility area of §3 passes in full, not just "basics" — this is
  now its own test area with an automated axe pass, not a single checklist
  line.

### 11. Known limitations

Any limitation surfaced during this phase that isn't fixed (with
justification for why not) must be recorded here and carried into the
final product's `README.md`/known-limitations documentation in Phase 10 —
this phase must not silently drop a discovered issue.

### 12. Documentation updates

- `TESTING.md`: the filled-in quality-gate checklist plus a summary of
  what was tested and how.
- Update this plan's "Feature-to-phase mapping" table's Status column from
  "Not started" to "Verified" for every feature confirmed here (or
  "Implemented, not fully verified" with the specific gap noted, for
  anything not yet at full confidence).

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 9 (Complete QA, Security & Performance) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. This phase
> implements no new features — it verifies and fixes everything built in
> Phases 0–8. First inspect the actual current state of the full `src/`
> tree and the full automated test suite (do not assume prior phases'
> "Exit criteria" claims are still true without re-running them). Read:
> this plan's Phase 9 section in full,
> `docs/specs/06-testing-quality-gate.md` in full (this is this phase's
> primary reference document), and `docs/specs/04-security-privacy.md` §4.
> Run every verification command and manual test step listed in Phase 9
> §4 and §9. Fix every problem found — do not defer fixes to "Phase 10
> polish" unless the finding is genuinely cosmetic (spacing/animation
> polish, not correctness/security/a11y). Fill in the quality-gate
> checklist in `TESTING.md` and update the traceability table's Status
> column in this plan document. Report exactly what was tested, what was
> fixed, and what (if anything) remains a documented known limitation, and
> stop. Do not start Phase 10.

---

## Phase 10 — Production Polish & Release

### 1. Goal

First-run onboarding, remaining popup/help polish, "What's New" panel,
settings import/export, final UI/UX polish pass, and full Chrome Web Store
preparation — the last phase before the product is considered release-ready.
(The bundled demo document itself was built in Phase 2-A and extended by
each subsequent phase; this phase finalizes it and wires it into onboarding.)

### 2. Dependencies

Phase 9 complete (quality gate passed — polish happens on a verified base,
not a shaky one).

### 3. Features

F42, F45, F52, F57, F58 (F46's demo document was built in Phase 2-A and
extended by later phases; this phase only finalizes and integrates it).

### 4. Technical tasks

1. Build the first-run onboarding flow (F45): Welcome → explain local/
   private processing → explain the local-file-access permission and how to
   grant it → open the bundled sample document → live Mermaid example →
   live math example → keyboard-shortcut reference → Finish. No account
   creation at any step.
2. **Finalize** the bundled demo Markdown document (F46 — created in Phase
   2-A, extended by Phases 3-A/3-B/5/6): confirm it exercises headings/TOC,
   a table, code blocks, Mermaid, Graphviz, PlantUML (with the opt-in
   toggle explained inline), KaTeX, images, links, task lists, blockquotes,
   annotation-friendly content, and presentation-style sections; polish its
   prose; and wire it into the onboarding flow as the "open a sample
   document" step. Do not rewrite it from scratch — it has been the manual
   test vehicle since Phase 2-A.
3. Build the "What's New" panel (F52): shown once after an update,
   in-extension (not an external page), summarizing the current version's
   changes.
4. Build settings import/export as JSON (F42) in the options page's
   Import/Export section.
5. Build the help/feedback links (F57): feature-request link, report-issue
   link, rate-extension link (to the Chrome Web Store listing) — plain
   outbound navigations, explicitly triggered by the user, no background
   telemetry.
6. Build the License/attribution panel (F58): open-source library/license
   attribution list (generated from the actual dependency manifest, kept
   accurate) plus the static "License status: Free" line backed by the
   `licenseStatus` field from ADR-0004 — no validation logic behind it.
7. Full UI/UX polish pass: spacing, typography, animation consistency
   (respecting `prefers-reduced-motion` everywhere), loading states, error
   states, keyboard-focus consistency across every surface built in
   Phases 1–9.
8. Finalize all required documentation:
   `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`,
   `DEVELOPMENT.md`, `TESTING.md`, `RELEASE.md`, `CHANGELOG.md` — each
   reflecting actually-implemented, actually-verified behavior (per
   `docs/specs/08-glossary-references.md` §6's guidance: never aspirational
   claims written ahead of the code).
9. Complete the Chrome Web Store preparation checklist from
   `docs/specs/07-permissions-compliance.md` §4 line by line: final
   manifest-vs-justification audit, privacy-policy content matching actual
   behavior, store-listing description with no MarkView references,
   100%-original icons/screenshots, single-purpose description accuracy,
   confirmation of zero remote code execution, file-URL-access default-off
   messaging, PlantUML opt-in disclosure present in both settings UI and
   store listing.
10. Produce the final implementation report structured exactly as
    `docs/specs/08-glossary-references.md` §6 specifies: IMPLEMENTED /
    TESTED / KNOWN LIMITATIONS / PERMISSIONS / SECURITY / PERFORMANCE /
    BUILD / NEXT RECOMMENDATIONS.

### 5. Architecture changes

New `src/onboarding/` (or equivalent — first-run flow component), the
bundled demo document as a static asset. No changes to core rendering
architecture at this stage — this phase is additive polish, not
refactoring.

### 6. Data/storage changes

Adds an `onboardingCompleted: boolean` and `lastSeenWhatsNewVersion:
string` to the `Settings` schema.

### 7. Security requirements

- Settings import (F42) must validate/sanitize the imported JSON structure
  before applying it — never `eval` or otherwise trust an imported file's
  shape blindly (a malformed or crafted settings-export file must not be
  able to corrupt storage or inject unexpected values).
- Final full re-audit that the license-attribution list and "License
  status: Free" line contain zero references to any payment/license-key
  concept beyond the static "Free" text — no accidental scaffolding for a
  future paid tier beyond the explicitly reserved `licenseStatus` field.

### 8. Tests

- Unit: settings import/export round-trip (export then re-import produces
  identical settings); imported-JSON validation rejects malformed/
  unexpected shapes safely.
- Integration: full onboarding flow start-to-finish; "What's New" panel
  shows once per update and not again; bundled demo document exercises
  every feature area without error.
- Manual: complete `docs/specs/06-testing-quality-gate.md` §4 as a true
  first-time-user simulation (fresh Chrome profile, fresh install) using
  the onboarding flow and demo document as the primary test vehicle.

### 9. Verification commands

```
npm install
npm run build
npm run lint
npm run test
npx playwright test
```
Plus a final fresh-profile manual install/onboarding pass, and a manifest
diff review against `docs/specs/07-permissions-compliance.md` §2 (plus the
ADR-0004 `unlimitedStorage` amendment) confirming no undocumented
permission crept in across any phase.

### 10. Exit criteria

- Onboarding flow works end-to-end on first install, no account creation.
- Bundled demo document exercises the full feature set correctly.
- "What's New," settings import/export, help/feedback links, and the
  License/attribution panel all work.
- All required documentation files exist and accurately describe
  implemented, verified behavior.
- Chrome Web Store preparation checklist is fully complete.
- Final implementation report is produced in the required format.
- `npm install && npm run build` produces a loadable unpacked extension
  from a completely clean checkout (the spec's stated success criterion
  #5 in `docs/specs/00-overview.md`).

### 11. Known limitations

Final, consolidated list carried forward from every prior phase's "Known
limitations" section (PlantUML client-side rendering, the two-tier
DOCX-math fallback boundary, machine-assisted translation quality,
`file://`-flow auto-refresh's weaker change-detection signal, FSAA
permission-durability caveat, mind-map RTL best-effort) — assembled here as
the single authoritative list for `README.md`.

### 12. Documentation updates

All of `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`,
`DEVELOPMENT.md`, `TESTING.md`, `RELEASE.md`, `CHANGELOG.md` finalized.
`docs/specs/02-feature-matrix.md` may optionally be annotated (in a
follow-up edit, coordinated with the user, not unilaterally) with final
implementation status per feature, using this plan's traceability table as
the source.

### 13. Session boundary

**STOP after this phase.** This is the final phase in the plan. Any further
work is a new initiative (e.g., a future monetization phase, additional
locales, additional MarkView-parity gaps discovered post-launch), not a
continuation of this plan.

### Recommended session prompt

> Implement Phase 10 (Production Polish & Release) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First inspect
> the current state of the whole product (Phase 9 should have already
> passed the full quality gate — verify this is actually true, don't
> assume it). Read: this plan's Phase 10 section in full,
> `docs/specs/07-permissions-compliance.md` §4 (Web Store checklist),
> `docs/specs/08-glossary-references.md` §6 (final report format), and
> feature-matrix rows F42, F45, F46 (finalization only), F52, F57, F58.
> This phase is
> additive polish, integration and documentation — do not refactor core
> architecture here; if Phase 9 surfaced an architecture-level problem, that should have
> been fixed in Phase 9, not deferred here. The demo document already
> exists (Phase 2-A) — finalize and integrate it, do not rebuild it. Run
> the verification commands
> and the fresh-profile manual pass in Phase 10 §9, fix any polish issues
> found, finalize all required documentation files, produce the final
> implementation report in the exact IMPLEMENTED/TESTED/KNOWN LIMITATIONS/
> PERMISSIONS/SECURITY/PERFORMANCE/BUILD/NEXT RECOMMENDATIONS format, and
> stop.

---

# Post-v1 follow-up phases (added 2026-09-28)

Phase 10 §13 states that anything after it is "a new initiative … additional
MarkView-parity gaps discovered post-launch, not a continuation of this
plan." Phases 11 and 12 **are** exactly that initiative, kept in this
document so the traceability table stays in one place. They are numbered
sequentially but are not part of v1's Definition of Done: v1 = F01–F81,
delivered by Phases 0–10 and gated by Phase 9.

They exist because the 2026-09-28 audit of the user-maintained
`featureslist.md` against the shipped code found 6 Pending and 2 Partial
items. Their disposition is recorded in
`docs/specs/02-feature-matrix.md` §"Post-v1 additions — F82–F88":

- **Phase 11** — F82–F86: five self-contained, low-risk items (no new
  permission, no new network path, no new CSP concern).
- **Phase 12** — F87 custom CSS: **blocked** until
  `docs/adr/0009-user-custom-css-sanitization.md` moves from Proposed to
  Accepted and its environment spike passes. Split out precisely because it
  is the only one of the eight with a real security design behind it.
- **F88** (self-hosted Gitea raw Markdown) — **not scheduled**, by decision.
  The generic Markdown-suffix detection already covers the common case; the
  only permission-compliant way to do better is
  `optional_host_permissions` requested per instance at time of use, written
  up in `docs/specs/07-permissions-compliance.md` §2 amendment 4. If demand
  appears, that note is the phase brief; a static host pattern is rejected,
  not deferred.
- **`featureslist.md` #96** ("no true PDF encoder", marked Partial) — closed
  as **resolved by design**, no work planned: print-to-PDF is what `01 §24`
  specifies, `03 §1` locks, and ADR-0005 explicitly chose.

---

## Phase 11 — Reading-Experience & Export-Fidelity Follow-ups

### 1. Goal

Close the five straightforward gaps from the 2026-09-28 audit: a back-to-top
control, a zen/distraction-free reading mode, rich-HTML clipboard copy,
diagram-preserving DOCX export, and additional reading surfaces beyond
light/dark/system. All five are additive to shipped, verified subsystems —
this phase changes no permission, adds no network path, and touches no CSP.

### 2. Dependencies

Phase 10 complete (the product is released/release-ready; these are
post-v1 follow-ups on a verified base). Individually: F82/F83/F86 build on
Phase 2-B's toolbar/settings and Phase 1's theme layer; F84 builds on Phase
7-A's HTML-export serializer; F85 builds on Phase 7-B's DOCX mapper and
Phase 3-A/3-B's rendered diagram SVGs.

### 3. Features

F82, F83, F84, F85, F86.

### 4. Technical tasks

1. **Back-to-top control (F82).** Add the control to the viewer
   (`src/frontend/components/toolbar/` or a small sibling component, matching
   whichever the existing layout makes natural — do not invent a second
   floating-control pattern if one already exists). Requirements: hidden
   until a scroll threshold is passed, focusable and activatable by keyboard,
   labelled via `t()` (no literal strings — `code-conventions.md` §1),
   mirrored correctly under RTL (Phase 8's direction handling), smooth scroll
   normally but an instant jump under `prefers-reduced-motion` (Phase 9's
   reduced-motion rule), and hidden in presentation mode, mind-map mode and
   print (`print.css`).
2. **Zen / distraction-free mode (F83).** A toggle that hides toolbar,
   sidebars, reading-progress bar and the stats pill, leaving the rendered
   document. Entered from the toolbar/more-menu and by a shortcut registered
   through the existing in-page shortcut system
   (`src/backend/utils/shortcutDefinitions.ts` — an in-page shortcut, **not**
   a new `chrome.commands` entry); `Esc` exits. Persisted as a `Settings`
   field and live-applied (F81 pattern). Must compose predictably with
   presentation mode and the mind map (entering either from zen mode, and
   returning, leaves a coherent UI state) — state the chosen precedence in
   the commit.
3. **Rich-HTML clipboard copy (F84).** Replace the raw-Markdown-only
   clipboard action in the export dialog
   (`src/frontend/components/exportDialog/`) with a `ClipboardItem` carrying
   **both** `text/html` and `text/plain`. The `text/html` flavour is produced
   by the existing HTML-export serializer (`src/backend/export/html/`), which
   today only triggers a download — factor out a function that returns the
   serialized string so both callers share one code path; do not fork a
   second serializer. Keep a raw-Markdown copy action available as its own
   entry rather than silently removing a capability users have. Clipboard
   writes happen only in the user-gesture handler; no permission is added
   (`navigator.clipboard.write` from a user gesture on an extension page
   needs none — verify on the target Chrome build before building the UI).
4. **Diagram-preserving DOCX export (F85).** Today `astMapper.ts` maps
   `fence`/`mermaid_container` diagram blocks to code-text paragraphs.
   Mirror the tier-2 math path (`docx/mathRaster.ts` + the injected
   `MathRasterizer` seam): add a diagram rasterizer that takes the
   **already-rendered** SVG from the viewer DOM, converts it to PNG via the
   offscreen-canvas technique already implemented for diagram image download
   (`src/frontend/components/diagramChrome/`), and embeds it through
   `docx/images.ts`. Factor the SVG→PNG raster out of the download button so
   there is one rasterizer, not two. Define and document the
   token-block ↔ rendered-diagram correspondence (document order is the
   obvious contract; state it explicitly and test it on a document with
   mixed Mermaid/Graphviz/PlantUML blocks). **Fallback is mandatory and must
   not regress:** when no rendered SVG exists (render error, PlantUML opt-in
   off, diagrams disabled), the current code-text paragraph is emitted
   exactly as today.
5. **Additional reading surfaces (F86).** Add sepia/paper surface variants on
   top of the existing F34 theme layer (`src/backend/utils/theme.ts` +
   the design tokens), persisted and live-applied. Decide and record whether
   the new surfaces are additional `data-theme` values or an orthogonal
   attribute, and follow the precedent already set by the high-contrast
   toggle, which is deliberately orthogonal to light/dark
   (`Settings.highContrast`) — **do not add a second, competing
   high-contrast path**. Every surface must keep WCAG AA contrast (Phase 9's
   axe sweep covers both existing themes; extend it to the new surfaces) and
   must apply consistently to Markdown content, code blocks, Mermaid/KaTeX
   output, TOC and chrome, per `01 §25`.
6. **i18n.** Every new user-facing string gets a key in the English catalog
   and a translation in all 19 locales (`src/backend/i18n/locales/`), per
   ADR-0007 and Phase 8 — not an English-only stopgap. The
   `no-literal-user-strings` lint rule must stay at zero suppressions.
7. **Storage.** New `Settings` fields (zen mode, reading surface) go through
   the typed wrapper with a `SCHEMA_VERSION` bump and a migration entry per
   ADR-0004 — defaults must leave an existing user's appearance unchanged.

### 5. Architecture changes

Small and additive: one new viewer control (F82), one layout-state flag and
its CSS (F83), one extracted-and-shared HTML serialization function (F84),
one new `src/backend/export/docx/diagramRaster.ts` plus a shared SVG→PNG
utility (F85), new theme tokens (F86). No module-boundary changes; the
background worker, content script and popup are untouched
(`code-conventions.md` §3).

### 6. Data/storage changes

Two new `Settings` fields (zen mode on/off, reading surface), schema-version
bump plus migration (ADR-0004). No new storage areas, still
`chrome.storage.local` only.

### 7. Security requirements

- F84's clipboard HTML is serialized from the **already-DOMPurify-sanitized**
  rendered DOM through the existing export pipeline — no new path that turns
  content into HTML, and therefore no new sanitization surface. Assert in a
  test that a document containing a known XSS fixture produces inert
  clipboard HTML.
- F85 adds **no** network access: the SVG it rasterizes is already in the DOM,
  and rasterization is local canvas work. Re-run the Phase 9 network-audit
  spec against a DOCX export of a diagram-heavy document and assert no new
  request target appears.
- Custom CSS is **not** in this phase (F87/Phase 12) — nothing here may
  introduce a user-supplied-styles path as a shortcut.
- No manifest change of any kind. Diff `dist/manifest.json` against
  `docs/specs/07-permissions-compliance.md` §2 at the end of the phase and
  confirm it is byte-identical to the Phase 10 release manifest.

### 8. Tests

- Unit: back-to-top visibility-threshold logic and reduced-motion branch;
  zen-mode state reducer including the presentation/mind-map interaction;
  the extracted HTML-serialization function (same output as the download
  path, asserted against the existing export fixtures); diagram-block ↔
  rendered-SVG correspondence and the no-SVG fallback; reading-surface token
  resolution.
- Integration (Playwright): back-to-top scrolls to top and returns focus
  sensibly; zen mode hides/restores every listed chrome element and exits on
  `Esc`; clipboard copy places both flavours (read back via the Clipboard API
  in the test context) and pastes as formatted HTML; DOCX export of a
  document with Mermaid + Graphviz + a deliberately broken diagram yields
  images for the first two and the code-text fallback for the third; each
  reading surface applies and persists across reload.
- Security: the XSS-fixture clipboard assertion, plus the network-audit
  re-run above.
- a11y: extend the Phase 9 axe sweep to the new control, zen mode, and every
  new reading surface, in both light and dark.
- Manual: paste the rich clipboard payload into a real rich-text target
  (word processor / chat client) and confirm formatting survives; open the
  diagram-bearing DOCX in a real word processor and confirm the images
  render.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```
Plus the manual paste-target and DOCX-open checks above, and the
`dist/manifest.json` diff.

### 10. Exit criteria

- All five features work, are keyboard-accessible, are fully localized in all
  19 locales, and survive a reload.
- DOCX export embeds rendered Mermaid/Graphviz diagrams as images, and still
  falls back to the code-text paragraph when a diagram was never rendered —
  no regression to any construct already covered by Phase 7-B's tests.
- Rich clipboard copy produces both `text/html` and `text/plain`, sourced
  from the sanitized DOM, and the raw-Markdown copy action still exists.
- New reading surfaces pass WCAG AA contrast in the axe sweep.
- `dist/manifest.json` is unchanged from the Phase 10 release manifest.
- The lint rule for literal user-facing strings still reports zero
  suppressions.

### 11. Known limitations

- Rich clipboard fidelity is bounded by the receiving application's HTML
  paste support; diagrams/math paste as whatever the target does with inline
  SVG (document this, don't promise fidelity).
- DOCX diagrams are rasterized, not vector — Word has no reliable inline-SVG
  story; same accepted trade-off as the tier-2 math path.
- Zen mode hides chrome; it does not add a separate typography preset (that
  remains F35's job).

### 12. Documentation updates

`ARCHITECTURE.md` (the shared SVG→PNG rasterizer and the extracted HTML
serializer), `TESTING.md` (new specs and the extended axe sweep), `README.md`
(the four new user-facing capabilities and their limitations),
`CHANGELOG.md`. `SECURITY.md`/`PRIVACY.md` need **no** change — confirm that
in the commit rather than editing them reflexively.

### 13. Session boundary

**STOP after this phase. Implement the next phase in a new session.**

### Recommended session prompt

> Implement Phase 11 (Reading-Experience & Export-Fidelity Follow-ups) only,
> from `docs/plans/2026-09-08-markdownview-pro-implementation.md`. First
> verify the current state of what you are extending — the toolbar/export
> dialog under `src/frontend/components/`, the HTML/DOCX export modules under
> `src/backend/export/`, the theme layer in `src/backend/utils/theme.ts`, and
> the existing `Settings.highContrast` toggle — rather than trusting this
> plan's older sections, whose `src/viewer/...` paths predate the
> `frontend/`+`backend/` restructure. Read: this plan's Phase 11 section,
> `docs/adr/0005-export-architecture.md` (HTML serialization + the tier-2
> math raster pattern you are mirroring for diagrams), and feature-matrix
> rows F82–F86. Do **not** implement custom CSS (F87 — Phase 12, blocked on
> ADR-0009) or anything Gitea-related (F88 — not scheduled). Add no manifest
> permission and no network call. Localize every new string in all 19
> locales. Run the verification commands in Phase 11 §9, report what was
> implemented and tested, and stop.

---

## Phase 12 — User Custom CSS

### 1. Goal

Let users apply their own CSS to the rendered document, without adding a CSP
relaxation, a network egress path, or a way to hide the feature's own off
switch.

### 2. Dependencies

**Hard gate:** `docs/adr/0009-user-custom-css-sanitization.md` must be
**Accepted** (it is Proposed as of 2026-09-28), and its §1 environment spike
must have passed on the current Chrome stable build — confirm that
constructed stylesheets (`new CSSStyleSheet()` + `replaceSync()` +
`adoptedStyleSheets`) apply under a `style-src 'self'` extension-page CSP and
that `@import` is dropped, recording the result in `DEVELOPMENT.md` **before**
writing feature code. If the spike fails, the feature does not ship and does
**not** get a CSP exception — report and stop.

Otherwise: Phase 10 (settings-page structure, About/Import-Export sections)
and Phase 11 (the reading-surface work this sits beside, so the settings UI
presents "curated surface" and "custom CSS" coherently).

### 3. Features

F87.

### 4. Technical tasks

1. Run the ADR-0009 §1 spike and record it in `DEVELOPMENT.md`.
2. Build the sanitizer as a standalone, pure module (no DOM dependency beyond
   constructing an **unadopted** `CSSStyleSheet`): pass A text pre-scan for
   user-facing error messages, pass B recursive CSSOM walk as the
   authoritative gate, enforcing ADR-0009 §2's rules 1–7 (no `@import`;
   `url()` restricted to `data:` and same-document fragments, including
   inside custom properties and image-producing functions; 64 KB cap).
3. Add the `Settings` fields (enabled flag + CSS text) through the typed
   wrapper, with the ADR-0004 schema-version bump and migration; default off
   and empty. Re-run the sanitizer on the settings-import path (F42) before
   storing an imported value.
4. Build the settings-page editor: monospace textarea, explicit apply/revert,
   inline validation errors from pass A (localized via `t()`, announced
   through the shared notification component), a plain-language trust
   warning, and an always-available disable switch. The settings page itself
   is never styled by the sheet.
5. Apply/revoke the sheet on the viewer's rendered-content root only
   (ADR-0009 §3), live, without a reload (F81 pattern), and ensure it is
   excluded from HTML/print/DOCX export and from the F84 clipboard payload
   (ADR-0009 §5).
6. Localize every new string in all 19 locales.

### 5. Architecture changes

New `src/backend/viewer/customCss/` (sanitizer + adopt/revoke helper) and a
settings-page editor section. The sanitizer must sit beside, not inside, the
existing DOMPurify sanitization module — they guard different inputs
(document content vs. user-authored settings) and conflating them would blur
two threat models.

### 6. Data/storage changes

Two `Settings` fields (`customCssEnabled`, `customCss`), schema-version bump
plus migration, `chrome.storage.local` only.

### 7. Security requirements

Exactly ADR-0009: no CSP change (diff `dist/manifest.json` and confirm it is
unchanged); no new permission; the parsed CSSOM is the security boundary, not
the text pre-scan; the sheet never reaches popup/settings/toolbar/modals/
toasts; the value is never sourced from document content; it never enters an
export or the clipboard. Every row of ADR-0009's threat-case table becomes a
test, including the escape-obfuscation case and the zero-network Playwright
assertion reusing `e2e/phase9-network-audit.spec.ts`'s harness.

### 8. Tests

Per ADR-0009 §"Testing/Verification impact" — unit tests one-per-rule and
one-per-threat-case, the network-audit security spec, integration tests for
apply/persist/disable/reject-keeps-previous-sheet, export and clipboard
byte-identity with the feature on and off, and an a11y pass on the editor.

### 9. Verification commands

```
npm run build
npm run lint
npm run test
npx playwright test
```
Plus the ADR-0009 §1 spike result recorded in `DEVELOPMENT.md` and a
`dist/manifest.json` diff showing no permission or CSP change.

### 10. Exit criteria

- Every threat case in ADR-0009 is covered by a passing test, and the
  zero-network assertion holds with hostile CSS applied.
- Custom CSS applies live to the document, persists, and can always be
  disabled from a settings page it cannot style.
- Exports and the rich clipboard payload are byte-identical with the feature
  on and off.
- `dist/manifest.json` shows no new permission and no CSP change.
- The feature ships off and empty by default.

### 11. Known limitations

- No remote images, fonts or stylesheets in custom CSS, ever — `data:` URLs
  are the only image escape hatch (ADR-0009 §"Consequences").
- Fixed-position overlay *within* the content root remains possible; bounded
  by scope, the kill switch and the trust warning — an accepted, documented
  residual risk, to be listed in `README.md`'s limitations and `SECURITY.md`.
- Custom CSS does not affect exports by design.

### 12. Documentation updates

`SECURITY.md` (the sanitization rules and the residual risk), `README.md`
(capability + the no-remote-URL limitation, stated with its reason),
`ARCHITECTURE.md` (the constructed-stylesheet application path),
`TESTING.md`, `DEVELOPMENT.md` (the spike result), `CHANGELOG.md`.
`PRIVACY.md` needs no new disclosure — the feature adds no egress — but say
so explicitly in the commit.

### 13. Session boundary

**STOP after this phase.** F88 (Gitea) is not scheduled work; do not start it
from this session. Anything further is a new initiative.

### Recommended session prompt

> Implement Phase 12 (User Custom CSS) only, from
> `docs/plans/2026-09-08-markdownview-pro-implementation.md`. **First check
> that `docs/adr/0009-user-custom-css-sanitization.md` is Accepted, not
> Proposed — if it is still Proposed, stop and report; this phase is gated on
> it.** Then run the ADR-0009 §1 environment spike against the current Chrome
> build and record the result in `DEVELOPMENT.md` before writing any feature
> code; if the spike fails, stop and report rather than relaxing the CSP.
> Read: this plan's Phase 12 section, ADR-0009 in full,
> `docs/specs/04-security-privacy.md` §3 (the custom-CSS subsection), and
> feature-matrix row F87. The parsed CSSOM walk — not the text pre-scan — is
> the security boundary; every row of ADR-0009's threat table must become a
> passing test. Add no permission and no CSP change. Run the verification
> commands in Phase 12 §9, report what was implemented and tested, and stop.

---

## Phase dependency graph

```text
Phase 0 (validation)
   |
   v
Phase 1 (foundation: handoff, storage, i18n system, theme, popup)
   |
   v
Phase 2-A (markdown pipeline + content rendering + demo doc)
   |
   v
Phase 2-B (reading UI, navigation, settings)
   |
   +----------------+------------------+
   v                v                  v
Phase 3-A        Phase 4            Phase 5
(KaTeX/Mermaid)   (files/folders)   (annotations)
   |                                   |
   v                                   |
Phase 3-B                              |
(Graphviz/PlantUML)                    |
   |                                   |
   +----------------+                  |
   v                v                  |
Phase 6          Phase 7-A <-----------+
(present/mindmap) (HTML/PDF export)      (annotations must render in exports)
                     |                 |
                     v                 |
                  Phase 7-B <----------+
                  (DOCX export)

Phase 1 + 2-B ---------------------> Phase 8 (i18n locales/RTL)
   (also depends on Phase 6, 7-A, 7-B for full RTL/export coverage)

Phases 0-8 all -------------------> Phase 9 (QA/security/perf gate)
                                        |
                                        v
                                     Phase 10 (polish/release)
```

Notes:
- Phase 2-B depends on 2-A only for having rendered content and heading
  anchors to attach UI to; the split exists to keep each phase inside one
  working session (the original combined Phase 2 was 24 features/18 tasks).
- Phase 4 and Phase 5 both depend only on Phases 1–2-B and can, in
  principle, be implemented in either order or by parallel sessions once
  2-B is done — but Phase 6 depends on Phase 3-A (not on 4/5), so 3-A
  should not be delayed behind 4/5 if parallelizing. Phase 5 is now on the
  critical path to 7-A/7-B because annotations must appear in exports.
- Phase 8 no longer contains any i18n *retrofit* — the key system, `t()`
  and the English catalog ship in Phase 1 (ADR-0007). Phase 8 is the
  remaining 18 locales, "Auto" resolution, live switching and the RTL
  sweep, which is why it still sits after the surfaces it must verify.
- Phase 9 and Phase 10 are strictly sequential and strictly last **for v1**.
- Post-v1 (2026-09-28): `Phase 10 -> Phase 11 -> Phase 12`. Phase 11 depends
  on the shipped v1 surfaces it extends; Phase 12 depends on Phase 11 only
  for settings-UI coherence with the new reading surfaces, and is otherwise
  gated on ADR-0009 being Accepted plus its environment spike passing —
  a documentation/decision gate, not a code dependency.

## Feature-to-phase mapping (traceability table)

Status column starts at "Not started" for every row (repository has zero
implementation as of this plan). Update this column as each phase's Phase 9
verification confirms it — see Phase 9 §12.

| Feature ID | Requirement (spec §) | Phase | Module/component | Test type | Verification | Status |
|---|---|---|---|---|---|---|
| F01 | 01 §1 | 1 | src/content/ | Unit, Integration | npm test, manual install | Verified |
| F02 | 01 §1, 07 | 1 | src/content/, src/popup/ | Unit (detection predicate) + **Manual** (full `file://` round-trip — not automatable, see Phase 1 §8) | manual install steps 3a/3b | Implemented, not fully verified — the `file://` round-trip needs a human with real Chrome and the "Allow access to file URLs" toggle; not automatable (Phase 9 §4 note) |
| F03 | 01 §1 | 1 | src/content/ | Integration | manual install step 4 | Verified (automated; ADR-0006 handoff/no-refetch covered by e2e) |
| F04 | 01 §1, §31 | 1 (auto-render), 2-B (on-demand action) | src/content/, src/popup/ | Integration | manual install step 5; Playwright assertion that no non-clicked tab is touched | Verified |
| F05 | 01 §1, 03 §5 | 1 | src/content/ | Unit | npm test (asserts blob/GitBook/RTD never match; no opt-in toggle in v1) | Verified |
| F06 | 01 §33 | 1 | src/viewer/ | Integration | npm test | Verified |
| F07 | 01 §1, §31 | 1, 4 | src/popup/, src/viewer/ | Integration | npm test, manual | Verified |
| F08 | 01 §2 | 2-A | src/viewer/markdown/ | Unit, Security | npm test | Verified |
| F09 | 01 §3, ADR-0008 | 2-A | src/viewer/markdown/mdx/ | Unit, Security | npm test (ADR-0008 threat-case table) | Verified |
| F10 | 01 §4 | 2-A | src/viewer/syntax/ | Unit | npm test | Verified |
| F11 | 01 §5 | 3-A | src/viewer/mermaid/ | Unit, Security | npm test | Verified |
| F12 | 01 §8 | 3-A | src/viewer/math/ | Unit | npm test | Verified |
| F13 | 01 §7 | 3-B | src/viewer/diagrams/graphviz/ | Unit, Security | npm test | Verified |
| F14 | 01 §6 | 3-B | src/viewer/diagrams/plantuml/ | Integration, Security | npm test, network audit | Verified (Phase 9 network audit: only fetch() caller in the codebase, gated by opt-in setting) |
| F15 | 01 §9 | 2-B | src/components/toc/ | Integration | npm test | Verified |
| F16 | 01 §10 | 5 | src/components/ (progress) | Integration | npm test | Verified |
| F17 | 01 §11 | 5 | src/components/ (stats) | Unit | npm test | Verified (Phase 9 also fixed a real countWords() perf bug — see TESTING.md) |
| F18 | 01 §12 | 2-B | src/viewer/ | Integration | npm test | Verified |
| F19 | 01 §13 | 4 | src/components/browser/ | Integration | npm test, manual step 9 | Verified |
| F20 | 01 §14 | 4 | src/components/browser/, workers | Integration, Perf | npm test | Verified (P8 budget measured, holds) |
| F21 | 01 §15 | 4 | src/storage/ | Unit | npm test | Verified |
| F22 | 01 §16 | 4 | src/storage/, src/popup/ | Integration | npm test | Verified |
| F23 | 01 §17 | 4 | src/viewer/ (poll loop) | Integration | npm test, manual | Verified |
| F24 | 01 §18 | 2-B | src/components/lightbox/ | Integration | npm test | Verified |
| F25 | 01 §19 | 2-A | src/viewer/markdown/links/ | Unit | npm test | Verified |
| F26 | 01 §20 | 2-A | src/components/ (tables) | Integration | npm test | Verified |
| F27 | 01 §21, §24 | 5 (engine/UI), 7-A + 7-B (export rendering) | src/viewer/annotations/, src/export/ | Unit, Integration | npm test; export round-trips include annotations | Verified (incl. P9 budget) |
| F28 | 01 §22 | 6 | src/components/presentation/ | Integration | npm test, manual step 10 | Verified |
| F29 | 01 §23 | 6 | src/components/mindmap/ | Integration | npm test, manual step 11 | Verified |
| F30 | 01 §24 | 7-A | src/export/html/ | Integration, Security | npm test (incl. annotation rendering) | Verified (incl. P12 budget, added Phase 9) |
| F31 | 01 §24 | 7-B | src/export/docx/ | Integration | npm test, manual (incl. annotation rendering) | Verified (automated; manual real-Word-processor open not performed this session) |
| F32 | 01 §24 | 7-A | src/export/print/ | Manual | manual print pass (incl. annotation endnotes) | Implemented, not fully verified — automated e2e covers the print-CSS/invoke path; visual print-to-PDF fidelity needs a human pass |
| F33 | 01 §24 | 3-A + 3-B (diagram SVG/PNG), 6 (mind map SVG/PNG/JPEG), 7-A (verify inside HTML export) | src/components/ (diagram chrome), src/export/html/ | Integration | npm test | Verified |
| F34 | 01 §25 | 1 | src/styles/ | Integration | npm test | Verified |
| F35 | 01 §26 | 2-B | src/settings/ | Unit | npm test | Verified |
| F36 | 01 §27 | 8 | src/i18n/ | Integration, Manual | npm test, manual step 14 | Implemented, not fully verified — RTL renders correctly per unit/e2e coverage; the full manual RTL-locale + file-URL walkthrough (step 14) was not performed this session |
| F37 | 01 §28, ADR-0007 | 1 (system + English catalog + lint rule), 8 (18 locales, Auto, live switch) | src/i18n/, `_locales/` | Unit, Integration | npm test, lint rule, key-coverage report | Verified (P11 budget test added Phase 9 — Phase 8's own "integration: switch through several locales live" test plan item had never actually been implemented until now) |
| F38 | 01 §29 | 9 (cross-cutting) | all UI modules | Manual, a11y audit | Phase 9 audit | Verified — full a11y sweep added (`e2e/phase9-a11y.spec.ts`, 13 tests: axe + keyboard nav on annotations/presentation/mind map/folder browser/search/lightbox, each in both themes); found and fixed 4 real bugs (missing focus trap on 3 dialogs, a dark-theme-only WCAG AA contrast failure, a landmark gap on the empty state, the reduced-motion gap) — see TESTING.md. Full manual screen-reader spot-check not performed this session (checklist in `docs/manual-verification-checklist.md`) |
| F39 | 01 §30 | 2-B | src/components/toolbar/ | Integration | npm test, manual step 15 | Verified |
| F40 | 01 §31 | 1 | src/popup/ | Integration | npm test | Verified |
| F41 | 01 §32 | 2-B | src/settings/ | Integration | npm test | Verified |
| F42 | 01 §32 | 10 | src/settings/ | Unit | npm test | Verified (`src/settings/importExport.ts` + `e2e/phase10.spec.ts` round-trip/malformed-import specs) |
| F43 | 01 §38 | 2-A | src/viewer/markdown/ | Unit | npm test | Verified |
| F44 | 01 §39 | 2-A | src/viewer/markdown/ | Unit | npm test | Verified |
| F45 | 01 §37 | 10 | src/onboarding/ | Integration, Manual | manual fresh-profile | Verified (automated) — full 8-step walkthrough end-to-end in `e2e/phase10.spec.ts`, incl. opening the real sample document and rendering live Mermaid/math examples through the real pipeline. A true fresh-Chrome-profile manual pass was not performed this (non-interactive) session — see RELEASE.md |
| F46 | 01 §37 | 2-A (built), 3-A/3-B/5/6 (extended), 10 (finalized) | static asset | Manual | used as the manual-test vehicle from Phase 2-A onward | Verified — finalized this phase (stale "Phase 3-A/3-B" comment removed, PlantUML opt-in explained inline, an annotation-friendly section and an explicit presentation-mode note added), wired into onboarding's "Open sample document" step, confirmed it renders end-to-end via `e2e/phase10.spec.ts` |
| F47 | 04 | 9 (cross-cutting) | all modules | Security audit | Phase 9 network audit | Verified — dedicated full-session network audit added (`e2e/phase9-network-audit.spec.ts`); no telemetry/analytics dependency in package.json; no request carries document content/identifiers; every request target is either the opt-in PlantUML server or a document-referenced subresource; manifest matches 07-permissions-compliance.md exactly; "Block remote images" (§1 point 4), found missing in every prior phase, was implemented this session (`Settings.blockRemoteImages` — see TESTING.md) |
| F48 | 01 §34 | 2-B | src/components/toolbar/ | Integration | npm test | Verified |
| F49 | 01 §35 | 2-B | src/components/search/ | Integration | npm test | Verified (P6 budget measured, holds) |
| F50 | 01 §36 | 2-B (baseline), 9 (full) | all UI modules | Manual | Phase 9 responsive sweep | Verified — horizontal-overflow sweep added across desktop/laptop/tablet/narrow widths for the viewer/annotations panel/settings page (only one width and one surface were tested before). Found a real UX finding, not silently fixed: the TOC drawer (open by default) covers the toolbar entirely at <=768px until closed — recorded in TESTING.md as a product decision. A hands-on sweep across physical devices was not performed |
| F51 | 02 (F51 row) | 5 | src/components/sidebar/ | Integration | npm test | Verified |
| F52 | 02 (F52 row) | 10 | src/onboarding/ or settings | Integration | npm test | Verified — built in `src/popup/` (not onboarding/settings: the popup is the surface every update-then-reopen actually hits) + `src/components/whatsNew/`; unit-tested (`shouldShowWhatsNew`) and e2e-tested (shows once post-onboarding for an unseen version, stays hidden after dismissal and reload) |
| F53 | 03 §7 | 9 (cross-cutting) | manifest, all APIs | Manual | Phase 9 cross-browser | Implemented, not fully verified — Chrome (via Playwright) and Edge (manual smoke: extension loads, popup renders, viewer renders a dropped document, zero console errors) verified; Brave/Opera/Vivaldi are not installed on this dev machine and were not tested — known limitation, see TESTING.md |
| F54 | 02 (F54 row) | 1 | src/popup/ | Unit | npm test | Verified |
| F55 | 02 (F55 row) | 4 | src/storage/, src/popup/ | Unit | npm test | Verified |
| F56 | 01 §22 | 6 | src/settings/, src/components/presentation/ | Integration | npm test | Verified |
| F57 | 02 (F57 row) | 10 | src/components/toolbar/, src/popup/ | Manual | manual | Verified — built in `src/popup/` (Help tab) and `src/settings/` (About section) via the shared `src/utils/aboutContent.ts`; the toolbar itself wasn't extended (its existing Settings button is the entry point — see ARCHITECTURE.md's Phase 10 notes for the reasoning). Destination URLs are real, disabled-until-configured placeholders, not invented ones — see RELEASE.md |
| F58 | 02 (F58 row) | 10 | src/popup/, src/storage/ | Unit | npm test | Verified — "License status: Free" row + open-source attribution list (generated from `package.json` via `scripts/generate-attributions.mjs`) in both the popup Help tab and settings About section; e2e-tested (`e2e/phase10.spec.ts`) |
| F59 | 02 (F59 row) | 4 | src/storage/, src/popup/ | Integration | npm test | Verified |
| F60 | 01 §9 | 2-A | src/viewer/markdown/, src/components/toc/ | Unit, Integration | npm test | Verified |
| F62 | 01 §10 | 5 | src/components/ (progress) | Manual | prefers-reduced-motion test | Verified — e2e reduced-motion test added Phase 9 (this claim, like F38's, had never actually been automated before now) |
| F63 | 01 §13 | 4 | src/components/browser/ | Unit | npm test | Verified |
| F64 | 01 §13 | 4 | src/components/browser/ | Integration | npm test | Verified |
| F65 | 01 §13 | 4 | src/components/browser/ | Integration, Perf | npm test | Verified (P7 budget measured, holds) |
| F67 | 01 §2 | 2-A | src/viewer/markdown/ | Unit | npm test | Verified |
| F68 | 01 §2 | 2-A | src/viewer/markdown/mdx/ (shared with F09) | Unit | npm test | Verified |
| F69 | 01 §2 | 2-A (pipeline config), 2-B (settings UI) | src/viewer/markdown/, src/settings/ | Unit | npm test | Verified |
| F70 | 01 §4 | 2-A (themes), 2-B (picker UI) | src/viewer/syntax/, src/settings/ | Integration | npm test | Verified |
| F71 | 01 §11 | 5 | src/components/ (stats) | Unit | npm test | Verified (see F17 — countWords() perf fix preserved identical counting semantics, all 9 tests still pass) |
| F72 | 01 §19 | 2-A | src/viewer/markdown/links/ | Unit | npm test (icon rule; hover preview stays URL-only, no fetch) | Verified |
| F73 | 01 §26 | 2-B | src/components/sidebar/ | Integration | npm test | Verified |
| F74 | 01 §17 | 4 | src/viewer/ (poll loop) | Integration | npm test | Verified |
| F75 | 01 §16 | 4 | src/storage/ | Unit | npm test | Verified |
| F76 | 01 §22 | 6 | src/components/presentation/ | Unit, Integration | npm test | Verified |
| F78 | 01 §40 | 1 | src/components/ (notifications) | Integration | npm test | Verified |
| F79 | 01 §5 | 3-A | src/viewer/mermaid/ | Unit | npm test | Verified |
| F80 | 01 §13 | 4 | src/storage/ (IndexedDB) | Integration | npm test | Verified |
| F81 | 01 §26 | 2-B | src/settings/ | Integration | npm test (incl. propagation to a second open viewer tab) | Verified (P10 budget test tightened Phase 9 to match the documented 100ms number, not a 500ms placeholder) |
| F82 | 02 (F82 row) | 11 | src/frontend/components/toolbar/ (or sibling control) | Unit, Integration, a11y | npm test, npx playwright test | Not started (post-v1) |
| F83 | 02 (F83 row) | 11 | src/frontend/ (layout state), src/backend/storage/ | Unit, Integration, a11y | npm test, npx playwright test | Not started (post-v1) |
| F84 | 02 (F84 row) | 11 | src/frontend/components/exportDialog/, src/backend/export/html/ | Unit, Integration, Security, Manual | npm test, npx playwright test, manual paste into a rich-text target | Not started (post-v1) |
| F85 | 02 (F85 row) | 11 | src/backend/export/docx/ (diagramRaster), src/frontend/components/diagramChrome/ (shared rasterizer) | Unit, Integration, Manual | npm test, manual open in a word processor | Not started (post-v1) |
| F86 | 02 (F86 row) | 11 | src/backend/utils/theme.ts, design tokens, src/settings/ | Unit, Integration, a11y (contrast) | npm test, axe sweep | Not started (post-v1) |
| F87 | 02 (F87 row), 04 §3, ADR-0009 | 12 | src/backend/viewer/customCss/, src/settings/ | Unit, Security, Integration, a11y | npm test, npx playwright test (network audit with hostile CSS), manifest diff | **Blocked** — ADR-0009 is Proposed, not Accepted; spike not run |
| F88 | 02 (F88 row), 07 §2 amendment 4 | — | — | — | — | **Not scheduled by decision** — generic suffix detection already covers the common case; a static host pattern is rejected, and the `optional_host_permissions` design is recorded in `07-permissions-compliance.md` §2 amendment 4 |

**Rule (restated from the user's instructions):** a feature is marked
"Verified"/complete only after Phase 9 (or its own phase's tests, for
lower-risk items, with Phase 9 re-confirming) actually runs the listed test
type and it passes — never merely because the code exists or the build
succeeds.

## Permission matrix

Carried forward from `docs/specs/07-permissions-compliance.md` §2, plus the
ADR-0004 `unlimitedStorage` amendment. Each row still owes the 4-question
checklist from that spec's §3 at the point it's actually added (Phase 0/1
for the first three rows, Phase 4 for `unlimitedStorage`).

| Permission | Purpose | Required/Optional | Narrower alternative | Security implications | Web Store considerations |
|---|---|---|---|---|---|
| `storage` | Persist settings/recents/bookmarks/annotations locally | Required | None narrower — already `chrome.storage.local`, not `sync` | Local-only data, no exfiltration path via this permission itself | Standard, low-scrutiny permission |
| File URL access — the `chrome://extensions` toggle **plus `"file:///*"` in `host_permissions`** (ADR-0006 §4) | Read local Markdown via direct `file://` navigation (ADR-0001 Flow A), and re-read it from the viewer page for auto-refresh (F23) | Required for that flow, but inert until the user enables the toggle | File System Access API (Flow B) needs neither the toggle nor the host permission — offered as the friction-free default path | User must explicitly enable; extension must never claim/assume it's on | Clear in-product instructions required (built Phase 1). Note: **no http(s) host permission is required anywhere in v1** — remote documents are never re-fetched (ADR-0006 §2) |
| `content_scripts.matches` (narrow path-glob patterns, per ADR-0001 §2) | Auto-render `.md`/`.markdown`/`.mdx`/`llms.txt` URLs and curated raw-Git hosts | Required | Already the narrower alternative vs. `<all_urls>` or broad host permissions — see ADR-0001 | Scoped to URLs matching specific path suffixes only | Should read as clearly proportionate to a Markdown-viewer's single purpose |
| `activeTab` | Powers the popup's "Render this page as Markdown" action (Phase 2-B task 11) — the on-demand fallback for suffix-less/content-type-only Markdown | Required | Already the minimal "act on demand" option | No persistent access; scoped to the explicit click | Standard, low-scrutiny permission — and now backed by a shipped feature, not declared speculatively |
| `scripting` | Inject the detection/handoff content script into the tab `activeTab` just granted, for that same action | Required | A broad static content script gated at runtime — rejected as strictly more invasive | Reachable only for tabs the user granted via `activeTab` | No install-time warning of its own; added in Phase 2-B, not earlier |
| `commands` | Register global keyboard shortcuts (e.g. theme toggle) | Required only for shortcuts needing OS-level registration | In-page shortcuts (viewer-focused) need no extra permission | None beyond shortcut registration | Standard |
| `downloads` | Only if a specific export path genuinely needs the Downloads API (control over save location/filename) | Optional, requested only if `<a download>` proves insufficient for a specific export flow | `<a download>` native browser save (used by default for HTML/DOCX/image exports, per ADR-0005) | None beyond standard download behavior | Prefer avoiding unless a concrete gap is found in Phase 7 |
| `unlimitedStorage` | Cover realistic worst-case annotation/recents/bookmark storage growth beyond the default ~10 MB quota | **Optional** (`optional_permissions`), requested via `chrome.permissions.request()` only when usage crosses a warning threshold — see ADR-0004 | Default quota is the v1 baseline; this is the fallback, not a day-one grant | Broad-sounding name but scoped to local storage only, requested contextually with disclosure | Document the contextual-request pattern explicitly in the store listing/privacy policy per ADR-0004 |

No permission for: browsing history, cookies, tabs beyond `activeTab`,
bookmarks (Chrome's own), geolocation, notifications-as-default, or any
analytics/telemetry SDK — unchanged from `07-permissions-compliance.md`.

**Post-v1 (2026-09-28):** Phases 11 and 12 add **no row to this table** —
both must leave `dist/manifest.json` byte-identical to the Phase 10 release
manifest, and both list that diff as an exit criterion. The only
permission-bearing item from the checklist audit is F88 (self-hosted Gitea),
which is not scheduled; if it is ever built it uses
`optional_host_permissions` requested per instance at time of use, per
`docs/specs/07-permissions-compliance.md` §2 amendment 4 — never a static
`*://*/raw/*` pattern.

## Major architecture decisions (ADR summary)

| ADR | One-line decision |
|---|---|
| [0001](../adr/0001-file-access-and-detection.md) | Two separate local-file-access code paths (`file://` toggle vs. File System Access API); narrow content-script path-glob matching resolves the arbitrary-site-detection vs. minimum-permissions conflict |
| [0002](../adr/0002-diagram-rendering-strategy.md) | Mermaid `strict` mode + DOMPurify (not sandboxed iframe); Graphviz via bundled WASM (never CDN-fetched); PlantUML local rendering is infeasible for v1, opt-in remote only |
| [0003](../adr/0003-annotation-identity-and-reanchoring.md) | Annotation re-anchoring via text-quote + prefix/suffix context + character-offset fallback, with explicit visible orphaning on ambiguity |
| [0004](../adr/0004-storage-schema-and-quota.md) | Sharded per-document annotation storage; versioned schema with an empty-but-ready migration registry; `unlimitedStorage` as an optional, contextually-requested permission |
| [0005](../adr/0005-export-architecture.md) | HTML/print export reuse the rendered DOM; DOCX export is a dedicated AST-to-OOXML mapper (no off-the-shelf converter exists) with a three-tier math fallback; annotations render into all three formats |
| [0006](../adr/0006-viewer-surface-and-content-acquisition.md) | The viewer is an extension page; the content script hands over text the browser already loaded (single-use IndexedDB record + `location.replace`), so no http(s) host permission is ever needed and every renderer runs under our own CSP |
| [0007](../adr/0007-i18n-architecture.md) | Hybrid i18n: `_locales`/`chrome.i18n` for manifest/store strings, a bundled runtime catalog for all UI (the only way to get both a localized listing and live language switching); the system ships in Phase 1, not as a Phase 8 retrofit |
| [0008](../adr/0008-mdx-handling-and-safe-degradation.md) | MDX is handled by a pre-parse text transform (ESM stripped, component tags stripped but inner content kept, attributes discarded, braces literal) feeding the normal markdown-it + DOMPurify path — never an MDX compiler |
| [0009](../adr/0009-user-custom-css-sanitization.md) | **Proposed (2026-09-28), gates Phase 12** — user custom CSS is applied via a constructed stylesheet (never `<style>`, so no `style-src 'unsafe-inline'`), gated by a parsed-CSSOM sanitizer that rejects `@import` and any `url()` outside `data:`/same-document fragments, scoped to the rendered-content root only |

## Major technical risks

1. **DOCX export fidelity** (Phase 7-B) — the largest custom-logic surface
   in the plan, with no off-the-shelf converter to fall back on. Mitigated
   by scoping it as its own phase with an explicitly defined tier-1 OMML
   construct set as an exit criterion, rather than an open-ended fidelity
   target.
2. **Annotation re-anchoring correctness** (Phase 5) — the most technically
   open requirement in the original spec set. Mitigated by ADR-0003
   defining a concrete, testable algorithm before implementation begins,
   with explicit unit tests for every branch (fast-path, disambiguation,
   orphaning).
3. **Mermaid/Graphviz under MV3's strict CSP** — real risk that a library
   version's internals trip the CSP in ways not discoverable until tested
   against a real Chrome build. Mitigated by making this a Phase 0 spike,
   before any feature code depends on the assumption.
4. **File System Access API permission-persistence durability** (Phase 4) —
   Chrome's actual behavior across restarts is not fully guaranteed;
   mitigated by the documented "Reconnect folder" fallback rather than a
   promise of zero-friction persistence.
5. **i18n coverage** (Phases 1–8) — *previously* framed as a Phase 8
   retrofit across every UI file, which contradicted the spec's
   "no hardcoded strings from the first line of UI code" requirement.
   Mitigated structurally rather than procedurally: ADR-0007 moves the key
   system, `t()` and the English catalog into Phase 1 and adds a lint rule,
   so Phase 8 translates an already-complete key set instead of hunting
   string literals.
6. **Storage quota exhaustion for heavy users** — not addressed by the
   original spec at all. Mitigated by ADR-0004's monitored, opt-in
   `unlimitedStorage` request.

## Known Chrome API limitations (consolidated)

- MV3 background service workers are non-persistent — no reliable
  long-running timers; auto-refresh must live in the viewer page (ADR-0001).
- "Allow access to file URLs" cannot be requested programmatically — only
  explained with in-product instructions (F02). It also cannot be set by a
  Chrome launch flag or by Playwright, so **Flow A has no automatable E2E
  path**; the detection predicate is unit-tested and the round-trip is a
  mandatory manual step (`docs/specs/06-testing-quality-gate.md` §4 step 3a).
- `FileSystemDirectoryHandle`/`FileHandle` objects are not
  `chrome.storage.local`-serializable — require IndexedDB (ADR-0001).
- FSAA permission grants are not guaranteed to silently survive every
  browser restart for extensions — requires a reconnect affordance
  (ADR-0001).
- MV3 CSP disallows `unsafe-eval`/`unsafe-inline` unconditionally for
  extension pages; WASM requires the explicit `wasm-unsafe-eval` directive,
  and WASM binaries must be bundled, not CDN-fetched (ADR-0002).
- No production-viable client-side PlantUML renderer exists (ADR-0002).
- `window.print()` does not wait for lazy-loaded images — must force-load
  before invoking (ADR-0005).
- The `docx` npm package is a builder, not an HTML/Markdown converter — no
  shortcut exists for DOCX fidelity (ADR-0005).
- Raw-content hosts (notably `raw.githubusercontent.com`) serve
  `default-src 'none'; sandbox` CSPs, so resources injected into such a page
  (fonts, images, WASM) are blocked — inline rendering is not viable and the
  viewer must be an extension page (ADR-0006).
- An extension page cannot fetch arbitrary origins without host permissions;
  the handoff model avoids needing any, by reusing bytes the browser already
  downloaded (ADR-0006).
- `chrome.i18n` resolves against the browser UI locale and cannot switch at
  runtime; `_locales` is the only way to localize manifest/store strings —
  hence the hybrid in ADR-0007.

## Testing strategy

- **Unit**: Vitest, colocated with source, covering pure logic (parsers,
  anchoring algorithm, quota calculations, i18n resolution, OOXML mapping)
  — established in Phase 0, used every phase.
- **Integration**: Vitest + jsdom or Playwright component-level tests for
  DOM-dependent behavior (scroll-spy, lightbox navigation, diagram chrome).
- **End-to-end**: Playwright loading the built `dist/` as an unpacked
  extension via a persistent browser context — the standard pattern for
  testing Chrome extensions; established in Phase 0, extended every phase.
- **Security**: a running test set (XSS, malicious SVG, malicious diagram
  source, network-call assertions) introduced starting Phase 1, not
  deferred to Phase 9 — Phase 9 re-runs the full accumulated set against
  the integrated product.
- **Fixture**: the bundled demo document (F46) is created in Phase 2-A and
  **extended by every subsequent phase** as it makes new content types real
  (Mermaid/KaTeX in 3-A, Graphviz/PlantUML in 3-B, annotation-friendly
  passages in 5, slide breaks in 6). Every phase's manual pass runs against
  it, so regressions surface against a single stable document rather than
  ad hoc scratch files. Phase 10 finalizes it and wires it into onboarding.
- **Manual**: the exact 18-step Chrome installation pass in
  `docs/specs/06-testing-quality-gate.md` §4, run partially per relevant
  phase and fully in Phase 9 and again in Phase 10.
- **Performance**: 1 MB/5 MB fixture documents, a 1,000-file synthetic
  folder tree, many-diagram documents, and a 50-annotation document —
  measured against budgets P1–P14 (`docs/specs/06-testing-quality-gate.md`
  §1a) incrementally per relevant phase (2-A, 2-B, 3-A, 4, 5, 8) and
  consolidated in Phase 9. Fixtures are committed so every re-measurement
  is the identical test.

## Security strategy

Security is continuous from Phase 1 onward, not deferred to a final phase
(per `docs/specs/04-security-privacy.md`'s explicit stance): DOMPurify
sanitization is mandatory on every HTML-producing path from the first
commit; every diagram/math renderer gets its own documented safe-config
decision (ADR-0002); every network-capable code path (PlantUML,
Phase 3-B) is off-by-default, disclosed, and isolated to its own module;
annotation and settings data never leave `chrome.storage.local`;
Phase 9 runs the full, accumulated security test set against the final
integrated product as a hard gate before Phase 10.

## Performance strategy

All performance work is measured against the **numbered budgets P1–P14 in
`docs/specs/06-testing-quality-gate.md` §1a** — no phase may close on
"feels fast". Lazy image loading and deferred/incremental diagram-math
rendering are established in Phases 2-A–3-A (P1/P2/P4/P5, not retrofitted
later); folder scanning and search are asynchronous and progressive from
their first implementation in Phase 4 (P7/P8 against a 1,000-file tree);
annotation re-anchoring is bounded and tested at P9 in Phase 5; live-apply
and language switching are held to P10/P11 in Phases 2-B and 8; Phase 9
re-runs the entire P1–P14 sweep as a hard gate, recording each measured
number against its budget.

## Documentation strategy

Each phase updates only the documentation directly touched by its own work
(no phase is asked to write comprehensive docs for features it didn't
build). `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`,
`DEVELOPMENT.md`, `TESTING.md`, `RELEASE.md`, `CHANGELOG.md` are finalized
in Phase 10, reflecting only actually-implemented, actually-verified
behavior — never aspirational claims written ahead of the code (per
`docs/specs/08-glossary-references.md` §6).

## Definition of Done (product-level)

*(Scope, 2026-09-28: "the product" here means **v1 = F01–F81, Phases 0–10**.
The post-v1 rows F82–F88 added by the checklist audit are explicitly outside
this Definition of Done — they do not retroactively make a shipped v1
incomplete. Each post-v1 phase carries its own exit criteria.)*

The product is done only when **every** v1 row in the "Feature-to-phase
mapping" table above is "Verified" (not merely "Implemented"), **and**
every line item in `docs/specs/06-testing-quality-gate.md` §5's quality
gate holds true, **and** Phase 10's Chrome Web Store preparation checklist
is fully complete, **and** `npm install && npm run build` produces a
loadable unpacked extension from a clean checkout. Anything short of that
is a documented, explicit known limitation — never silently reported as
"done."

## Recommended Claude Code session sequence

1. Phase 0 — Repository & Architecture Validation
2. Phase 1 — Foundation & Core Viewer
3. Phase 2-A — Markdown Pipeline & Content Rendering
4. Phase 2-B — Reading UI, Navigation & Settings
5. Phase 3-A — Math & Core Diagrams (KaTeX, Mermaid)
6. Phase 3-B — Extended Diagrams (Graphviz, PlantUML)
7. Phase 4 — File & Project Management
8. Phase 5 — Reading Productivity & Annotations
9. Phase 6 — Presentation & Mind Map
10. Phase 7-A — Export: HTML & Print/PDF
11. Phase 7-B — Export: DOCX
12. Phase 8 — Internationalization & RTL
13. Phase 9 — Complete QA, Security & Performance
14. Phase 10 — Production Polish & Release

Post-v1 (added 2026-09-28, after v1 shipped):

15. Phase 11 — Reading-Experience & Export-Fidelity Follow-ups
16. Phase 12 — User Custom CSS *(only once ADR-0009 is Accepted and its
    environment spike has passed)*

Each numbered step above is exactly one new Claude Code session, using that
phase's "Recommended session prompt" verbatim as the session's opening
instruction.
