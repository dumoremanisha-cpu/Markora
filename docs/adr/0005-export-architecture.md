# ADR-0005: Export Architecture (HTML, DOCX, Print/PDF, Image)

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §24; `docs/specs/03-architecture.md` §1; feature matrix F30–F33

## Context

Export must produce faithful, self-contained output in three fundamentally
different target formats, each with its own technical constraints described
at the requirement level in the spec but not at the pipeline/library level.

## Decision

### HTML export (F30) — reuses the live rendered DOM

- Pipeline: take the already-rendered, already-sanitized viewer DOM for the
  current document → serialize to a standalone HTML string → inline all CSS
  → embed images as base64 data URLs (cap ~5 MB per image; beyond the cap,
  link out to the original source instead of embedding, per spec) → write
  file via a native `<a download>` (no `downloads` permission needed for
  this path, consistent with `07-permissions-compliance.md`'s
  preference).
- **CSS inlining is tree-shaken to used styles**: extract only the CSS rules
  that actually match elements present in the exported document (headings,
  code blocks, tables, callouts, whichever diagram/math output is present),
  not the entire application stylesheet — implemented as a small
  rule-matching pass over the serialized DOM, not a full-blown CSS purifier
  dependency.
- Respects the current code line-wrap and light/dark choice at export time
  (a snapshot, not a live-updating export).
- Mermaid/Graphviz output is already inline SVG in the DOM by export time —
  no re-render needed for export, just serialization.

### Print/PDF export (F32) — CSS-only, no library

- A dedicated `print.css` stylesheet (loaded only in print media) hides app
  chrome (toolbar, sidebars, floating stats pill), sets A4 page size with
  ~2.5 cm top/bottom and ~2 cm side margins, and defines explicit page-break
  rules (`break-inside: avoid` on code blocks/tables/diagrams where
  possible).
- Before invoking `window.print()`, force-load any lazy-loaded images
  (walk the DOM, resolve every deferred `<img>`'s real `src` synchronously)
  — required because `window.print()` does not wait for lazy-loaded content.
- No PDF-generation library — relies entirely on the browser's native
  print-to-PDF, per the locked stack decision in `03-architecture.md` §1.

### DOCX export (F31) — custom AST-to-OOXML pipeline, not a converter

**Finding: there is no off-the-shelf HTML/Markdown → DOCX converter that
meets this spec's fidelity bar** (headings, inline formatting, code blocks
with syntax highlighting preserved as formatting, tables with alignment,
lists including task lists, footnotes, images, and tiered math). The `docx`
npm package (per `03-architecture.md` §1) is a **document builder** —
it provides an API to construct OOXML documents programmatically; it does
not parse HTML or Markdown itself.

Decision: implement a **dedicated AST-to-OOXML mapping module**
(`src/export/docx/`) that walks the same markdown-it token stream used for
rendering (not the DOM) and emits `docx` package API calls directly —
avoids a lossy DOM→OOXML round-trip and reuses the parse step already run
for the main render.

**Math (tiered, per spec)**:
1. Attempt to convert simple LaTeX constructs directly to Word's native
   OMML equation XML (stays editable in Word) — covers common inline/basic
   display math.
2. For constructs too complex to map to OMML reliably, fall back to a
   high-resolution (~2x scale) rasterized image of the KaTeX-rendered
   output, embedded as a DOCX image.
3. Last resort: render the original LaTeX source as italic text.

**Images**: must support local file, `http(s)`, `data:`, and `blob:` sources
— all fetched/decoded and embedded into the DOCX package at export time.

**Progress reporting**: DOCX conversion is a multi-second operation for
large documents; the export UI shows real, staged progress (parsing →
conversion → image processing → file generation → download) via the
project's unified notification/progress component, not an indefinite
spinner.

### Annotation rendering in exports (added 2026-09-08)

A verified parity capability ("annotations appear in print/exports",
`docs/specs/08-glossary-references.md` §3) was missing from the requirement
set when this ADR was written. It is now specified in
`docs/specs/01-functional-requirements.md` §21/§24 and fits the pipelines
above without changing any decision here:

- **HTML and print** reuse the rendered DOM, which already carries the
  annotation markup the viewer applies — so the work is a print/export
  stylesheet concern (print-safe highlight palette, comment markers rendered
  as numbered endnotes instead of hover UI), not a new pipeline.
- **DOCX** does need mapper work, since it walks the token stream rather than
  the DOM: annotation ranges are resolved to token/character offsets via the
  same anchoring data ADR-0003 stores, then emitted as shading/underline runs
  and, where the builder supports it, native Word comments — falling back to
  numbered endnotes rather than dropping a comment.
- Both are governed by the "Include annotations in exports" setting
  (default on); orphaned annotations are never exported.

### Diagram/mind-map image export (F33)

- Mermaid/Graphviz: since output is already SVG in the DOM, SVG export is a
  direct serialization; PNG export rasterizes the SVG via an offscreen
  `<canvas>` at a fixed export scale.
- Mind map: same SVG→PNG path; JPEG export additionally flattens
  transparency to a solid background before canvas encoding (JPEG has no
  alpha channel).

## Consequences

- HTML export (7-A) and print export (7-A) share the DOM-reuse pipeline and
  are correctly grouped in one phase; DOCX (7-B) shares nothing with them
  (different input — token stream, not DOM; different output — OOXML, not
  HTML/CSS) and is correctly its own phase.
- The DOCX module is one of the largest single pieces of custom logic in
  the entire product — sizing it as its own phase (7-B) rather than folding
  it into a general "Export" phase avoids a session that silently runs out
  of budget partway through the hardest sub-problem.
- Math-to-OMML conversion coverage will necessarily be partial (tier 1 only
  covers "simple enough" constructs) — Phase 7-B's exit criteria must define
  a concrete, testable set of LaTeX constructs that must hit tier 1, rather
  than leaving "simple enough" undefined.

## Alternatives considered

- **Render to HTML first, then convert HTML→DOCX** (via an HTML-aware DOCX
  library or a headless-browser + conversion service): rejected — no
  reliable pure-client-side HTML→DOCX library meets the fidelity bar either,
  and a headless-browser/service approach would violate the no-backend,
  local-only architecture constraint.
- **PDF generation via a client-side PDF library instead of browser print**:
  rejected — the spec explicitly locks in browser print-to-PDF
  (`03-architecture.md` §1: "No PDF-rendering library needed — browser print
  covers it"); revisiting this would be an unrequested scope change.
- **Single shared "export AST" abstraction across HTML/DOCX**: considered,
  but rejected as premature — HTML export's needs (DOM + CSS) and DOCX's
  needs (token stream + OOXML) are different enough that a shared
  abstraction would add indirection without removing real duplication.
