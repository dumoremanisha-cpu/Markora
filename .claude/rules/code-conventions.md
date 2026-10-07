# Code Conventions

Source: `docs/adr/0007-i18n-architecture.md`,
`docs/adr/0004-storage-schema-and-quota.md`,
`docs/specs/03-architecture.md` §2, §8.

1. **No literal user-facing strings.** Every UI string goes through
   `t(key, params)` from `src/i18n/` from its first commit — there is no
   "add i18n later" pass. The `no-literal-user-strings` lint rule
   (established Phase 1) must stay enforced with zero suppressions.
2. **Storage goes through the typed wrapper.** Components read/write
   settings via `src/storage/`, never a raw `chrome.storage.*` call — this
   is what keeps the schema-version/migration system (ADR-0004) meaningful.
3. **Module boundaries hold.** Background service worker = routing,
   messaging, `chrome.commands` only, no business logic. Content script =
   detection + handoff, never a fetcher of remote content, never a second
   rendering implementation. Viewer page = the actual application. Popup =
   quick actions only, never the full app or the home of folder
   browsing/bookmark management.
4. **Pipeline stays parse → sanitize → enhance**, as separable stages, so
   any one rendering feature (a diagram engine, a syntax theme) can fail in
   isolation without breaking the rest of the document.
5. **One notification component.** All transient success/error/warning/info
   messages use the shared toast component from Phase 1 — no feature builds
   its own ad hoc notification UI.
