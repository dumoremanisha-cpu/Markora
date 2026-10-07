# Manual verification checklist

Everything here needs a human with an interactive Chrome/Edge session and
a real browser profile — none of it is automatable by design (mostly
because Chrome exposes the relevant surface only as a manual, per-profile
setting with no launch flag or extension API). Everything else in
`docs/specs/06-testing-quality-gate.md` §4's 18-step pass already has
automated coverage and does not need to be re-run by hand; this file is
only the gap list. Run through this whenever you have a spare 15–20
minutes with an interactive browser; check off/annotate as you go and
fold any findings back into `TESTING.md`'s Known limitations.

## 1. The `file://` access flow (F02) — irreducibly manual

This is the one item on this whole list where Chrome genuinely gives no
other way in: the "Allow access to file URLs" toggle only exists as a
per-extension switch on `chrome://extensions`, with no launch flag and no
`chrome.*` API to set it, so Playwright cannot drive this path at all
(the detection *predicate* is unit-tested instead).

1. `npm run build`.
2. Load `dist/` unpacked at `chrome://extensions` (Developer Mode on).
3. **Flow A**: On the extension's details page, enable "Allow access to
   file URLs". Open a local `.md` file by double-clicking it or typing
   its `file://` path into the address bar. Confirm: detection fires,
   the content-script → viewer handoff happens, the document renders.
4. **Flow B**: Turn the toggle back **off**. Use "Open file" from the
   popup or the viewer's empty state. Confirm the same document renders
   — proving Flow B needs no file-URL permission at all.
5. With the toggle off, confirm a direct `file://.../doc.md` navigation
   does *not* auto-render (no permission granted, no silent bypass).

## 2. Screen-reader spot-check (F38)

Automated axe scans (see `TESTING.md`) catch structural/contrast issues
but not experiential ones. With NVDA (Windows) or VoiceOver (Mac):

1. Open a document with headings, a table, a code block, and an image.
   Navigate by heading (NVDA: `H`; VoiceOver: rotor) and confirm the
   hierarchy reads sensibly.
2. Open the TOC and the annotations panel; confirm each announces itself
   (name, role) and that moving between its items is coherent.
3. Open Settings; tab through a few controls and confirm labels are
   read, not just visually adjacent text.
4. Trigger a toast (e.g. load a document) and confirm it's announced
   without needing focus (an `aria-live` region, not silent).
5. Open the mind map and presentation mode; confirm focus lands
   somewhere sensible on open (the close button) and that closing
   returns focus to the control that opened it.

## 3. RTL locale + language-switch walkthrough (F36, quality-gate §4 step 14)

Unit/e2e coverage exercises the mechanics (per-block `dir="auto"`, the
live language-switch budget, RTL CSS rules) but not a lived-in pass:

1. In Settings, switch the UI language to Arabic or Hebrew. Confirm the
   chrome (toolbar, TOC, settings labels) flips to RTL and stays legible.
2. Open a document that mixes English and Arabic/Hebrew paragraphs.
   Confirm each paragraph's direction is detected independently — the
   whole document must not flip from one RTL paragraph.
3. Confirm code blocks stay LTR even inside an RTL document.
4. Try the manual direction override (per-document and in Settings) and
   confirm it visibly overrides the per-block auto-detection.
5. Switch back to "Auto" and confirm it resolves correctly for your
   actual OS/browser locale.

## 4. A real Word processor open (F31)

The DOCX export test suite validates the generated XML directly
(headings, formatting, tables, images, math, comments, hyperlinks) but
never opens the file in an actual word processor:

1. Export a document exercising most content types (headings, lists, a
   table, code, an image, inline math, a footnote, an annotation
   comment) to DOCX.
2. Open it in Microsoft Word (or LibreOffice Writer/Google Docs as a
   second check). Confirm: no repair-file prompt, formatting looks
   right, the image is embedded and visible, math renders (native OMML
   where supported, the documented rasterized/plain-text fallback
   otherwise), the comment appears as a real reviewable comment.

## 5. Physical-device responsive sweep (F50)

The automated sweep (`e2e/phase2b.spec.ts`) checks for horizontal
overflow at four emulated viewport widths. A real device adds touch
interaction and real font rendering emulation can't fully replicate:

1. On an actual phone and tablet (or Chrome DevTools' device toolbar at
   minimum, if no physical device is available), open the extension's
   popup and a document.
2. Confirm the TOC drawer's touch-to-open/close works, sidebars don't
   clip content, and the toolbar remains usable.
3. **Specifically check the finding recorded in `TESTING.md`**: the TOC
   drawer is open by default and covers the toolbar entirely at narrow
   widths. Decide whether this is the intended pattern or should change,
   and record that decision.

## 6. Cross-browser: Brave, Opera, Vivaldi (F53)

Chrome and Edge were verified this session (Edge via an automated
`channel: 'msedge'` smoke test). Brave/Opera/Vivaldi were not installed
on the development machine and were left untested by explicit choice —
see `TESTING.md`'s Known limitations for the reasoning. If/when
verifying:

1. Load `dist/` unpacked in each browser's own extensions page.
2. Confirm the popup renders and a dropped document renders cleanly,
   with zero console errors — the same bar the Edge smoke test used.
