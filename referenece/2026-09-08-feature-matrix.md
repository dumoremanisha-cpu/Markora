# MarkdownView Pro — Feature Matrix

**Date:** 2026-09-08  
**Status:** Draft — awaiting user review  
**Spec:** [2026-09-08-markdownview-pro-product-spec.md](./2026-09-08-markdownview-pro-product-spec.md)

Legend:

| Symbol | Meaning |
|--------|---------|
| R | Required for v1 (from `projectDetails.md`) |
| P | Public capability parity target (MarkView marketing / changelog — capability only, not UI clone) |
| Phase | Implementation phase from plan |

| ID | Feature | R | P | Phase | Notes |
|----|---------|---|---|-------|-------|
| F01 | Detect `.md` / `.markdown` / `.mdown` / `.mkd` / `.mdx` / Markdown `.txt` | ✓ | ✓ | 1 | |
| F02 | Local `file://` Markdown viewing | ✓ | ✓ | 1 | Needs “Allow access to file URLs” UX |
| F03 | Raw GitHub / GitLab / Bitbucket / Gitea | ✓ | ✓ | 1 | |
| F04 | Arbitrary remote raw Markdown URLs | ✓ | ✓ | 1 | |
| F05 | Do not hijack GitHub blob / GitBook / RTD by default | ✓ | — | 1 | Opt-in later if needed |
| F06 | Drag-and-drop open | ✓ | ✓ | 1 | |
| F07 | Open file / open folder from popup | ✓ | ✓ | 1 / 4 | |
| F08 | Markdown-it GFM-quality render + sanitize | ✓ | ✓ | 1 | DOMPurify |
| F09 | Safe MDX handling (no JS exec) | ✓ | — | 1–2 | |
| F10 | Syntax highlight 180+ langs | ✓ | ✓ | 2 | Label, copy, wrap, line #s, themes |
| F11 | Mermaid diagrams + fullscreen/zoom/pan/download | ✓ | ✓ | 3 | |
| F12 | KaTeX inline + display math | ✓ | ✓ | 3 | |
| F13 | Graphviz/DOT | ✓ | P* | 3 | *MarkView lists as coming soon; we still require |
| F14 | PlantUML (opt-in network if needed) | ✓ | P* | 3 | Off by default; consent |
| F15 | TOC + scroll spy | ✓ | ✓ | 2 | |
| F16 | Reading progress bar | ✓ | — | 5 | |
| F17 | Word/char count + reading time | ✓ | ✓ | 5 | |
| F18 | Raw ↔ rendered toggle | ✓ | ✓ | 5 | |
| F19 | Folder browser | ✓ | ✓ | 4 | |
| F20 | Folder full-text search | ✓ | ✓ | 4 | |
| F21 | Folder bookmarks | ✓ | — | 4 | |
| F22 | Recent documents | ✓ | ✓ | 4 | |
| F23 | Auto-refresh local files | ✓ | ✓ | 4 | Configurable interval preferred |
| F24 | Image lightbox gallery | ✓ | ✓ | 5 | |
| F25 | External link indicators / safe open | ✓ | — | 2 | |
| F26 | Sticky table headers | ✓ | — | 2 | |
| F27 | Annotations (highlight/underline/comment) | ✓ | ✓ | 5 | Local only |
| F28 | Presentation mode | ✓ | ✓ | 6 | Themes / bg customization |
| F29 | Mind map from headings + export | ✓ | ✓ | 6 | SVG/PNG/JPEG |
| F30 | Export HTML | ✓ | ✓ | 7 | Optional TOC in export |
| F31 | Export DOCX | ✓ | ✓ | 7 | |
| F32 | Print / PDF | ✓ | ✓ | 7 | Print CSS |
| F33 | Diagram/mind-map image export | ✓ | ✓ | 7 | |
| F34 | Light / dark / system theme | ✓ | ✓ | 2 | |
| F35 | Typography & layout settings | ✓ | ✓ | 2 | Fonts, size, width, etc. |
| F36 | RTL support | ✓ | — | 8 | |
| F37 | i18n (multi-language UI) | ✓ | ✓ | 8 | Architecture from phase 1 stubs |
| F38 | Accessibility baseline | ✓ | — | 2–9 | Continuous |
| F39 | Keyboard shortcuts (+ customizable) | ✓ | ✓ | 2 / 5 | Help modal Ctrl+/ |
| F40 | Extension popup | ✓ | ✓ | 1 | Lightweight |
| F41 | Settings page/modal + sections | ✓ | ✓ | 2 | |
| F42 | Settings import/export JSON | — | ✓ | 5 | Include for parity |
| F43 | Front matter display card | — | ✓ | 2 | Include for parity |
| F44 | GitHub-style alerts + localized titles | — | ✓ | 2 | Include for parity |
| F45 | First-run onboarding | ✓ | ✓ | 1 | |
| F46 | Bundled demo Markdown | ✓ | ✓ | 1 | |
| F47 | Privacy-first / no telemetry | ✓ | ✓ | 1 | |
| F48 | Toolbar (nav + modes + export) | ✓ | ✓ | 2 | Original design |
| F49 | In-document search | ✓ | ✓ | 2 | |
| F50 | Responsive layout | ✓ | — | 2 | |
| F51 | Right sidebar outline + annotations tabs | — | ✓ | 5 | Original layout, same capability |
| F52 | What's New after update | — | ✓ | 10 | Optional polish |
| F53 | Chromium browsers (Edge etc.) | ✓ | ✓ | 9 | Chrome primary |

---

## Capability vs brand

| Dimension | Target |
|-----------|--------|
| Features (this matrix) | Match / exceed `projectDetails.md`; align with public competitor capabilities |
| Buttons / actions | Same *jobs* (TOC, theme, export, presentation…) — original labels via i18n |
| Visual design | Original MarkdownView Pro design system |
| Marketing text / logo | Original only |

---

## Out of scope for v1

- Backend / cloud sync / accounts  
- AI features that send document content off-device  
- Cloning MarkView UI, assets, or store listing identity  
- Non-Chromium browsers (Firefox/Safari) unless later decided  
