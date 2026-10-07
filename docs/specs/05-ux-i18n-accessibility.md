# 05 — UX, Visual Design, i18n, RTL & Accessibility

Source: `projectDetails.md` §28–34, §46–48.

## 1. Brand

- Product name: **Markora**. Architecture must keep name, logo, and color
  tokens easily swappable later (all via i18n keys and CSS variables — never
  hardcoded), in case of a future rebrand.
- Original visual identity only — see the independence rules in
  [`00-overview.md`](./00-overview.md) §3.

## 2. Design principles

- Clean, minimal, modern developer-tool aesthetic.
- Excellent typography as the centerpiece — this is a reading-focused product.
- Subtle borders, restrained shadows, a strong/consistent spacing system.
- First-class light **and** dark modes, not a dark mode bolted onto a
  light-first design.
- Toolbar surfaces useful actions without clutter; becomes compact/sticky on
  scroll.
- Responsive: sidebars collapse to drawers on narrow viewports; typography and
  diagrams/tables stay usable (via horizontal scroll rather than clipping).

## 3. Theming

Three modes: `light`, `dark`, `system`. Must apply consistently across:
Markdown content, code blocks/syntax highlighting, Mermaid, KaTeX, TOC, all
chrome UI (toolbar, sidebars, popup, settings), presentation mode, and mind map.
Persisted via `chrome.storage.local`.

## 4. Typography & layout settings

User-configurable: font family (~9 high-quality options, bundled with the
extension rather than loaded from a CDN — see
[`04-security-privacy.md`](./04-security-privacy.md) for why), font size
(12–24px), line height (1.0–2.5), content width (600–1200px) with a
centered-vs-full-width toggle, code font, heading scale, sidebar width(s)
(numeric setting and drag-to-resize), TOC visibility, file-browser visibility,
progress-bar visibility, stats visibility, code line-wrap, sticky-table
toggle. All persisted; changes (including language and font) apply live
without a full reload. A "Reset to defaults" action is available.

## 5. Internationalization (i18n)

- All user-facing strings go through an i18n key/catalog system from the first
  line of UI code — no hardcoded English strings anywhere in the UI layer.
  Architecture, key convention, "Auto" resolution, live switching and the
  lint rule that enforces this are decided in
  [`../adr/0007-i18n-architecture.md`](../adr/0007-i18n-architecture.md)
  (hybrid `_locales` + bundled runtime catalog; system lands in Phase 1, the
  remaining 18 locales in Phase 8).
- Baseline locale set (19 languages, matching the verified public parity target
  — see [`08-glossary-references.md`](./08-glossary-references.md)): English,
  Spanish, French, German, Italian, Portuguese (Brazil), Dutch, Polish, Russian,
  Chinese (Simplified), Chinese (Traditional), Japanese, Korean, Vietnamese,
  Indonesian, Arabic, Persian, Urdu, Hebrew.
- Adding a new locale should require only adding a new translation catalog file,
  not touching component code.
- Interface language is user-selectable in Settings → Language, independent of
  the browser's own locale (though it should default sensibly from it). An
  explicit **"Auto"** option (follow browser/system locale) sits alongside the
  named languages, exposed in both the popup quick-settings and the full
  options page.

## 6. RTL support

- Automatic per-block/per-paragraph direction detection where practical
  (Arabic, Hebrew, Persian, Urdu), with a manual override in settings and
  per-document.
- Must render correctly under RTL: text alignment, list markers/indentation,
  table structure, code blocks (code itself stays LTR even in an RTL document —
  code is not a "script" in the RTL sense), TOC, presentation mode, print/export
  output, and mind-map layout where practical.
- **Never** force the whole document to RTL because one paragraph is in an RTL
  script — direction is a block-level property, applied surgically.

## 7. Accessibility

- Full keyboard navigability — no feature may require a mouse.
- Visible focus states on every interactive element.
- ARIA labels/roles on custom widgets (toolbar buttons, TOC tree, dialogs,
  lightbox, presentation controls).
- Semantic HTML wherever native elements exist for the job (`<nav>`, `<dialog>`,
  `<button>`, heading hierarchy, etc.).
- Screen-reader-compatible structure and labeling.
- Sufficient color contrast in both light and dark themes (WCAG AA as the bar).
- Respect `prefers-reduced-motion` (disable/reduce animation for users who
  request it).
- Scalable typography — text must remain usable at browser zoom levels users
  actually use.
- Accessible dialogs/menus: focus trapping while open, `Esc` to close, restored
  focus on close, labeled controls.

## 8. Keyboard shortcuts

Defaults (see [`01-functional-requirements.md`](./01-functional-requirements.md)
§30 for the full table): theme toggle, TOC toggle, file-browser toggle,
in-document search, `Esc` to close overlays, arrow keys for slide/image
navigation. Must not clobber critical browser shortcuts. A shortcut help modal
(`Ctrl+/`) and user-recordable custom shortcuts are both required.

## 9. First-run experience

On first install: Welcome → explain local/private processing → explain the
local-file-access permission and how to grant it → open a bundled sample
document → show a live Mermaid example → show a live math example → show the
keyboard-shortcut reference → Finish. No account creation, no sign-in, ever.

## 10. Responsive behavior

Desktop, laptop, smaller browser windows, and tablet-sized layouts must all
remain usable: sidebars collapse to drawers, TOC becomes a drawer, the toolbar
simplifies to its most essential actions, typography stays readable, and
diagrams/tables degrade to horizontal scroll rather than being clipped or
breaking layout.
