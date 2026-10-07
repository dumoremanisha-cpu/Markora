# Changelog

All notable changes to Markora are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); dates are the session date
the phase closed, not a calendar release cadence.

## [1.0.0] — 2026-09-14

First feature-complete release — every phase in
`docs/plans/2026-09-08-markdownview-pro-implementation.md` (Phases 0–10)
implemented and verified against `docs/specs/06-testing-quality-gate.md`.

### Added

- Local Markdown rendering: local files/folders, drag-and-drop, raw
  Git-host URLs, and arbitrary Markdown/`.txt` on the web, entirely
  client-side.
- Syntax-highlighted code, ~14 selectable highlight themes, GitHub-style
  alerts, custom containers, front matter, footnotes, task lists,
  definition lists, safe MDX degradation.
- Mermaid and Graphviz diagrams (fully offline) and an opt-in, disclosed
  PlantUML renderer.
- KaTeX math (inline and display).
- Table of contents, in-document search, reading progress, document
  statistics, sticky table headers, external-link indicators.
- Local file/folder browsing with bookmarks, recents, and auto-refresh.
- Annotations: highlight, underline, and comment, with re-anchoring across
  reloads and a visible "orphaned" state when text no longer matches.
- Presentation mode and an interactive mind-map view.
- Export to standalone HTML, Word (.docx), and print/PDF, including
  annotations.
- 19 interface languages with RTL support for Arabic, Persian, Urdu, and
  Hebrew.
- First-run onboarding tour; a "What's New" panel shown once per update;
  settings import/export; help/feedback links; an open-source attribution
  list and "License status: Free" indicator.
- A master enable/disable toggle, and a "Block remote images" privacy
  setting.

### Security & privacy

- Every path that turns document content into HTML passes through
  DOMPurify before touching the DOM.
- No telemetry, no analytics, no crash reporting, no
  `chrome.runtime.setUninstallURL`.
- `chrome.storage.local` only, never `.sync`.
- The only network request the product ever makes for rendering purposes
  is the opt-in, off-by-default PlantUML diagram-source request.

### Known limitations

See `RELEASE.md`'s "Known limitations" section for the current,
consolidated list.
