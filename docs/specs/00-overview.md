# 00 — Product Overview

**Product name:** Markora
**Type:** Google Chrome Extension, Manifest V3
**Status:** Specification — no implementation yet

## 1. What this is

A privacy-first Chrome extension that detects Markdown content — local files, raw
Markdown served from Git hosts, or arbitrary Markdown/`.txt` on the web — and renders
it as a polished, feature-rich document: syntax-highlighted code, diagrams, math,
navigable TOC, presentation/mind-map views, annotations, and multi-format export.

All processing happens **inside the browser**. Nothing is uploaded anywhere by
default.

## 2. Why (source material)

- [`referenece/projectDetails.md`](../../referenece/projectDetails.md) — the full
  60-section build brief. This is the authoritative requirements source; every spec
  document in this folder decomposes it.
- [`referenece/reference.md`](../../referenece/reference.md) — two public URLs
  (getmarkview.com and its Chrome Web Store listing) naming the capability-parity
  target: **MarkView**. These are used strictly to identify *what a comparable
  product does*, never as a source of code, assets, or design to copy. See
  [`08-glossary-references.md`](./08-glossary-references.md) for the exact,
  verified capability list pulled from those two pages.
- `referenece/2026-09-08-markdownview-pro-product-spec.md` and
  `2026-09-08-feature-matrix.md` — an earlier draft pass superseded by this
  `docs/specs/` set (content carried forward and reorganized, not discarded).

## 3. Independence requirement (non-negotiable)

Markora must be an **independently implemented product** with capability
parity, not a clone:

| Allowed | Forbidden |
|---|---|
| Match publicly observable capabilities (features, toolbar *actions*, settings categories) | Copying MarkView source code, CRX internals, or proprietary assets |
| Use OSS libraries under compatible licenses (markdown-it, highlight.js, KaTeX, Mermaid, DOMPurify, etc.) | Copying exact UI layout, icon set, logo, color tokens, or marketing copy/screenshots |
| Original "Markora" branding, i18n strings, visual design | Impersonating MarkView in store listing, UI, or support channels |

Every feature in this spec set is written as a **behavioral requirement** (what the
product must do), never as a description of MarkView's implementation.

## 4. Core goal

When the user opens or provides:

- `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`, `.txt` (Markdown content)
- a raw Markdown URL (GitHub, GitLab, Bitbucket, Gitea, arbitrary hosts)
- a local file via drag-and-drop or "Open file"
- a local folder via "Open folder"

...the extension renders it as a full-featured Markdown document view. It must
**not** interfere with sites that already render their own Markdown (GitHub blob
pages, GitBook, ReadTheDocs). In v1 this is unconditional — the opt-in override
described in earlier drafts is descoped (see
[`03-architecture.md`](./03-architecture.md) §5 and the F05 row in
[`02-feature-matrix.md`](./02-feature-matrix.md)).

## 5. Users and primary jobs

| User | Job to be done |
|---|---|
| Developers | Read READMEs, specs, raw GitHub/GitLab docs with TOC, syntax highlighting, diagrams |
| Technical writers | Live-preview drafts while editing externally, with themes and stats |
| Students / researchers | Comfortable long-form reading with math, diagrams, annotations |
| Documentation maintainers | Browse/search a docs folder, auto-refresh while editing, bookmark key directories |
| Presenters | Turn a Markdown doc into slides for a walkthrough |

## 6. Success criteria

1. Opening any supported source (§4) reliably yields a correctly rendered document.
2. Feature set matches [`01-functional-requirements.md`](./01-functional-requirements.md)
   (derived from `projectDetails.md` §5–49) at production quality.
3. Local-only by default per [`04-security-privacy.md`](./04-security-privacy.md);
   zero analytics/telemetry; any network feature requires explicit, disclosed opt-in.
4. Original UI/branding — comparable capability and polish to the category leader,
   not a visual clone.
5. `npm install && npm run build` produces a loadable unpacked extension.
6. Passes the quality gate in
   [`06-testing-quality-gate.md`](./06-testing-quality-gate.md).

## 7. Explicitly out of scope (v1)

- Backend services, cloud sync, user accounts, databases.
- AI features that send document content off-device.
- Non-Chromium browsers (Firefox, Safari) — architecture should not preclude this
  later, but v1 targets Chrome + Chromium browsers only (see
  [`03-architecture.md`](./03-architecture.md) §Browser compatibility).
- Cloning MarkView's UI, assets, or store-listing identity.
- **A paid/licensed "PRO" tier.** The reference product has one (see
  [`02-feature-matrix.md`](./02-feature-matrix.md) for the scope-conflict note
  and decision record); v1 of Markora ships as 100% free with no
  payment or license-activation logic. A "License status: Free" placeholder
  and a reserved `licenseStatus` storage field exist purely so a future paid
  tier wouldn't require rework — see
  [`01-functional-requirements.md`](./01-functional-requirements.md) §31 and
  [`03-architecture.md`](./03-architecture.md) §1.

## 8. How to read this spec set

| Doc | Covers |
|---|---|
| [01-functional-requirements.md](./01-functional-requirements.md) | Every user-facing feature, organized by area |
| [02-feature-matrix.md](./02-feature-matrix.md) | Flat traceability table: ID, feature, required?, phase, source |
| [03-architecture.md](./03-architecture.md) | Tech stack, module layout, data flow, detection policy |
| [04-security-privacy.md](./04-security-privacy.md) | Threat model, sanitization, privacy guarantees |
| [05-ux-i18n-accessibility.md](./05-ux-i18n-accessibility.md) | Visual design, theming, typography, i18n, RTL, a11y, shortcuts |
| [06-testing-quality-gate.md](./06-testing-quality-gate.md) | Test plan by area + the ship/no-ship checklist |
| [07-permissions-compliance.md](./07-permissions-compliance.md) | Manifest permissions, justification, Web Store checklist |
| [08-glossary-references.md](./08-glossary-references.md) | Terms, and the verified MarkView capability list used for parity targeting |

Planning (phasing, task breakdown, effort estimates) is **not** in this folder —
per instruction, specs are written first; implementation planning happens after
review. Those downstream documents now exist alongside this folder:

| Location | Covers |
|---|---|
| [`../adr/`](../adr/) | Architecture Decision Records (ADR-0001…) resolving technical questions these specs state only behaviorally |
| [`../plans/`](../plans/) | The phase-wise implementation plan and its feature-to-phase traceability table |
