# Phase-by-Phase Workflow Rules

Source: `docs/plans/2026-09-08-markdownview-pro-implementation.md`.

1. **Verify before building.** At the start of a phase, check what actually
   exists in the repo (`src/`, `manifest.json`, config files, prior
   `ARCHITECTURE.md`/`SECURITY.md`/`DEVELOPMENT.md` entries) rather than
   trusting a previous session's report of what it built.
2. **One phase per session.** Implement only the phase you were asked for;
   read only that phase's plan section, the ADR(s) it cites, and its
   feature-matrix rows. Do not pull forward work from a later phase
   (diagrams, math, export, folder browsing, non-English locales, etc. all
   have designated phases — see the plan's phase overview table).
3. **Stop when the phase says stop.** Every phase ends with "STOP after this
   phase. Implement the next phase in a new session." Do not auto-continue
   into the next phase without being asked, even if it looks like a natural
   continuation.
4. **Don't skip a phase's own verification.** Run the phase's listed
   verification commands (`npm run build`, `npm run lint`, `npm run test`,
   `npx playwright test`, plus any manual steps) and its stated performance
   budgets before reporting the phase complete. A "done" claim needs the
   command output behind it.
5. **Keep the phase's documentation updates.** Each phase lists specific doc
   updates (e.g. `DEVELOPMENT.md`, `ARCHITECTURE.md`, `SECURITY.md`) — do
   them as part of the phase, not as deferred cleanup.
6. **Monetization stays out of scope.** No payment, subscription, account,
   or license-server code in any phase — the only monetization-adjacent work
   is the static `licenseStatus: "free"` field and UI label (Phase 10 /
   ADR-0004).
