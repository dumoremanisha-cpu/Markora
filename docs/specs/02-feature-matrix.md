# 02 — Feature Matrix

Flat traceability table for every feature in
[`01-functional-requirements.md`](./01-functional-requirements.md). Used later to
drive phase planning and the ship checklist in
[`06-testing-quality-gate.md`](./06-testing-quality-gate.md).

Legend:

| Symbol | Meaning |
|---|---|
| **R** | **Origin marker**: mandated by `projectDetails.md`. A `—` in this column means the row came from parity research rather than the brief — it does **not** mean the feature is optional. Every row in this table is in v1 scope; see the scope note below |
| **P** | Also a publicly-verified MarkView capability (parity target — capability only, see [`08-glossary-references.md`](./08-glossary-references.md)) |
| **Area** | Functional area grouping, matches section numbers in `01-functional-requirements.md` |

| ID | Feature | R | P | Area | Notes |
|----|---------|---|---|------|-------|
| F01 | Detect `.md`/`.markdown`/`.mdown`/`.mkd`/`.mdx`/Markdown `.txt` | ✓ | ✓ | 1 | Auto-render on navigation covers the Markdown suffixes + `llms.txt` only; other `.txt` via drag-drop/Open file/folder browser (ADR-0001 §2, `03 §5`) |
| F02 | Local `file://` Markdown viewing | ✓ | ✓ | 1 | Requires "Allow access to file URLs" UX |
| F03 | Raw GitHub/GitLab/Bitbucket/Gitea | ✓ | ✓ | 1 | |
| F04 | Arbitrary remote raw Markdown URLs | ✓ | ✓ | 1, 31 | Includes `llms.txt`. Suffix-less/content-type-only Markdown is **not** auto-rendered; it is reachable via the popup's user-initiated "Render this page as Markdown" action (`activeTab` + `scripting`) — `01 §31`, `03 §5` |
| F05 | Never hijack GitHub blob/GitBook/RTD | ✓ | — | 1 | **v1 scope: unconditional — no opt-in toggle ships** (descoped 2026-09-08: would need unjustified host permissions to replace already-rendered pages; see `03 §5`, ADR-0001 §3) |
| F06 | Drag-and-drop open | ✓ | ✓ | 1, 33 | |
| F07 | Open file/open folder from popup | ✓ | ✓ | 1, 31 | |
| F08 | GFM-quality render + sanitize | ✓ | ✓ | 2 | DOMPurify |
| F09 | Safe MDX handling (no JS exec) | ✓ | — | 3 | |
| F10 | Syntax highlight, large language set | ✓ | ✓ | 4 | Label, copy, wrap, line #s, themes |
| F11 | Mermaid diagrams + fullscreen/zoom/pan/download | ✓ | ✓ | 5 | |
| F12 | KaTeX inline + display math | ✓ | ✓ | 8 | |
| F13 | Graphviz/DOT | ✓ | ✓ | 7 | Confirmed via installed-extension card text (`UI/Screenshot 2026-09-08 095249.png`): "Mermaid/PlantUML/Graphviz diagrams" |
| F14 | PlantUML (opt-in network if needed) | ✓ | ✓ | 6 | Off by default; consent required |
| F15 | TOC + scroll spy | ✓ | ✓ | 9 | |
| F16 | Reading progress bar | ✓ | ✓ | 10 | |
| F17 | Word/char count + reading time | ✓ | ✓ | 11 | |
| F18 | Raw ↔ rendered toggle | ✓ | ✓ | 12 | |
| F19 | Folder browser | ✓ | ✓ | 13 | |
| F20 | Folder full-text search | ✓ | ✓ | 14 | |
| F21 | Folder bookmarks | ✓ | ✓ | 15 | |
| F22 | Recent documents | ✓ | ✓ | 16 | |
| F23 | Auto-refresh local files | ✓ | ✓ | 17 | Configurable interval preferred |
| F24 | Image lightbox gallery | ✓ | ✓ | 18 | |
| F25 | External link indicators/safe open | ✓ | ✓ | 19 | |
| F26 | Sticky table headers | ✓ | ✓ | 20 | |
| F27 | Annotations (highlight/underline/comment) | ✓ | ✓ | 21, 24 | Local only; **carries into HTML/print exports, best-effort into DOCX** (setting-gated, default on — `01 §21/§24`, ADR-0005) |
| F28 | Presentation mode | ✓ | ✓ | 22 | Themes, notes, autoplay |
| F29 | Mind map from headings + export | ✓ | ✓ | 23 | SVG/PNG/JPEG |
| F30 | Export HTML | ✓ | ✓ | 24 | Optional embedded TOC; includes annotations (F27) when enabled |
| F31 | Export DOCX | ✓ | ✓ | 24 | Includes annotations best-effort (shading/underline runs, native Word comments with endnote fallback) |
| F32 | Print/PDF | ✓ | ✓ | 24 | Print CSS; annotations render with a print-safe palette, comments as numbered endnotes |
| F33 | Diagram/mind-map image export | ✓ | ✓ | 24 | |
| F34 | Light/dark/system theme | ✓ | ✓ | 25 | |
| F35 | Typography & layout settings | ✓ | ✓ | 26 | Fonts, size, width, etc. |
| F36 | RTL support | ✓ | ✓ | 27 | |
| F37 | i18n (multi-language UI) | ✓ | ✓ | 28 | 19-language baseline |
| F38 | Accessibility baseline | ✓ | — | 29 | Continuous, cross-cutting |
| F39 | Keyboard shortcuts (+ customizable) | ✓ | ✓ | 30 | Help modal `Ctrl+/` |
| F40 | Extension popup | ✓ | ✓ | 31 | Lightweight only |
| F41 | Settings page + sections | ✓ | ✓ | 32 | |
| F42 | Settings import/export JSON | — | ✓ | 32 | Included for parity |
| F43 | Front matter display card | — | ✓ | 38 | Included for parity |
| F44 | GitHub-style alerts + localized titles | — | ✓ | 39 | Included for parity |
| F45 | First-run onboarding | ✓ | — | 37 | Not publicly documented for MarkView, but required by brief |
| F46 | Bundled demo Markdown | ✓ | — | 37 | |
| F47 | Privacy-first/no telemetry | ✓ | ✓ | — | Cross-cutting, see `04-security-privacy.md` |
| F48 | Toolbar (nav + modes + export) | ✓ | — | 34 | Original design |
| F49 | In-document search | ✓ | — | 35 | |
| F50 | Responsive layout | ✓ | — | 36 | |
| F51 | Right sidebar: outline + annotations tabs | ✓ | ✓ | 21 | Confirmed real (changelog v2.6.0: "Redesigned right sidebar: a new tabbed layout combining the outline and the annotations panel") — upgraded from "original layout guess" to confirmed parity |
| F52 | "What's new" panel shown once after update | ✓ | ✓ | 31 | Confirmed real (changelog v2.7.0: "In-Extension What's New") — upgraded from optional polish to required parity |
| F53 | Chromium browsers (Edge, Brave, Opera, Vivaldi) | ✓ | ✓ | — | Chrome primary; see `03-architecture.md` |
| F54 | Master extension enable/disable toggle | — | ✓ | 31 | Observed in popup Settings tab (`UI/Screenshot 2026-09-08 100258.png`) |
| F55 | Clear cache (maintenance action) | — | ✓ | 32 | Observed in popup Settings tab and options-page "Maintenance" section |
| F56 | Presentation style customization (bg/text/heading/accent color, font, background image + opacity, reset) | ✓ | ✓ | 22 | Observed in options page (`UI/Screenshot 2026-09-08 095843.png`); enriches F28 |
| F57 | Help & feedback links (feature request, report issue, rate extension) | — | ✓ | 31, 34 | Observed in viewer action menu (`UI/Screenshot 2026-09-08 100057.png`) |
| F58 | License/attribution panel + "License status: Free" placeholder | ✓ | ✓ | 31 | Observed as popup tab + "License Status" action-menu item; combines OSS attribution with a future-proofing placeholder — see the MarkView PRO scope decision below |
| F59 | Recent documents grouped by source type, remote entries captured only for address-bar-entered URLs | ✓ | ✓ | 16 | Observed in popup Recent Documents tab (`UI/Screenshot 2026-09-08 100240.png`); refines F22 — also a permission-minimization technique, see `07-permissions-compliance.md` |
| F60 | Unicode-safe heading anchors + URL-fragment deep-linking on load | ✓ | ✓ | 9 | Changelog v2.8.0 ("coming soon"): "Working Anchor Links for Non-English Headings"; v1.1.0: "URL Fragment Support" |
| F62 | Reading-progress celebration effect, off by default | — | ✓ | 10 | Changelog v2.3.0/v2.5.0 |
| F63 | Folder exclusion list for directory scanning | ✓ | ✓ | 13 | Changelog v2.3.0: "Folder Exclusion" |
| F64 | Folder file-type filter + active-file highlighting | ✓ | ✓ | 13 | Changelog v2.1.0 (filter), v1.8.0 (active-file highlight) |
| F65 | Progressive folder scanning with cancel action | ✓ | ✓ | 13, 14 | Changelog v1.9.7-8: "Progressive folder scanning" + "Scan cancellation" |
| F67 | Custom containers (info/warning/danger/details/spoiler) | ✓ | ✓ | 2 | Changelog v2.1.0 "Redesigned Callout Blocks"; HTML-export blog post lists container types explicitly |
| F68 | Graceful fallback for extended doc-component syntax (e.g. Mintlify tabs/callouts) | ✓ | ✓ | 2 | Changelog v2.1.0: "Mintlify Components" |
| F69 | Per-feature Markdown plugin toggles (tables, footnotes, task lists, containers, typographer, line breaks, etc.) | ✓ | ✓ | 2, 32 | Changelog v1.0.5 "Plugin Configuration Modal"; v1.9.0-6 "Quick Settings Modal: Expose Line Breaks and Typographer" |
| F70 | Multiple selectable syntax-highlight themes (~14) | ✓ | ✓ | 4 | Changelog v1.2.0: "Syntax Highlighting Theme Selector: 14 curated themes" |
| F71 | CJK-aware word/character counting | ✓ | ✓ | 11 | Changelog v1.2.0: "CJK Language Support for Word Count" |
| F72 | External-link icon only on text links (not images) + optional hover preview | ✓ (icon rule); privacy-modified (preview) | ✓ | 19 | Changelog v1.2.0 (icon rule), v1.0.4 (preview cards) — preview implementation intentionally constrained, see §19 and `04-security-privacy.md` |
| F73 | Drag-to-resize sidebars | — | ✓ | 26 | Changelog v1.0.5: "Drag-to-Resize Sidebars" |
| F74 | Auto-refresh pauses when tab/document not focused | — | ✓ | 17 | Changelog v1.0.5: "Smart Auto-Refresh Coordination" |
| F75 | Recent documents: domain grouping + duplicate detection | ✓ | ✓ | 16 | Changelog v1.0.4 "Enhanced Recent Documents", v2.5.0 "smarter duplicate detection" |
| F76 | Presentation mode: 3 slide-splitting strategies + extended keyboard set + scroll indicator | ✓ | ✓ | 22 | `getmarkview.com/blog/markdown-presentation-mode` |
| F78 | Unified in-app notification/toast system (4 types) | — | ✓ | 40 | Changelog v1.3.0: "Unified Notification System ... 4 notification types" |
| F79 | Alternative `:::mermaid` container-delimiter compatibility | — | ✓ | 5 | Changelog v2.1.0: "Non-Standard Mermaid Delimiters" |
| F80 | Persisted File System Access folder permission (no re-prompt) | ✓ | ✓ | 13 | Changelog v1.0.4: "Persistent File System Permissions" |
| F81 | Live-apply of appearance/language settings (no reload) | — | ✓ | 26 | Changelog v1.0.4: "Real-time UI Updates" |
| F82 | Back-to-top control | — | — | 9, 34 | **Phase 11.** Control that returns the reader to the document top: appears only past a scroll threshold, keyboard-reachable, RTL-aware placement, honours `prefers-reduced-motion` (instant jump instead of smooth scroll), suppressed in presentation/mind-map/print. Origin: 2026-09-28 audit (see §"Post-v1 additions" below) |
| F83 | Zen / distraction-free reading mode | — | — | 26, 36 | **Phase 11.** Toggle that hides app chrome (toolbar, sidebars, reading progress, stats pill) leaving only the rendered document; entered/exited by the same shortcut and by `Esc`; a persisted layout setting that live-applies like the rest of F35/F81. Composes with, and does not duplicate, F28 presentation mode. Origin: 2026-09-28 audit |
| F84 | Copy rendered content to clipboard as rich HTML | — | — | 24 | **Phase 11.** `navigator.clipboard.write` + `ClipboardItem` carrying both `text/html` and a `text/plain` fallback, serialized from the already-DOMPurify-sanitized rendered DOM via the ADR-0005 HTML-export pipeline. Supersedes the raw-Markdown-only clipboard action recorded as deferred in `docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md` Phase 13 "Remaining Issues". No new manifest permission (user-gesture clipboard write). Origin: 2026-09-28 audit |
| F85 | Diagram-preserving DOCX export | — | — | 24 | **Phase 11.** Closes the F31 gap where Mermaid/Graphviz blocks degrade to plain code-text paragraphs: rasterize the already-rendered diagram SVG to PNG in the viewer page and embed it, mirroring ADR-0005's tier-2 KaTeX→PNG math path. The existing code-text paragraph stays as the fallback when no rendered SVG exists (render error, PlantUML opt-in off). Origin: 2026-09-28 audit |
| F86 | Additional reading surfaces (sepia/paper) beyond light/dark/system | — | — | 25 | **Phase 11.** Additive reading-surface variants layered on the existing F34 light/dark/system setting and its design tokens. Note: a **high-contrast readability** mode already ships as an orthogonal toggle (popup Quick Controls, `Settings.highContrast`) — this feature must extend that, never introduce a second competing high-contrast path. Origin: 2026-09-28 audit |
| F87 | User custom CSS | — | — | 26, 32 | **Phase 12 — blocked until [ADR-0009](../adr/0009-user-custom-css-sanitization.md) is Accepted.** User-authored CSS applied to the rendered document via a constructed stylesheet, with a sanitization gate (no `@import`, `url()` restricted to `data:`/same-document fragments) — see ADR-0009 and [`04-security-privacy.md`](./04-security-privacy.md) §3. Off by default, empty by default, always disable-able. Origin: 2026-09-28 audit |
| F88 | Self-hosted Gitea raw Markdown as a curated source | — | — | 1 | **Not scheduled** — design note only, see [`07-permissions-compliance.md`](./07-permissions-compliance.md) §2 amendment 4. Self-hosted Gitea has no fixed domain, so it cannot be statically enumerated alongside GitHub/GitLab/Bitbucket (ADR-0001 §2); the only permission-compliant path is `optional_host_permissions` requested per instance at time of use. Already covered in the common case by generic Markdown-suffix detection (F01/F04). Origin: 2026-09-28 audit |

*IDs F61, F66, F77 are intentionally unused (merged into adjacent rows during drafting — no gap in coverage, just in numbering).*

## Notes on parity marks vs. the earlier draft

The prior draft (`referenece/2026-09-08-feature-matrix.md`) marked several rows as
parity (P) based on assumption. This version corrects those against the **verified**
fetch of getmarkview.com and its Chrome Web Store listing on 2026-09-08:

- F25 (external link indicators) and F26 (sticky table headers) **are** confirmed
  public MarkView capabilities (external link indicators/previews; sticky headers
  implied by "large table" handling) — upgraded from unconfirmed to P.
- F45/F46 (onboarding, bundled demo) are not documented in MarkView's public
  materials — kept as required-only (R), not parity (P).

## Correction — Graphviz (F13)

An earlier pass of this matrix marked F13 (Graphviz/DOT) as **not** publicly
advertised by MarkView, based only on the website/store-listing text, which
doesn't mention it explicitly. A screenshot of the actual installed extension's
management card (`UI/Screenshot 2026-09-08 095249.png`) shows the real
description text: *"Read, present & export markdown - Mermaid/PlantUML/Graphviz
diagrams, folder browser, RTL, mind map, math & ..."* — Graphviz **is** an
advertised capability. F13 is now marked P as well as R.

## F60–F81 audit (2026-09-08 deep review)

Rows F60–F81 above were added after a full crawl of getmarkview.com's sitemap
(homepage, `/whats-new` full version history back to v1.0.0, `/support` FAQ,
`/privacy-policy`, `/refund-policy`, `/terms`, and three feature-specific blog
posts) plus the Chrome Web Store listing. Full source-by-source detail is in
[`08-glossary-references.md`](./08-glossary-references.md) §5.

**Scope note (corrected 2026-09-08).** An earlier version of this paragraph
said "all F60–F81 rows are marked **R**", which contradicted the six rows
that carry `—` in the R column (F62, F73, F74, F78, F79, F81). The R column
records *where a requirement came from* (the brief vs. parity research), not
whether it ships. **Every row in this matrix is in v1 scope and is assigned
an implementation phase** — per the user's direction that all
reference-product capabilities be included, not a minimum-viable subset. The
only descoped item is the F05 opt-in override, which is called out explicitly
in its own row.

## ⚠️ Scope conflict found — "MarkView PRO" paid tier (needs a decision)

`getmarkview.com/refund-policy` explicitly references **"MarkView PRO"**,
**"lifetime licenses,"** and a checkout system powered by **Polar.sh**, with a
30-day refund window and license deactivation reverting the user to a "FREE"
tier. This directly implies MarkView has a paid/licensed tier layered on top
of the free extension.

This was **not** found anywhere else (not on the homepage, not in `/terms`,
not in the Chrome Web Store listing, not in the changelog) — `/terms` explicitly
states there is no tiered/freemium distinction, and `/pricing` returns 404. It's
possible this is a very recent, soft-launched, or partially-rolled-back
monetization experiment, and/or that no shipped feature is actually gated
behind it (the FAQ still says *"MarkView is free to use with all core features
included"*).

**This is not folded into the feature matrix as a requirement.** Building a
payment/checkout/license-activation system would require:

1. A backend or third-party payment processor integration — directly
   contradicting `projectDetails.md` §4 ("no backend, no cloud infrastructure")
   and this project's independence/privacy stance.
2. Reverse-engineering which specific features (if any) are PRO-gated, which
   isn't observable from any of the fetched pages.

**Decision (confirmed by the user, 2026-09-08):** ship v1 as 100% free — every
feature in this spec set remains available to all users, and **no payment,
checkout, or license-activation logic is built in v1.** However, the product
should be architected so a future paid tier doesn't require a rework:

- A **"License status" placeholder** is added to the popup and settings UI
  (see F58 below and
  [`01-functional-requirements.md`](./01-functional-requirements.md) §31),
  always showing "Free" in v1 — a real UI element, not a stub comment, but
  backed by no license-check logic.
- The settings schema in `chrome.storage.local` reserves a `licenseStatus`-
  shaped field (e.g. `{ tier: "free" }`) so a future version could extend it
  without a storage migration — see
  [`03-architecture.md`](./03-architecture.md) §1.
- No payment processor, license-key validation, or feature-gating code is
  written now. If/when a paid tier is greenlit later, it's a new, separate
  scope of work (backend or third-party billing integration, feature-gating
  design, updated privacy disclosures) — not something to half-build
  speculatively today.

## Additions from installed-extension UI screenshots (2026-09-08)

Six screenshots of the real MarkView extension's popup, options page, and
in-viewer action menu (`UI/` folder) surfaced concrete UI/behavior details not
visible on the marketing site or store listing text. These added rows F54–F59
above; full detail and screenshot-by-screenshot notes are in
[`08-glossary-references.md`](./08-glossary-references.md) §4.

## Post-v1 additions — F82–F88 (2026-09-28 checklist audit)

Rows F82–F88 were added after auditing the user-maintained `featureslist.md`
(125 items) against the shipped v1 code, this spec set and the ADRs. They
carry `—` in **both** R and P: they originate from that audit, not from
`projectDetails.md` and not from the verified MarkView parity research behind
F60–F81 — the legend's two existing origin markers don't cover a third
origin, so the origin is stated per row in Notes instead.

**Scope qualification.** The "every row in this table is in v1 scope"
paragraph above applies to **F01–F81**, which is what Phases 0–10 delivered.
F82–F88 are explicitly **post-v1 follow-ups**, scheduled (or deliberately not
scheduled) in the implementation plan's post-v1 phases — see
[`../plans/2026-09-08-markdownview-pro-implementation.md`](../plans/2026-09-08-markdownview-pro-implementation.md)
Phases 11–12. Adding them does not retroactively re-open v1 scope.

| Audit item | Outcome |
|---|---|
| #43 back-to-top, #48 zen mode, #92 rich clipboard copy, #98 diagram-preserving DOCX, #116 reading themes | New rows F82–F86, Phase 11 |
| #117 custom CSS | New row F87, Phase 12, gated on ADR-0009 |
| #111 Gitea raw Markdown | New row F88, design note only — not scheduled |
| #96 "PDF export" marked Partial | **No new row — resolved by design**, see below |

### Clarification: "PDF export" is print-to-PDF by decision, not by omission (F32)

The audit marked #96 (PDF export) *Partial* on the grounds that there is no
direct PDF encoder and PDF output is produced by the browser's print-to-PDF
path — the same mechanism as #97 (print-optimized PDF). That is the
**specified and decided behaviour**, not a shortfall:

- [`01-functional-requirements.md`](./01-functional-requirements.md) §24
  defines the PDF row as **"PDF (via browser print)"** — there is no
  requirement anywhere in the spec set for a bundled PDF encoder.
- [`03-architecture.md`](./03-architecture.md) §1 locks the stack with "no
  PDF-rendering library needed — browser print covers it".
- [`../adr/0005-export-architecture.md`](../adr/0005-export-architecture.md)
  considered and **explicitly rejected** "PDF generation via a client-side PDF
  library instead of browser print" as an unrequested scope change.

F32 therefore already covers both #96 and #97, and stays a single row. Any
future proposal to bundle a PDF encoder (for pixel-exact page control or
headless export) would reverse an accepted ADR decision and would need its
own ADR plus a bundle-size/fidelity justification — it is not planned work.

## Out of scope for v1

- Backend, cloud sync, accounts.
- AI features that transmit document content off-device.
- Cloning MarkView UI, assets, or store-listing identity.
- Non-Chromium browsers (Firefox, Safari) — not precluded architecturally, just
  not a v1 target.
