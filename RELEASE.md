# Release

Current status: **feature-complete, not yet submitted to the Chrome Web
Store.** This file tracks the Chrome Web Store preparation checklist from
`docs/specs/07-permissions-compliance.md` §4 and the consolidated known-
limitations list referenced from `README.md`/`CHANGELOG.md`.

## Chrome Web Store preparation checklist

- [x] Manifest permissions list matches exactly what's justified in
      `docs/specs/07-permissions-compliance.md` §2, no more. Re-audited
      this phase against a production `dist/manifest.json`:
      `permissions: ["storage", "activeTab", "scripting"]`,
      `optional_permissions: ["unlimitedStorage"]`,
      `host_permissions: ["file:///*"]`. Nothing else.
- [x] Privacy policy present and accurate — `PRIVACY.md` reflects
      `docs/specs/04-security-privacy.md`; no data-collection claim that
      isn't true.
- [x] Store listing description accurately describes functionality without
      referencing or implying any relationship to MarkView — see
      `README.md`'s description; this repository, its docs, and its UI
      strings contain no MarkView reference anywhere (confirmed by the
      independence requirement in `CLAUDE.md`/`docs/specs/00-overview.md`
      §3, upheld throughout every phase).
- [ ] Icons/screenshots/branding are 100% original. **Not done**: no icon
      set exists yet (`manifest.config.ts` ships with no `icons` field —
      see its own comment: "a placeholder/borrowed icon would risk the
      independence requirement; real icons are a later phase"). This is a
      hard blocker for an actual Chrome Web Store submission, not a
      polish-phase nice-to-have — the Store requires at least a 128×128
      icon. Recorded here rather than silently worked around with a
      placeholder that itself might not be safely "100% original."
- [x] Single-purpose description is clear and matches the extension's
      actual behavior (Markdown viewing/rendering) — see `README.md`.
- [x] No remote code execution — all JS ships inside the extension
      package; no `eval`/`new Function`/remote script loading anywhere in
      the codebase (grepped this phase, consistent with every prior
      phase's own audit in `SECURITY.md`).
- [x] File-URL access is off by default with clear, in-product
      instructions for enabling it — the popup's Setup tab and, as of this
      phase, the onboarding tour's file-access step both explain it, and
      neither auto-enables it.
- [x] The one opt-in network feature (PlantUML remote rendering) is
      clearly disclosed in the settings UI (Settings → Privacy, disclosure
      text naming the exact server before the toggle can be turned on) —
      store-listing disclosure text is drafted in `PRIVACY.md` and ready to
      paste into the listing once one exists.

## What's left before an actual submission

1. **A real icon set** (the one unchecked item above) — independently
   designed, not borrowed or AI-generated from a prompt referencing
   MarkView's actual icon.
2. **Real destination URLs** for the feature-request/report-issue/
   rate-extension links (`src/utils/links.ts`) and the Chrome Web Store
   listing itself — none of these exist until the extension is actually
   published somewhere, so they're deliberately left as disabled
   placeholders in the UI rather than invented (see `ARCHITECTURE.md`'s
   Phase 10 "Known limitations").
3. **A store listing** (description, screenshots, category, support
   email) — content only, no code changes required; `README.md` and
   `PRIVACY.md` already contain the raw material.
4. **A final fresh-Chrome-profile manual pass** through onboarding, the
   full quality-gate checklist's manual-only items (see
   `TESTING.md`/`docs/manual-verification-checklist.md`), and a real
   physical-device responsive sweep — none of this is automatable and
   wasn't performed in this (non-interactive) session; see
   `docs/manual-verification-checklist.md` for the exact steps.

## Known limitations (consolidated)

Carried forward from every phase, assembled here as the single
authoritative list:

- **PlantUML has no offline, client-side renderer** (ADR-0002's
  feasibility finding) — it's the one network-dependent feature, off by
  default, disclosed before enabling.
- **DOCX math export has a two-tier fallback boundary**: most expressions
  export as native OOXML math; anything KaTeX/the converter can't map
  falls back to a rasterized image with the original LaTeX as alt text —
  documented in `TESTING.md`'s DOCX export coverage.
- **Machine-assisted translation quality** for the 18 non-English locales
  — not professionally reviewed (Phase 8; unchanged since).
- **`file://`-flow auto-refresh has a weaker change-detection signal**
  than the FileSystemAccess-handle flow (content hashing vs. reliable
  `lastModified` polling) — both still work, one is just less precise.
- **FSAA folder-handle permission durability is Chrome's own guarantee,
  not this product's** — a silent reconnect isn't guaranteed to succeed
  across every browser restart; the folder browser's "Reconnect" banner is
  the documented fallback.
- **Mind-map RTL layout is best-effort**, not pixel-verified against every
  RTL locale.
- **The viewer's eager entry chunk exceeds the 500kB/5MB review
  thresholds** (`TESTING.md`'s P14 finding) — every diagram engine, export
  format, and locale catalog is already lazy-loaded; the remaining
  opportunity (splitting export/DOCX, presentation, and mind-map behind
  their own dynamic imports) is real, scoped, moderate-risk work
  deliberately not absorbed into a QA or polish pass.
- **Help/feedback/rate-extension links and the Chrome Web Store listing
  itself don't exist yet** — see "What's left before an actual
  submission" above.
- **`ARCHITECTURE.md`/`DEVELOPMENT.md`'s Phases 6–9 sections were never
  written** — a pre-existing documentation gap, flagged in both files
  rather than silently left implicit or retroactively reconstructed.
- **Cross-browser testing covered Chrome and Edge only** — Brave, Opera,
  and Vivaldi weren't available in the Phase 9 test environment; no
  Chrome-only API was found in a full `chrome.*` call-site audit.
