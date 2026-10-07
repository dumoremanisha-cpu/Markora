# MarkdownView Pro — Product Design Spec

**Date:** 2026-09-08  
**Status:** Draft — awaiting user review  
**Sources:** `projectDetails.md`, public MarkView feature surface ([getmarkview.com](https://getmarkview.com/), Chrome Web Store listing)  
**Brand decision:** Independent product. Feature parity with modern Markdown viewers. **Do not** clone MarkView branding, logos, copy, screenshots, assets, or exact UI.

---

## 1. Product summary

**Working name:** MarkdownView Pro (rename-ready: name, logo, colors, strings must be centralized).

**One-line goal:** A privacy-first Chrome Extension (Manifest V3) that detects Markdown content (local + remote raw) and renders a polished reading, navigation, diagram, math, annotation, presentation, and export experience entirely in-browser.

**Success criteria:**

- Opening `.md` / `.markdown` / `.mdown` / `.mkd` / `.mdx` / Markdown-containing `.txt` / raw Markdown URLs yields a reliable rendered viewer.
- Feature set matches `projectDetails.md` (sections 5–49) at production quality.
- Local-only by default; no analytics/telemetry; optional network features require explicit consent.
- Original UI/brand; comparable capability and polish to category leaders, not a visual clone.
- Builds with `npm install && npm run build`; loads as unpacked extension; passes quality gate in §16.

---

## 2. Non-goals / independence rules

| Allowed | Forbidden |
|---------|-----------|
| Match publicly observable capabilities | Copy MarkView (or any) source, CRX internals, proprietary assets |
| Similar toolbar *actions* (TOC, theme, export, etc.) | Copy exact layout, icons, logo, website marketing copy |
| Use OSS libs under compatible licenses | Impersonate another product in store listing or UI |
| Original “MarkdownView Pro” branding | Clone screenshots, color tokens, or proprietary CSS |

---

## 3. Users and primary jobs

| User | Job |
|------|-----|
| Developers | Read READMEs, specs, GitHub/GitLab raw docs with TOC, code highlight, diagrams |
| Writers / students | Comfortable reading, themes, stats, annotations, presentation |
| Doc maintainers | Folder browse, search, auto-refresh while editing in an external editor |

---

## 4. Tech stack (locked)

| Layer | Choice |
|-------|--------|
| Extension | Chrome Manifest V3 |
| Language | TypeScript |
| Bundler | Vite (or equivalent modern bundler) |
| UI | Modern HTML/CSS; **no** React/Next/backend/DB/cloud by default |
| Markdown | markdown-it (or equivalent) + GitHub-flavored extensions |
| Highlight | highlight.js (or equivalent); 180+ languages preferred |
| Math | KaTeX |
| Diagrams | Mermaid; Graphviz/DOT (client-side); PlantUML (opt-in if network) |
| Sanitize | DOMPurify |
| Export | Standalone HTML; DOCX library; print CSS → PDF |
| Storage | `chrome.storage.local` only for settings, recents, bookmarks, annotations |

**Constraint:** Prefer lightweight browser-native architecture. All Markdown processing local by default.

---

## 5. Architecture

### 5.1 High-level components

```text
src/
├── background/          # service worker: messaging, open-file, permissions helpers
├── content/             # detect Markdown pages; inject or redirect to viewer
├── viewer/              # main document viewer page
│   ├── markdown/        # parse + render pipeline
│   ├── syntax/
│   ├── mermaid/
│   ├── math/
│   ├── diagrams/        # graphviz, plantuml adapters
│   └── sanitization/
├── components/          # toc, toolbar, sidebar, browser, lightbox, annotations, presentation, mindmap
├── export/              # html, docx, print
├── settings/            # options page + settings modal
├── popup/               # lightweight extension popup
├── i18n/
├── storage/
├── utils/
└── styles/              # design tokens, themes, print CSS
```

### 5.2 Data flow

1. **Detection:** content script / webNavigation / `file://` handlers identify candidate Markdown.
2. **Load:** fetch or read text → pass to viewer (never upload).
3. **Pipeline:** parse → sanitize → enhance (highlight, math, diagrams) → mount DOM.
4. **Chrome UI chrome:** TOC / toolbar / sidebars bind to rendered DOM (scroll spy, search).
5. **Persist:** settings, recents, bookmarks, annotations → `chrome.storage.local`.

### 5.3 Detection policy

**Auto-render:**

- Local files with Markdown extensions
- Raw GitHub / GitLab / Bitbucket / Gitea raw URLs
- Arbitrary sites serving raw Markdown / `.txt` that is Markdown
- Drag-drop / “Open file” / “Open folder”

**Do not auto-replace** (unless user explicitly enables):

- GitHub repo / blob HTML pages
- GitBook, ReadTheDocs, and similar already-rendered docs sites

### 5.4 Permissions principle

Minimum permissions. Every permission documented with justification before shipping. Prefer optional host permissions / user gestures over broad `*://*/*` where possible.

---

## 6. Brand & visual design (original)

### 6.1 Brand

- Product name: **MarkdownView Pro** (working)
- All user-facing strings via i18n keys (never hardcode English-only)
- Logo/colors: define CSS variables under `styles/tokens`; swappable later

### 6.2 Design principles

- Clean, minimal, modern developer tool
- Excellent typography; subtle borders; restrained shadows; strong spacing
- First-class light **and** dark modes (+ system)
- Toolbar: useful actions without clutter; sticky/compact on scroll
- Responsive: sidebars collapse to drawers on narrow viewports

### 6.3 Theme modes

`light` | `dark` | `system` — apply consistently to Markdown, code, Mermaid, KaTeX, TOC, chrome UI, presentation, mind map.

### 6.4 Typography & layout settings

Configurable: font family, font size, line height, content width, code font, heading scale, sidebar widths, TOC/browser visibility, progress bar, stats, code wrap, sticky tables.

---

## 7. Feature requirements

Requirements below are **must-have** unless marked optional. Parity notes reference publicly advertised MarkView capabilities for capability targeting only.

### 7.1 Markdown rendering

Support: headings, paragraphs, bold/italic/strikethrough, inline code, fenced blocks, ordered/unordered/nested lists, task lists, blockquotes, tables, links, images, HR, safe HTML, footnotes, anchors, definition lists where supported, automatic heading IDs, GitHub-style Markdown + common extensions.

Malformed Markdown must not crash the viewer.

### 7.2 MDX

Safe rendering only. Never execute document JS/JSX. Priority: (1) safe, (2) useful Markdown output, (3) graceful fallback for unsupported MDX.

### 7.3 Syntax highlighting

Large language set (min. languages listed in `projectDetails.md` §7). Features: language detection/label, copy button, line wrap option, readable typography, dark/light syntax themes, optional line numbers.

### 7.4 Mermaid

Inline render for common diagram types; useful errors; fullscreen; zoom/pan/reset; download; document must not break on failure. No arbitrary JS from Markdown.

### 7.5 PlantUML

Configurable. Network rendering **OFF by default**; explicit opt-in + disclosure if content may leave the device. Prefer local/client-side if feasible. Graceful degrade if unavailable.

### 7.6 Graphviz / DOT

Safe inline render; fullscreen; zoom/pan; export/download where possible.

### 7.7 Math (KaTeX)

Inline `$...$` and display `$$...$$`; complex notation where KaTeX allows; theme + print/export compatible; clear errors.

### 7.8 Table of contents

Auto from H1–H6: collapsible sidebar, active highlight, scroll spy, smooth scroll, nested hierarchy, mobile drawer, toggle shortcut.

### 7.9 Reading progress

Position + percent; smooth update; user toggle.

### 7.10 Document stats

Word count, character count, estimated reading time — local; shown in info panel.

### 7.11 Raw / rendered toggle

Instant switch; configurable shortcut.

### 7.12 File browser

Select folder (File System Access API where available); browse dirs; list Markdown; open; search/filter/sort; no upload.

### 7.13 Folder search

Filename + content; case-insensitive; highlight; path display; quick open; async/efficient.

### 7.14 Folder bookmarks

Add/remove/rename/open; local storage.

### 7.15 Recent documents

Filename, path/source, last opened; reopen/remove/clear; local only.

### 7.16 Auto-refresh

Detect local file changes where APIs allow; reload; preserve scroll + settings; configurable (incl. interval if practical).

### 7.17 Image viewer

Lightbox: enlarge, fullscreen, zoom/pan, gallery next/prev, counter, close, keyboard, lazy load; graceful broken images; relative paths when permissions allow.

### 7.18 External links

External indicator; safe target behavior; optional confirm for suspicious URLs.

### 7.19 Sticky table headers

Keep header visible; horizontal scroll; responsive; no distortion.

### 7.20 Annotations

Highlight, underline, comments; view/edit/delete; persist locally keyed by document identity + selection + location + type + timestamp. Never rewrite source Markdown unless user explicitly exports/applies.

### 7.21 Presentation mode

Headings/sections → slides; next/prev; keyboard (arrows, PageUp/Down, Space, Esc); fullscreen; progress/counter; touch; optional autoplay; themes; speaker notes where practical; exit to document view.

### 7.22 Mind map mode

Heading hierarchy → interactive mind map; zoom/pan; collapse/expand; fullscreen; export SVG/PNG/JPEG where practical.

### 7.23 Export

| Format | Requirements |
|--------|----------------|
| HTML | Standalone; typography, tables, code+highlight, images where possible, Mermaid, KaTeX, basic styling; optional TOC |
| DOCX | Headings, paragraphs, lists, tables, code, images, basic formatting; math/diagrams best-effort |
| PDF | Print CSS; hide chrome; page breaks; margins; preserve code/diagrams/math |
| Images | Diagrams/mind maps → SVG/PNG/JPEG |

### 7.24 RTL

Auto-detect where practical + manual override; correct alignment for text, lists, tables, code, TOC, presentation, print, mind map. Do not force whole doc RTL for a single RTL paragraph.

### 7.25 Internationalization

i18n architecture from day one. Target languages listed in `projectDetails.md` §32. Easy to add locales.

### 7.26 Accessibility

Keyboard nav, focus states, ARIA, semantic HTML, screen readers, contrast, `prefers-reduced-motion`, scalable type, accessible dialogs/menus. No mouse-only critical paths.

### 7.27 Keyboard shortcuts

Defaults (configurable where Chrome allows):

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Shift+D | Toggle theme |
| Ctrl/Cmd+Shift+L | Toggle TOC |
| Ctrl/Cmd+Shift+B | Toggle file browser |
| Ctrl/Cmd+F | Search document |
| Esc | Close fullscreen/dialog |
| Arrows | Prev/next slide or image |

Avoid clobbering critical browser shortcuts. Shortcut help modal recommended (e.g. Ctrl+/).

### 7.28 Popup

Lightweight: Open Markdown file, Open folder, Recent documents, Bookmarked folders, Theme, Settings, Help/About. Not the full app.

### 7.29 Settings page / modal

Sections: Appearance, Markdown, Navigation, Diagrams, Files, Export, Language, Privacy. Persist via `chrome.storage.local`. Settings import/export JSON is in-scope (parity with modern viewers).

### 7.30 Drag and drop

Drop zone for supported extensions.

### 7.31 Toolbar

Actions: back, forward, TOC, file browser, search, raw/rendered, theme, presentation, mind map, annotations, export, settings. Sticky/compact on scroll.

### 7.32 In-document search

Query, match count, next/prev, highlights, keyboard nav, optional case sensitivity; operates on rendered content.

### 7.33 First-run / demo

Onboarding: welcome → privacy → file permission → sample Markdown → Mermaid → math → shortcuts → finish. No account. Bundled demo document covering major features.

### 7.34 Front matter (parity)

YAML front matter (title, author, date, etc.) displayed in a clean info card at document top when present.

### 7.35 GitHub-style alerts (parity)

NOTE / TIP / WARNING / etc. with localized titles (setting to enable/disable localization).

### 7.36 Custom shortcuts & presentation themes (parity)

User-recordable shortcuts; presentation background color/image/opacity customization.

---

## 8. Privacy

By default:

- Content stays in the browser
- No upload of Markdown to a backend
- No analytics, telemetry, tracking, or PII collection
- No sending document contents to third-party AI
- Settings, recents, annotations: local only

Any network feature (e.g. PlantUML server): clear disclosure + explicit opt-in.

---

## 9. Security

Treat all Markdown as untrusted:

- DOMPurify / equivalent sanitization
- Safe URL handling; block `javascript:` etc.
- No script execution from documents
- Safe Mermaid / SVG handling
- CSP appropriate for extension pages
- Secure iframe strategy if used
- MDX never executes

---

## 10. Performance

Remain usable for large READMEs / long docs:

- Lazy images
- Incremental / deferred diagram & math work where useful
- Debounced search
- Async folder scan
- Efficient DOM updates; avoid full re-render on minor setting changes
- Target tests: ~1 MB and ~5 MB Markdown, hundreds of headings, many code blocks/images

---

## 11. Error handling

Never blank-screen on failure. Human-readable errors + recovery for: invalid Markdown/Mermaid/PlantUML/Graphviz/LaTeX, unsupported MDX, inaccessible file, missing image, export failure, permission denied.

---

## 12. Browser compatibility

Primary: Google Chrome. Also target Chromium: Edge, Brave, Opera, Vivaldi. Avoid Chrome-only APIs unless necessary and documented.

---

## 13. Build & repo deliverables

**Scripts:** `npm install`, `npm run dev`, `npm run build`, `npm run test`, `npm run lint`

**Docs to ship with product (later, from this spec):** README, ARCHITECTURE, SECURITY, PRIVACY, DEVELOPMENT, TESTING, RELEASE, CHANGELOG.

**Final deliverables:** source, `dist` package, tests, feature matrix status, known limitations, permissions list, Web Store checklist.

---

## 14. Implementation phases (summary)

Detailed tasks live in `docs/plans/2026-09-08-markdownview-pro-implementation.md`.

1. Foundation — MV3, Vite, TS, storage, basic viewer, parse, sanitize, local files  
2. Rendering — highlight, tables, images, TOC, search, themes, responsive  
3. Diagrams & math — Mermaid, KaTeX, Graphviz, PlantUML  
4. File management — browser, search, bookmarks, recents, auto-refresh  
5. Productivity — annotations, progress, stats, raw mode, lightbox  
6. Advanced modes — presentation, mind map  
7. Export — HTML, DOCX, print/PDF, diagram/mind-map images  
8. i18n & RTL  
9. QA — functional, security, performance, a11y, compatibility  
10. Production polish — Web Store readiness  

---

## 15. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| File System Access / `file://` permission friction | Clear first-run instructions; degrade gracefully |
| PlantUML without local engine | Opt-in remote only; offline fallback message |
| Large Mermaid/Graphviz blocking UI | Async render + timeout + error UI |
| XSS via Markdown/HTML/SVG | Sanitize + CSP + security tests |
| Scope creep vs store review | Phase gate; permission justification doc |
| Branding drift toward competitor | Design tokens + independence checklist in PR review |

---

## 16. Quality gate (ship checklist)

Do not call complete unless all true: no TS/build errors; no console errors in normal use; no broken UI; no obvious XSS; minimal permissions; Markdown/Mermaid/KaTeX/Graphviz/PlantUML-or-fallback; highlight; TOC; search; folder browser; auto-refresh; annotations; presentation; mind map; HTML/DOCX/print; lightbox; RTL; i18n architecture; themes; a11y basics; large docs usable.

---

## 17. Open decisions (for reviewer)

Resolved:

- [x] Independent brand (not a MarkView visual clone)
- [x] Working name MarkdownView Pro
- [x] Spec + plan first; implement only after approval

Still open (defaults applied if you skip):

1. **PlantUML:** prefer try local WASM/client first, else opt-in server — confirm?  
2. **Graphviz:** use `@hpcc-js/wasm` / similar client-side — confirm?  
3. **DOCX library:** `docx` npm package — confirm?  
4. **Store listing:** Chrome first only for v1, Edge later — confirm?

---

## 18. Review ask

Please review this spec and the companion feature matrix + implementation plan. Reply with:

- **Approve** — proceed to implementation (or refine plan first)  
- **Changes** — list edits  
- **Defer** — hold  

No code will be written until you say so.
