# Permissions Rules

Source: `docs/specs/07-permissions-compliance.md`.

1. **Currently justified permissions:** `storage` only. From Phase 1 onward
   the plan also declares `host_permissions: ["file:///*"]`, inert until the
   user enables Chrome's "Allow access to file URLs" toggle. `activeTab` +
   `scripting` are added only at Phase 2-B task 11, when the "Render this
   page as Markdown" feature that justifies them actually ships. Check
   `manifest.json` (once it exists) against this list — and against
   `docs/specs/07-permissions-compliance.md` §2 — before assuming a new
   permission is fine to add.
2. **Before adding any permission**, answer and record (in
   `docs/specs/07-permissions-compliance.md`) all four questions from its
   §3: why is it needed, can it be avoided, is there a narrower alternative
   (optional permission, `activeTab`, a user-gesture picker), would it draw
   disproportionate Chrome Web Store review scrutiny.
3. **Prefer, in this order:** a user-gesture-triggered API (File System
   Access picker, `activeTab`) → an `optional_permissions` /
   `optional_host_permissions` entry requested at time of use → a narrow
   static permission → a broad static permission (last resort — generally
   not acceptable for this project).
4. **Never** request `history`, `webRequest`, `declarativeNetRequest`,
   `tabs`, `cookies`, `geolocation`, or a blanket `*://*/*` host permission —
   every ADR that touched this question (ADR-0001, ADR-0006) explicitly
   rejected these paths in favor of narrower alternatives.
5. `unlimitedStorage` is pre-approved by ADR-0004 but must be requested only
   via `chrome.permissions.request()` at runtime after a usage threshold,
   never declared statically — it still owes the §3 checklist at the point
   it's actually added.
