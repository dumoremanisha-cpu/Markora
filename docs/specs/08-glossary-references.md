# 08 — Glossary & Reference Material

## 1. Glossary

| Term | Meaning in this project |
|---|---|
| **Viewer** | The extension page that renders a Markdown document (not the popup) |
| **Raw Markdown URL** | A URL that serves Markdown as its literal content, not an HTML page that renders Markdown (e.g. `raw.githubusercontent.com/...` vs. `github.com/.../blob/...`) |
| **Auto-render** | Content the extension renders without any explicit user action beyond navigating/opening it |
| **Opt-in render** | Content the extension only renders after an explicit settings toggle. **No such toggle ships in v1** — the GitHub-blob/GitBook/RTD override was descoped on 2026-09-08 (`03-architecture.md` §5, ADR-0001 §3); the term is retained for the network-feature opt-ins (PlantUML, link previews) and any future revisit |
| **Parity target** | A publicly observable capability of MarkView used to size this product's feature set — never a source of code/design to copy |
| **Local-only** | Data that is read/written exclusively via `chrome.storage.local` or in-memory, never transmitted |
| **GFM** | GitHub-Flavored Markdown |

## 2. Source documents in this repository

- `referenece/projectDetails.md` — the authoritative 60-section build brief.
  Every spec in `docs/specs/` traces back to a section of this file.
- `referenece/reference.md` — two URLs identifying the public parity target
  (see §3 below for what was verified from them).
- `referenece/2026-09-08-markdownview-pro-product-spec.md` and
  `2026-09-08-feature-matrix.md` — an earlier draft spec pass. Content has been
  carried forward, reorganized, and corrected against verified live data in the
  `docs/specs/` set; treat `docs/specs/` as current and this draft as historical.

## 3. Verified public capability snapshot — getmarkview.com & Chrome Web Store

Fetched and verified on 2026-09-08 from the two URLs in `referenece/reference.md`.
Recorded here **strictly as a capability-parity reference** — none of this text,
copy, or imagery is to be reproduced; it exists so feature-matrix "P" (parity)
marks in [`02-feature-matrix.md`](./02-feature-matrix.md) are grounded in fact
rather than assumption.

### getmarkview.com — advertised capabilities
- Instant rendering of `.md` files.
- Syntax highlighting, "180+ programming languages," GitHub-inspired themes.
- Mermaid diagrams: flowcharts, sequence diagrams, Gantt charts (as the
  headline examples).
- KaTeX-based LaTeX math rendering.
- Smart TOC: auto-generated, scroll spy, smooth scrolling.
- File browser: local Markdown navigation with search/filter.
- Image viewer: fullscreen lightbox, gallery navigation, lazy loading.
- Auto-refresh live preview.
- Interface in 15 languages (auto-detect or manual selection) — note: the store
  listing (below) lists 19; treat 19 as the more complete/current figure.
- Customization: dark/light theme, 9 fonts with adjustable sizing, line-height
  adjustment, layout preferences.
- Keyboard shortcuts: `Ctrl+Shift+D` theme, `Ctrl+Shift+L` TOC,
  `Ctrl+Shift+B` file browser.
  - Parity note (not part of the verified snapshot): Markora's own theme-toggle
    default is `Alt+Shift+D`, not `Ctrl+Shift+D` — Chrome reserves
    `Ctrl+Shift+D` for "Bookmark all tabs" and silently leaves an extension's
    `suggested_key` for it unassigned. See
    [`01-functional-requirements.md`](./01-functional-requirements.md) §30 (F39)
    for Markora's authoritative shortcut defaults; the combos listed above are
    recorded only as observed MarkView behaviour.
- Platforms: Chrome, Edge, Brave, Opera, Vivaldi (via Chrome Web Store),
  other Chromium browsers.
- Sources: local `.md`, GitHub raw, GitLab, Bitbucket.
- Free, no signup, local-only processing claimed.

### Chrome Web Store listing — advertised capabilities
- Diagrams: Mermaid and PlantUML, with interactive fullscreen zoom/pan. (This
  listing's own text did not call out Graphviz explicitly — that gap was
  closed by the installed-extension screenshot review in §4 below, which
  confirms Graphviz is an advertised capability via the extension's actual
  management-card description.)
- KaTeX inline + display math.
- Syntax highlighting with one-click copy buttons.
- Smart TOC with smooth scrolling.
- Folder browser (whole project structures), folder bookmarks, full-text
  search in folder.
- Live auto-refresh (external-editor workflow).
- Recent documents tracking from the popup.
- Export: DOCX (formatting preserved), HTML (formatting preserved), print to
  PDF (clean layout, no UI chrome).
- Presentation mode: slides, themes, speaker notes, touch navigation, autoplay.
- Mind map view: interactive, downloadable as SVG/PNG/JPEG.
- Annotations: highlight/underline/comment, persist, appear in print/exports.
- Stats: word count, character count, reading time, reading-progress bar.
- Raw/rendered view toggle.
- Sticky table headers.
- RTL: full support, automatic per-paragraph direction detection, manual
  override, carries into print/HTML/Word/mind-map exports.
- 19-language interface (exact list): Deutsch, English, Indonesia, Nederlands,
  Tiếng Việt, español, français, italiano, polski, português (Brasil), русский,
  Hebrew, Urdu, Arabic, Farsi, Simplified Chinese, Traditional Chinese,
  Japanese, Korean.
- Sources: `file://` (opt-in), GitHub/GitLab/Bitbucket/Gitea raw, `.txt` as
  Markdown, `.md`/`.markdown`/`.mkd`/`.mdx` extensions.
- External link indicators (visual previews/icons).
- Version at time of fetch: 3.0.1; size 3.6 MiB; 20,000+ users; 5.0 rating
  (83 ratings) — recorded only as market context, not a target to imitate.
- Permissions it requests: `storage`, `activeTab`, `downloads`, file URLs
  (disabled by default), host permissions for GitHub/GitLab/doc sites.
- Privacy claims: zero data collection, no analytics/tracking, local
  processing only, no cloud services; PlantUML server is optional/off by
  default/consent-gated. Libraries cited: markdown-it, highlight.js, KaTeX,
  Mermaid.
- Stated use cases: developers previewing README/CHANGELOG/API docs,
  technical writers using live preview, students reading notes with math and
  diagrams, data scientists reviewing Jupyter markdown, AI developers reading
  `llms.txt`, content creators previewing documentation drafts.

### How this was used

- Confirms the 19-language i18n baseline adopted in
  [`05-ux-i18n-accessibility.md`](./05-ux-i18n-accessibility.md) §5.
- Confirms the permission set anticipated in
  [`07-permissions-compliance.md`](./07-permissions-compliance.md) §2 is
  reasonable and not over-scoped relative to a shipped comparable product.
- Confirms the use-case list matches the "Users and primary jobs" table in
  [`00-overview.md`](./00-overview.md) §5.
- Corrected an unverified parity assumption in the prior draft matrix regarding
  Graphviz (see [`02-feature-matrix.md`](./02-feature-matrix.md) notes) — since
  further corrected again in §4 below once Graphviz was confirmed advertised.

## 4. Verified from installed-extension UI screenshots (2026-09-08)

The user added six screenshots of the real, installed MarkView extension in
the `UI/` folder, plus one screenshot of its Chrome extension-management card
in `referenece/`. These show actual product UI (not just marketing copy), so
they're a stronger source than the website/store text for exact capability and
behavior details. Reviewed and cross-checked against every spec in this
folder; gaps found were folded into
[`01-functional-requirements.md`](./01-functional-requirements.md) and
[`02-feature-matrix.md`](./02-feature-matrix.md) as F54–F59.

| Screenshot | What it shows | What it confirmed/added |
|---|---|---|
| `referenece/Screenshot 2026-09-08 095249.png` | Extension management card | Real description text: *"Read, present & export markdown - Mermaid/PlantUML/Graphviz diagrams, folder browser, RTL, mind map, math & ..."* — **confirms Graphviz is advertised** (corrects the earlier draft's "not advertised" note); version 3.0.1 matches the store listing. |
| `UI/Screenshot 2026-09-08 095203.png` | Popup, "Setup Required" tab | File-URL-access onboarding: numbered steps to `chrome://extensions` → Details → "Allow access to file URLs" → refresh, with an "Open Extension Settings" button. Confirms F02's permission UX; popup is tabbed (Setup Required / Recent Documents / Settings, plus a License tab seen elsewhere). |
| `UI/Screenshot 2026-09-08 095843.png` | Options page, Presentation settings | Concrete style controls: Background/Text/Heading/Accent color, slide Font, Background Image URL, Image Opacity slider, "Reset Presentation Settings". Also shows the options-page left nav grouping: General, Appearance, Plugins, Shortcuts / Features: Presentation, PlantUML / Management: Maintenance, Import-Export. → F56; folded into §22 and §32 of the functional spec. |
| `UI/Screenshot 2026-09-08 095914.png` | Viewer, folder sidebar + outline panel | "Browse Markdown Files" sidebar with "Select Folder"/"Close Sidebar" and a "folder will be remembered" note — confirms folder browsing lives in the viewer, not the popup. Floating stats pill ("3,076 words • 22,788 characters • 16 mins read") confirms F17's presentation style. |
| `UI/Screenshot 2026-09-08 100057.png` | Viewer, expanded action menu | Grid of actions: Export to HTML/Word, Print (Save PDF), Presentation Mode, Search in Folder, Mind Map, View Raw Data, Open Settings, Keyboard Shortcuts, **Feature Request, Report Issue, Rate Extension, License Status, About MarkView** — the last four/five are new: help/feedback links and an attribution panel. → F57, F58. |
| `UI/Screenshot 2026-09-08 100240.png` | Popup, "Recent Documents" tab | Search box; note *"Only URLs pasted in the browser address bar are saved here"*; Refresh/Clear All; entries grouped under a collapsible "Local Files" header. → F59; refines F22 and informs the permission-minimization approach in [`07-permissions-compliance.md`](./07-permissions-compliance.md). |
| `UI/Screenshot 2026-09-08 100258.png` | Popup, "Settings" tab | "Extension Enabled" master toggle, a "Language" dropdown defaulting to **Auto**, "Open Settings" (deep link to full options), and "Clear Cache". → F54, F55, and the "Auto" locale option added to §28. |

**Note on the "License" tab / "License Status" item:** at the time of this
screenshot review, treated as an open-source attribution/compliance panel
rather than a paid-tier gate. §5 below found evidence of an actual
**"MarkView PRO"** paid/licensed tier elsewhere on the site (the refund
policy page) — see the scope-conflict note in
[`02-feature-matrix.md`](./02-feature-matrix.md). The popup's "License" tab
may in fact be where a PRO license key would be entered/shown, which would
make this a real licensing UI, not just OSS attribution. Either way, per the
decision recorded in `02-feature-matrix.md`, this product ships as 100% free
with no license/paid-tier mechanism — this UI element is not replicated.

## 5. Deep-dive site & changelog audit (2026-09-08)

Per the user's request to "checked all features from reference site and
extension" beyond the homepage, the full `getmarkview.com` sitemap was
crawled: `/`, `/whats-new`, `/support`, `/privacy-policy`, `/refund-policy`,
`/terms`, and the blog posts `markdown-to-html`, `markdown-to-word`,
`markdown-to-pdf`, `markdown-presentation-mode`, and `best-markdown-viewers`.
`/pricing` was checked and does not exist (404).

### `/whats-new` — full version history (v1.0.0 → v2.8.0 "coming soon")

The changelog is the single richest source found — every dated feature since
initial release. It surfaced the large majority of F60–F81 in
[`02-feature-matrix.md`](./02-feature-matrix.md): Graphviz + PDF/HTML export
TOC (v2.8.0), PlantUML + configurable auto-refresh interval + in-extension
"What's New" (v2.7.0), annotations + redesigned right sidebar (v2.6.0), custom
shortcuts + presentation theme customization + front matter + localized
alerts + settings import/export + celebration-effect toggle (v2.5.0), mind map
(v2.4.0), folder exclusion (v2.3.0), `.txt` rendering + sidebar file-type
filter + non-standard Mermaid delimiters + Mintlify components (v2.1.0),
progressive/cancellable folder scanning (v1.9.7-8), 15-language baseline
(v1.9.0-6), presentation mode's original release (v1.3.0) with a unified
4-type notification system, syntax-highlight theme selector + CJK word
counting + smart external-link icons (v1.2.0), folder bookmarks + external
link hover previews + persistent File System Access permissions (v1.0.4), and
the plugin-configuration modal + drag-to-resize sidebars (v1.0.5). Full detail
folded into [`01-functional-requirements.md`](./01-functional-requirements.md).

**Resolves the earlier 15-vs-19-language discrepancy:** the changelog shows
15 languages were reached at v1.9.0-6, confirming 15 was correct at that
point in the product's history. The Chrome Web Store listing (fetched live,
§3 above) shows 19 — the four RTL languages (Hebrew, Urdu, Arabic, Farsi) were
evidently added in a later release than the changelog excerpt captured. **19
is the current, correct baseline** and is what
[`05-ux-i18n-accessibility.md`](./05-ux-i18n-accessibility.md) already uses.

**One item deliberately not adopted:** v1.0.6 "Uninstall Feedback: Collect
user feedback when uninstalling." This is excluded by design — see
[`01-functional-requirements.md`](./01-functional-requirements.md) §40 — to
keep this product's zero-data-collection privacy guarantee absolute. This is
an intentional divergence from the parity target, not an oversight.

### `/support` (FAQ)

Confirmed technical specifics used to sharpen several requirements: auto-refresh
polls local files "every 2 seconds" for a changed modified-timestamp (§17);
font range 12–24px, line-height 1.0–2.5, width 600–1200px (§26); exact FAQ
wording that GitHub *blob* pages are unsupported by design, only *raw* URLs
work (already correctly scoped in §1/§5 of the architecture doc); privacy
answer confirms zero data collection including "no files, URLs, analytics, or
device data."

### `/privacy-policy`

Confirms the permission table in
[`07-permissions-compliance.md`](./07-permissions-compliance.md) (storage,
activeTab, downloads, file URLs, host permissions) matches a real shipped
product's actual justification wording. Also confirms Google Fonts CDN is
used only when a non-default font is selected — worth carrying into our own
privacy doc as a disclosed exception if we take the same approach for web
fonts (currently unspecified in our architecture; using only locally-bundled
fonts avoids even this minor disclosure and is the stricter option).

### `/refund-policy` and `/terms` — the MarkView PRO discovery

See the flagged scope conflict in
[`02-feature-matrix.md`](./02-feature-matrix.md): `/refund-policy` names
"MarkView PRO," "lifetime licenses," and a Polar.sh-powered checkout with a
30-day no-questions-asked refund; `/terms` (fetched the same day) describes no
tiered features at all. Decision recorded there: ship as 100% free, no
license/paid-tier mechanism, pending the user's explicit call.

### Blog posts

- `markdown-to-html`: confirmed base64 image embedding (5 MB cap), fully
  inlined CSS, "40-60%" file-size reduction via CSS filtering, print-optimized
  styles included, free (no PRO gate mentioned) — folded into §24.
- `markdown-to-word`: confirmed the three-tier math strategy (native OMML →
  high-res PNG fallback → italic LaTeX text fallback), AST-based conversion,
  five-stage progress reporting — folded into §24. Did not state whether this
  feature is PRO-gated (only the PDF and HTML posts explicitly said "free").
- `markdown-to-pdf`: confirmed free/no-subscription/no-watermark, A4 page
  setup with ~2.5cm/2cm margins, forced-load of lazy images before printing —
  folded into §24.
- `markdown-presentation-mode`: confirmed the three slide-splitting strategies
  (`---`, H1, H2) with a ≥3-heading auto-detection heuristic, and the full
  extended keyboard set (Home/End, 1–9, F/F11, `?`, `P` for autoplay at a 5s
  default interval) — folded into §22.
- `best-markdown-viewers`: general marketing summary; nothing new beyond what
  the other sources already covered.

## 6. Build & deliverables reference (for later phases, not specs)

Recorded here for completeness since it's part of the original brief, though it
belongs to planning/execution rather than specification:

- Scripts required: `npm install`, `npm run dev`, `npm run build`,
  `npm run test`, `npm run lint`.
- Final deliverables: full source, production build, `dist/` package, README,
  architecture/security/privacy docs, test suite + report, feature matrix
  status, known limitations, permissions list with justification, Chrome Web
  Store preparation checklist.
- A final implementation report should be structured as: IMPLEMENTED / TESTED /
  KNOWN LIMITATIONS / PERMISSIONS / SECURITY / PERFORMANCE / BUILD / NEXT
  RECOMMENDATIONS — never claiming a feature complete unless it was actually
  implemented and verified against [`06-testing-quality-gate.md`](./06-testing-quality-gate.md).
