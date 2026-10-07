# Markora — Project Memory

Markora is a privacy-first Google Chrome **Manifest V3** extension that detects
and renders Markdown (local files/folders, drag-and-drop, raw Git-host URLs,
arbitrary Markdown/`.txt`) as a rich document view: syntax highlighting,
diagrams (Mermaid/Graphviz/PlantUML), math (KaTeX), TOC, search, annotations,
presentation/mind-map views, and multi-format export (HTML/DOCX/print-PDF).
Everything runs client-side; nothing is uploaded anywhere by default.

**Repository state:** documentation only. No `package.json`, no `src/`, no
build tooling, no lockfile — implementation has not started (Phase 0 of the
plan below has not been run). **Verify this against the actual filesystem
before assuming otherwise** — a prior session's report of what it built is
not a substitute for checking `src/`, `manifest.json`, and config files
yourself.

## Source of truth (read only what the task needs)

| Need | Read |
|---|---|
| What to build, why | `docs/specs/00-overview.md` … `08-glossary-references.md` |
| Feature traceability (F01–F81) | `docs/specs/02-feature-matrix.md` |
| Technical decisions already made | `docs/adr/0001-…` through `0008-…` |
| What to implement next, in what order | `docs/plans/2026-09-08-markdownview-pro-implementation.md` |
| Original build brief / parity target | `referenece/projectDetails.md`, `referenece/reference.md` (the folder is named "referenece" — intentional, not a typo to fix) |

The implementation plan is written so **each phase is its own,
context-limited session**: read that phase's section, the ADR(s) it cites,
and its feature-matrix rows — not the whole spec set or the whole plan.
Every phase section ends with "STOP after this phase" and a ready-to-use
session prompt. Follow it.

## Non-negotiables (every phase, every session)

Full rules: @.claude/rules/security-privacy.md, @.claude/rules/permissions.md,
@.claude/rules/code-conventions.md, @.claude/rules/workflow.md. Summary:

- Document content never leaves the browser except a disclosed,
  off-by-default, explicit opt-in (PlantUML) or an inevitable
  document-referenced subresource (an image the open document links to) —
  never a silent network feature.
- All content-derived HTML passes through DOMPurify before touching the DOM.
  No renderer, no plugin, gets an exception.
- `chrome.storage.local` only, never `.sync`, always through the typed
  wrapper in `src/storage/`.
- Every `manifest.json` permission is justified in
  `docs/specs/07-permissions-compliance.md` **before** it's added; minimum
  permission always wins over convenience.
- One phase per session. Verify what actually exists before building on it.
  Stop when the phase's own plan section says stop — don't pull work forward
  from a later phase.

## Planning/doc changes

Use the `analyzedoc` subagent for anything touching `docs/specs/`,
`docs/adr/`, or `docs/plans/` (requirements audits, traceability checks, new
ADRs). It is read-only over source code and only writes under `docs/`.

## Independence requirement

Markora must be an independently implemented product with capability parity
to MarkView (the reference product), never a clone: no MarkView code, CRX
internals, assets, UI layout, icon set, or marketing copy. See
`docs/specs/00-overview.md` §3.
