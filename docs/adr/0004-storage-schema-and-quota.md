# ADR-0004: Storage Schema, Versioning & Quota Strategy

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/03-architecture.md` §1; `docs/specs/07-permissions-compliance.md`; feature matrix F21, F22, F27, F41, F42, F58

## Context

Settings, recent documents, folder bookmarks, and annotations all persist in
`chrome.storage.local` exclusively (never `sync`). The specs mandate *what*
is stored but not the schema shape, versioning approach, or how to handle
the real risk that annotations + recents + bookmarks could approach
`chrome.storage.local`'s default ~10 MB quota for a heavy user — a risk
`07-permissions-compliance.md` does not address.

## Decision

### Storage wrapper

A single typed wrapper module (`src/storage/`) is the only code allowed to
call `chrome.storage.local` directly — enforced by module boundary, not
runtime check. All reads/writes go through typed accessor functions per
logical collection (settings, recents, bookmarks, annotations), never raw
key strings scattered across features.

### Schema (top-level keys in `chrome.storage.local`)

```
{
  "markora.schemaVersion": number,
  "markora.settings": Settings,
  "markora.recents": RecentEntry[],
  "markora.bookmarks": FolderBookmark[],
  "markora.annotations.<documentId-hash>": Annotation[]   // one key per document, not one giant array
}
```

Annotations are sharded **per document** (one storage key per document
identity, per ADR-0003) rather than one flat array — this bounds the
cost of reading/writing annotations for the currently-open document to that
document's own annotation set, not the user's entire annotation history
across every document they've ever opened.

### `Settings` schema highlights

- Every field in `docs/specs/01-functional-requirements.md` §25–32
  (theme, typography, per-Markdown-feature toggles F69, diagram toggles,
  export defaults, shortcuts, language, RTL override, etc.) is a named,
  typed field — no free-form blobs.
- **`licenseStatus: { tier: "free" }`** — reserved per
  `03-architecture.md` §1 and the feature-matrix decision record. v1 writes
  this once at install and never reads/branches on any other value. No
  license-check logic anywhere in the codebase reads this field to alter
  behavior in v1.

### Versioning & migration

- `markora.schemaVersion` is checked on every extension load. A migration
  registry (`{fromVersion: number, migrate: (data) => data}[]`) runs any
  pending migrations sequentially before the rest of the app reads storage.
- v1 ships as schema version `1`; no migrations exist yet — the registry
  exists as empty scaffolding so a future schema change doesn't require
  retrofitting a migration mechanism.

### Quota strategy

- **Default quota (no special permission) is the v1 baseline.** Typical
  usage (settings + a few dozen recents/bookmarks + a modest annotation set)
  fits comfortably within `chrome.storage.local`'s default ~10 MB.
- **`unlimitedStorage` is added to `optional_permissions`** in the manifest
  (not a statically-declared, always-on permission) and is requested at
  runtime via `chrome.permissions.request()` **only** when a storage-usage
  check (via `chrome.storage.local.getBytesInUse()`) crosses a warning
  threshold (e.g. 80% of quota) — surfaced to the user as a clear prompt
  explaining why ("your annotations/recents are approaching the storage
  limit"), not requested silently or upfront.
- This is a **proposed amendment** to the permission matrix in
  `docs/specs/07-permissions-compliance.md` §2, carried into the
  implementation plan's permission matrix — it does not silently edit that
  spec file; `07-permissions-compliance.md` should be updated to reference
  this ADR when Phase 4 lands.
- Recents (F22/F59/F75) and folder bookmarks (F21) get a soft cap (e.g.
  ~200 recent entries, oldest pruned first) to bound their own growth
  independent of the quota-warning path above — a normal data-hygiene
  measure, not a workaround for a storage bug.

## Consequences

- Sharded annotation storage means maintenance actions can operate on
  precisely one data class without touching the others.

  **Clarified 2026-09-08 (was ambiguous):** an earlier wording here implied
  "Clear Cache" (F55) wipes annotation data. It does not. Per the scope table
  now in `docs/specs/01-functional-requirements.md` §32, **Clear Cache clears
  `markora.recents`, `markora.bookmarks`, folder-scan/search caches and
  transient handoff records only**; it never touches `markora.settings`, the
  stored File System Access handles, or `markora.annotations.*`. Annotations
  are user-authored content and are removable only via a separate
  "Delete all annotations" action behind an explicit confirmation. The
  sharded layout is what makes that selectivity clean — it just isn't
  exercised by Clear Cache.
- The migration registry is unused scaffolding in v1 — acceptable, since it
  is a few dozen lines, not a speculative feature build-out, and directly
  serves the "no rework later" goal already mandated for `licenseStatus`.
- Any phase that adds a new settings field must add it to the typed
  `Settings` interface and its default value in one place
  (`src/storage/schema.ts` or equivalent) — phases must not invent parallel
  ad hoc storage keys.

## Alternatives considered

- **One flat `annotations` array for all documents**: rejected — every
  annotation read/write would touch the user's entire annotation history,
  wasteful for the common case of only the currently-open document's
  annotations being relevant, and increases the chance of hitting
  per-write size limits on a single storage key.
- **IndexedDB for everything (including settings/recents/bookmarks)**:
  rejected for those three — they are small, simple, and
  `chrome.storage.local`'s API is simpler and sufficient; IndexedDB is used
  only where it's structurally required (FSAA handles, per ADR-0001), not
  as a blanket replacement.
- **Declaring `unlimitedStorage` unconditionally from v1**: rejected — an
  always-on broad-sounding permission with no proportionate justification
  at typical usage levels is exactly what `07-permissions-compliance.md`'s
  minimization principle argues against; the optional/contextual-request
  pattern is the narrower alternative already used elsewhere in this
  project's permission strategy (see ADR-0001 §2).
