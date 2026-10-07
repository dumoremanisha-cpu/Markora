# ADR-0003: Annotation Identity & Re-Anchoring Model

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §21; feature matrix F27, F51

## Context

`01-functional-requirements.md` §21 states the *requirement* — annotations
persist locally, keyed by "document identity, selected text, approximate
location (for re-anchoring after minor edits), annotation type, timestamp,"
and must degrade to a visible "orphaned" state rather than silently
disappearing or mis-anchoring when re-anchoring fails. It does not specify
*how* re-anchoring works. This is the single most technically open question
in the spec set and needs a concrete, testable algorithm before Phase 5 can
be implemented or tested.

## Decision

Adopt a selector model modeled on the **W3C Web Annotation Data Model's
`TextQuoteSelector` + `TextPositionSelector`** pattern (a well-established,
widely implemented approach — used by hypothes.is and browser
text-fragment matching — chosen here as a *technique*, not a dependency;
implemented directly, no external annotation library required).

### Document identity

- Local files (both access flows in ADR-0001): a stable key derived from the
  resolved file path/handle name + folder-relative path where known.
- Remote URLs: the normalized URL (scheme + host + path, query stripped
  unless meaningfully part of identity) is the key.
- Content-hash is **not** used as the primary key (it would break identity
  on every edit, defeating re-anchoring); it is stored as a secondary
  "content fingerprint at annotation time" field, used only as a re-anchoring
  confidence signal (see below), never as the lookup key.

### Anchor data stored per annotation

| Field | Purpose |
|---|---|
| `documentId` | Stable key as above |
| `exactText` | The exact selected string (the "quote") |
| `prefix` | ~32 chars of rendered-text context immediately before the selection |
| `suffix` | ~32 chars of rendered-text context immediately after the selection |
| `charOffsetAtCreation` | Character offset of the selection start within the document's rendered plain-text content at creation time |
| `contentFingerprint` | A lightweight hash (e.g. a fast non-cryptographic hash) of the full rendered plain-text content at creation time |
| `type` | highlight / underline / comment |
| `commentText` | Only for comment type |
| `createdAt` / `updatedAt` | Timestamps |
| `status` | `active` \| `orphaned` |

### Re-anchoring algorithm on document (re)load

1. If `contentFingerprint` matches the current document's fingerprint exactly
   → content is unchanged; anchor by `charOffsetAtCreation` directly (fast
   path, no search needed).
2. Otherwise, search the current rendered plain text for occurrences of
   `exactText`:
   - Exactly one occurrence anywhere in the document → re-anchor there
     (content shifted, but the quote is unambiguous).
   - Multiple occurrences → pick the one whose surrounding `prefix`/`suffix`
     context best matches (allow small edit-distance tolerance); if no
     candidate clears a similarity threshold, or more than one clears it
     with near-equal confidence → **orphaned** (ambiguous, do not guess).
   - Zero occurrences → **orphaned** (the exact text was edited/removed).
3. Orphaned annotations remain **visible** (in a dedicated "Orphaned"
   section of the annotations panel, per F51's tabbed sidebar), never
   silently dropped, with an action to delete or (where the user can
   visually locate the intended spot) manually re-attach.

### Non-mutation guarantee

Annotations are never written into the source Markdown file automatically.
An explicit, user-triggered "apply to document" action (out of scope for v1
unless separately requested — not required by the spec) would be the only
path that could ever touch the source file, and no such automatic path
exists in this plan.

### Storage

Annotations persist in `chrome.storage.local` under a namespaced key per
document identity (see ADR-0004 for the overall schema), never in
`chrome.storage.sync`.

## Consequences

- Re-anchoring is O(document length × annotation count) in the worst case
  (full-text search per annotation on load) — acceptable for the spec's
  target document sizes (1–5 MB) since it runs once per load/refresh, not
  per scroll/render tick. **The bar is budget P9 in
  `docs/specs/06-testing-quality-gate.md` §1a (added 2026-09-08): 50
  annotations against a 5 MB document must re-anchor in under 500 ms total,
  with no single main-thread task over 50 ms — chunk the work if needed.**
  Phase 5 measures against that number rather than a subjective "no
  noticeable stall".
- The "prefix/suffix similarity" step needs a concrete, small
  edit-distance or n-gram-overlap function — implemented as a local utility,
  not a dependency, to keep the bundle light.
- Orphaning is a **visible, user-facing state**, not an internal-only flag —
  Phase 5's UI work must include an explicit orphaned-annotation affordance,
  not just the backend logic.

## Alternatives considered

- **DOM Range/offset-path anchoring** (storing a path through the rendered
  DOM tree): rejected as the primary mechanism — the rendered DOM is
  regenerated on every reload/refresh (new element identities), and offset
  paths break on any structural change (e.g. a heading added above the
  annotation), which is exactly the "minor edit" case the spec requires
  graceful handling for. Character-offset-in-plain-text is more stable
  across re-renders than a DOM path.
- **Full content-hash-as-identity** (re-derive a new annotation set if the
  hash changes at all): rejected — would orphan every annotation on every
  edit, contradicting the spec's explicit requirement to survive "minor
  edits."
- **Third-party annotation library** (e.g. a DOM-anchoring package):
  considered, but the selector model above is simple enough to implement
  directly in a few hundred lines, avoiding an extra dependency for a
  security-sensitive, locally-persisted data model this project wants full
  control over.
