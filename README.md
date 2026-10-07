# Markora

A privacy-first Google Chrome (Manifest V3) extension that detects and
renders Markdown — local files/folders, drag-and-drop, raw Git-host URLs,
and arbitrary Markdown/`.txt` on the web — as a rich document view: syntax
highlighting, Mermaid/Graphviz/PlantUML diagrams, KaTeX math, a navigable
table of contents, in-document search, annotations (highlight/underline/
comment), presentation and mind-map views, and multi-format export
(HTML/DOCX/print-to-PDF). Everything runs client-side; nothing is uploaded
anywhere by default — see `PRIVACY.md`.

This is the Phase 10 (Production Polish & Release) state of the project.
See `docs/plans/2026-09-08-markdownview-pro-implementation.md` for the full
phase-by-phase build history and `docs/specs/` for the product
specification this was built against.

## Install (unpacked, for now)

Markora is not yet published to the Chrome Web Store. To try it:

```
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → "Load
unpacked" → select the generated `dist/` folder. On first install, a
first-run tour opens automatically.

Local `.md` file access is off by default (Chrome's own restriction on
`file://` URLs for extensions); the popup's Setup tab and the onboarding
tour both explain how to turn it on if you want to open local files by
double-clicking them — it's never required, "Open file" works either way.

## Develop

```
npm run dev
```

## Test

```
npm run lint          # eslint + prettier --check
npm run test           # vitest unit tests
npm run test:e2e       # playwright end-to-end tests (needs `npm run build` first)
```

See `TESTING.md` for the full Phase 9 quality-gate report and
`docs/specs/06-testing-quality-gate.md` for what each check verifies.

## Documentation map

| Doc               | Covers                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `ARCHITECTURE.md` | How the codebase is actually structured, phase by phase               |
| `SECURITY.md`     | Sanitization pipeline, network-access boundaries, threat handling     |
| `PRIVACY.md`      | What stays local, the one disclosed exception (PlantUML), permissions |
| `DEVELOPMENT.md`  | Implementation findings, decisions, and gotchas per phase             |
| `TESTING.md`      | The filled-in Phase 9 quality-gate checklist                          |
| `CHANGELOG.md`    | Version history                                                       |
| `RELEASE.md`      | Chrome Web Store submission checklist and current release status      |
| `docs/specs/`     | The product specification (what to build, why)                        |
| `docs/adr/`       | Accepted architecture decisions                                       |
| `docs/plans/`     | The phase-by-phase implementation plan                                |

## Known limitations

See `RELEASE.md`'s "Known limitations" section for the current,
consolidated list (PlantUML's offline-rendering gap, DOCX math-fallback
boundary, machine-assisted translation quality, `file://`-flow
auto-refresh's weaker change-detection signal, FSAA permission-durability
caveat, mind-map RTL best-effort, the still-unaddressed large viewer entry
chunk, and the not-yet-live help/feedback/store links).

## License

Not yet finalized for distribution — see `RELEASE.md`. Third-party
open-source packages Markora depends on are listed with their own licenses
in Settings → About, generated from `src/assets/attributions.json`.
