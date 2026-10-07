# ADR-0001: File Access & Content-Detection Architecture

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §1, §13, §17; `docs/specs/03-architecture.md` §5, §6; `docs/specs/07-permissions-compliance.md`; feature matrix F01–F07, F19, F23, F63–F65, F74, F80

## Context

Markora must render Markdown from local files, raw Git-host URLs, and
"arbitrary sites serving Markdown," while requesting only the minimum Chrome
permissions needed (per `07-permissions-compliance.md`). Two tensions exist
that the specs describe behaviorally but do not resolve technically:

1. **Local file access has two genuinely different Chrome mechanisms**, with
   different permission models, different auto-refresh capabilities, and
   different persistence guarantees. The specs (F02, F19, F23, F80) describe
   both but don't separate them.
2. **"Auto-render on arbitrary sites" (F01/F04) vs. "minimum permissions"
   (07-permissions-compliance.md §2)** are in direct tension: true
   content-type sniffing on arbitrary URLs (no `.md` in the path) requires
   either a broad host permission or `webRequest`/`declarativeNetRequest`
   access to inspect response headers on every page the user visits — both
   disproportionate to a Markdown-viewing extension's stated single purpose.

## Decision

### 1. Two distinct local-file-access flows, kept as separate code paths

**Flow A — direct `file://` navigation** (user double-clicks a `.md` file, or
types/pastes a `file://` URL): requires the user to manually enable "Allow
access to file URLs" for the extension at `chrome://extensions` — this
**cannot** be requested programmatically; Chrome only exposes it as a manual
toggle. Implementation:
- A content script with `matches: ["file:///*"]` (declared in the manifest,
  gated on the user having enabled file-URL access) detects a Markdown
  extension by path suffix and hands off rendering to the viewer.
- Auto-refresh for this flow re-fetches the `file://` URL on a ~2s poll
  (focus-aware, per F74) and diffs content (length/hash), since `file://`
  responses typically expose no reliable `Last-Modified` header via `fetch`.
- The popup's "Setup" tab (per F02, screenshot-confirmed UX) explains the
  toggle and links directly to `chrome://extensions`.

**Flow B — "Open file" / "Open folder" via picker** (popup or in-viewer
action): uses the **File System Access API**
(`window.showOpenFilePicker()` / `showDirectoryPicker()`), triggered by a
user gesture from the **viewer page**, not the popup (Chrome's user-activation
handling for FSAA pickers is unreliable from extension popup windows in some
Chrome versions — matches the already-spec'd decision that folder browsing UI
lives in the viewer, not the popup, `01-functional-requirements.md` §13).
This flow needs **no** file-URL toggle at all.
- Auto-refresh polls `handle.getFile().then(f => f.lastModified)` — a
  reliable timestamp, unlike Flow A.
- Folder permission persistence (F80): the `FileSystemDirectoryHandle` is
  stored via IndexedDB (structured-clone; **not** `chrome.storage.local`,
  which cannot serialize handles). On load, call
  `handle.queryPermission({mode: 'read'})`; if not `'granted'`, show a
  single-click "Reconnect folder" affordance rather than restarting the full
  folder-picking flow — Chrome does not guarantee silent, zero-gesture
  permission survival across every browser restart, so the plan must not
  assume it does.

Both flows converge on the same rendering pipeline (parse → sanitize →
enhance) once raw text is obtained — only acquisition and refresh differ.

### 2. Narrow content-script path-glob matching for site auto-render

(Per the user's explicit decision on 2026-09-08, resolving the conflict
above.)

- `content_scripts.matches` uses path-suffix glob patterns:
  `*://*/*.md`, `*://*/*.markdown`, `*://*/*.mdown`, `*://*/*.mkd`,
  `*://*/*.mdx`, `*://*/llms.txt` — these match only URLs whose path
  literally ends in the given suffix, not all URLs on a domain.
- A curated, explicit list of raw-content host+path patterns is added
  alongside these for hosts whose raw URLs may not always carry a literal
  extension in every case: `raw.githubusercontent.com/*`,
  `*.gitlab.io`/`gitlab.com/*/-/raw/*`, `bitbucket.org/*/raw/*`,
  `*/raw/*` for self-hosted Gitea patterns where identifiable.
- **`.txt` files** are auto-rendered **only** when the filename is exactly
  `llms.txt` (a fixed, unambiguous filename convention). Any other `.txt`
  URL is not auto-matched — the content is ambiguous (could be plain text)
  and matching `*://*/*.txt` would be disproportionately broad (fires on
  huge numbers of unrelated pages). Other `.txt` content reaches Markora only
  via drag-and-drop, "Open file," or an explicit `activeTab`-gated toolbar
  click.
- True arbitrary content-type-only detection (no recognizable path suffix)
  is **out of scope for auto-render** in v1 — it is reachable only via an
  explicit user action (`activeTab`), never passively. This is a documented,
  deliberate narrowing of the literal "arbitrary sites" wording in
  `01-functional-requirements.md` §1, justified by the minimum-permission
  principle in `07-permissions-compliance.md` and confirmed by the user.

### 3. Never-auto-replace policy (F05) is unconditional in v1

GitHub blob/repo pages, GitBook, and Read the Docs are excluded from the
content-script match patterns above entirely (their URLs don't end in `.md`
in a way that would false-positive-match anyway).

**Amended 2026-09-08:** this ADR originally said the opt-in toggle described
in `03-architecture.md` §5 "is implemented as a separate, explicitly
enumerated pattern set only activated when the user turns the setting on."
That opt-in is **descoped from v1**. Activating it would require host
permissions for `github.com`, GitBook and Read the Docs domains that no other
feature needs and that `07-permissions-compliance.md` has never justified,
purely to replace pages that already render the content well. F05's v1
requirement is therefore only the negative one — never hijack these sites —
and no settings stub for the opt-in is built. Re-introducing it later is new
scope with its own `optional_host_permissions` analysis under
`07-permissions-compliance.md` §3. See `03-architecture.md` §5 and the F05
row in `02-feature-matrix.md`.

### 4. Remote-recents capture scope stays gesture-scoped (F59, F75)

Only address-bar-entered navigations to a matched remote URL populate
"recent documents" for remote sources — never passive `webNavigation`
monitoring. This requires no additional permission beyond what the content
script's own match already grants for that specific navigation.

## Consequences

- Two code paths for local files (`file://` polling vs FSAA) means two sets
  of tests and two sets of error states (Phase 4 must test both explicitly).
- The "arbitrary sites" requirement is met for the overwhelming majority of
  real Markdown-serving URLs (which almost always carry a recognizable
  extension) while keeping the permission footprint small and Web-Store-safe.
  A small, known gap remains for extension-less Markdown endpoints — documented
  as a known limitation, not silently dropped.
- `unlimitedStorage` and any other future permission additions must still
  pass the same 4-question checklist per `07-permissions-compliance.md` §3.

## Alternatives considered

- **Broad host permission + `declarativeNetRequest` content-type sniffing**:
  rejected — disproportionate permission ask, elevated Chrome Web Store
  review scrutiny, and contradicts the spec's own minimum-permission mandate.
- **`activeTab`-only, no passive auto-render anywhere**: rejected as the sole
  strategy — it would also drop auto-render for the curated raw-Git hosts,
  which the spec treats as core, always-on functionality (F03), not merely
  "arbitrary." The narrow-glob approach preserves that core behavior while
  still resolving the arbitrary-site tension.
