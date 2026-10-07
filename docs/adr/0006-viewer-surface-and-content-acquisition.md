# ADR-0006: Viewer Surface & Content-Acquisition Model

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §1, §9, §16, §17, §31, §34;
  `docs/specs/03-architecture.md` §2, §3, §5, §8;
  `docs/specs/04-security-privacy.md` §1, §3;
  `docs/specs/07-permissions-compliance.md` §2; ADR-0001, ADR-0002;
  feature matrix F01–F07, F23, F48, F59, F60, F75

## Context

ADR-0001 decided **which** URLs Markora reacts to and **how local files are
acquired**. It did not decide what happens in the ~200 ms after a match:
the phrase used there is that the content script "hands off rendering to the
viewer," and `03-architecture.md` §3 says content moves "from source →
extension memory only." Neither says *who reads the bytes* or *where the
rendering surface physically lives*.

Three genuinely different models are compatible with the wording already in
the specs, and they have opposite consequences:

1. **Inline render** — the content script rebuilds the document inside the
   matched page.
2. **Redirect + viewer re-fetch** — the content script navigates the tab to an
   extension page, which then `fetch()`es the original URL itself.
3. **Redirect + content handoff** — the content script reads the text that the
   tab has *already loaded*, passes it to the extension, and the extension page
   renders it without ever performing its own network request.

The choice determines the manifest's `host_permissions`, whether ADR-0002's
CSP posture (`script-src 'self'` + `wasm-unsafe-eval`) is even reachable,
what the address bar shows, how Back/Forward behaves (F48), whether URL
fragments survive (F60), and how "only address-bar-entered URLs are saved to
recents" (F59) can be observed at all. Leaving it to implementation time
would silently decide the permission story that
`07-permissions-compliance.md` exists to protect.

Two hard technical facts constrain the choice:

- **Raw-content hosts ship hostile CSPs.** `raw.githubusercontent.com` serves
  its responses with `Content-Security-Policy: default-src 'none'; sandbox`.
  A content script's own JavaScript runs in an isolated world and is exempt,
  but resources the script injects into the *page* (stylesheets, web fonts,
  images, WebAssembly) are governed by the page's CSP. Inline rendering there
  would lose bundled fonts (KaTeX, the ~9 typography fonts), image loading,
  and the Graphviz WASM path — i.e. most of the product.
- **An extension page cannot fetch arbitrary origins without host
  permissions.** Model 2 therefore requires either broad `host_permissions`
  or a growing curated host list — the exact permission expansion ADR-0001 §2
  and `07-permissions-compliance.md` §1 were written to avoid.

## Decision

### 1. The viewer is a dedicated extension page; nothing renders inline

The rendering surface is `chrome-extension://<id>/viewer.html`, a normal
extension page under the project's strict CSP (ADR-0002). No third-party page
is ever converted in place, which keeps `03-architecture.md` §8's rule
("content script must not be a full re-implementation of the viewer inline on
third-party pages") literally true and puts every renderer under a CSP we
control rather than one the remote host chose.

### 2. Content handoff, never viewer re-fetch (model 3)

For a matched navigation (a raw-Markdown URL per ADR-0001 §2, or a
`file://` document with file-URL access enabled):

1. The content script runs at `document_idle` on the already-loaded
   plain-text resource and reads the document text **from the DOM**
   (Chrome renders `text/plain`/unknown-type responses inside a single
   `<pre>`; the source of truth is `document.body.innerText`, with a
   `document.querySelector('pre')` fast path). **No `fetch()` is performed —
   the bytes are already in the tab.**
2. The content script calls
   `chrome.runtime.sendMessage({ type: 'handoff/create', url, text, hints })`.
   The service worker writes the payload into the extension-origin IndexedDB
   `handoff` object store under a random token and returns that token.
3. The content script navigates with
   `location.replace(chrome.runtime.getURL('viewer.html') + '?src=' +
   encodeURIComponent(originalUrl) + '&h=' + token + location.hash)`.
4. The viewer reads the payload by token, **deletes it immediately**, and
   renders through the normal parse → sanitize → enhance pipeline.

Consequences of this specific mechanism:

- **No `host_permissions` for any http(s) origin are ever required.** The
  content-script `matches` patterns from ADR-0001 §2 remain the extension's
  only web-origin reach, exactly as `07-permissions-compliance.md` §2
  assumes.
- IndexedDB (not `chrome.storage.session`) is the handoff channel because
  session storage's quota (single-digit MB, and not reachable from an
  untrusted content-script context without relaxing `setAccessLevel`) is a
  cliff for the 5 MB documents `06-testing-quality-gate.md` §1 targets. It is
  also the same store ADR-0001 already uses for File System Access handles,
  so no new storage mechanism is introduced.
- The handoff record is single-use and swept on a TTL (e.g. 60 s) at service
  worker start-up, so an abandoned navigation cannot leave document text at
  rest. Document text at rest is otherwise never written anywhere
  (`04-security-privacy.md` §5 keeps "open document content" in memory only).
- `location.replace` (not `assign`) is used so the raw URL does **not** become
  a stale history entry that Back would bounce off.

### 3. Acquisition routes that bypass handoff entirely

| Route | Who obtains the bytes | Handoff record? |
|---|---|---|
| Matched remote raw URL | Content script reads loaded DOM text (§2) | Yes |
| `file://` navigation (ADR-0001 Flow A) | Content script reads loaded DOM text (§2) | Yes |
| "Open file"/"Open folder" picker (ADR-0001 Flow B) | Viewer itself, via File System Access API | No — already in the viewer |
| Drag-and-drop (F06) | Viewer itself, via the `DataTransfer` `File` object | No |
| Folder-browser click (F19) | Viewer itself, via the retained directory handle | No |
| **"Render this page as Markdown"** popup action (F04 fallback) | Same as row 1, but the content script is injected on demand via `activeTab` + `scripting` after the user clicks, instead of matching passively | Yes |

### 4. Auto-refresh and the one host permission this model does require

Once the tab is on `viewer.html`, the original `file://` document is no longer
loaded anywhere, so ADR-0001 Flow A's ~2 s polling loop must re-read it from
the viewer. That requires `"file:///*"` in `host_permissions` — inert unless
the user has enabled "Allow access to file URLs," which is the same gate
ADR-0001 already documents.

This is an addition to the permission set in
`07-permissions-compliance.md` §2 (which describes file-URL access only as
the user-facing toggle, not as the accompanying manifest entry). It is
recorded there as a pointer to this ADR rather than silently merged, matching
how ADR-0004's `unlimitedStorage` amendment is handled. **No http(s) host
permission is added by this ADR** — remote documents are never re-fetched,
and remote auto-refresh is out of scope per `01-functional-requirements.md`
§17 (auto-refresh is a local-file feature).

### 5. URL fragments, history, and the address bar

- **Fragments (F60):** `location.hash` is appended to the viewer URL verbatim
  in step 3, so `…/README.md#installation` deep-links correctly after
  handoff. In-viewer anchor clicks update the viewer page's own hash.
- **Back/Forward (F48):** the toolbar's back/forward act on tab history
  (`history.back()/forward()`). Navigating documents *within* the viewer
  (folder-browser clicks, in-document links to sibling files) uses
  `history.pushState`, so in-app navigation is undoable without leaving the
  viewer. Because step 3 used `location.replace`, pressing Back from a
  freshly-opened document returns to whatever the user was on before, not to
  an unrendered raw page that would immediately re-redirect.
- **Address bar:** the visible URL is `chrome-extension://…`, not the source
  URL. Mitigation (a requirement this ADR introduces for the toolbar): the
  viewer displays the source path/URL in its document header with a
  copy-to-clipboard action, so the user can still retrieve and share the
  original location.

### 6. Address-bar-navigation detection for recents (F59/F75)

ADR-0001 §4 requires that remote documents enter "recent documents" only for
address-bar-entered navigations, without a `webNavigation`/`history`
permission, but did not say how that is observed. The handoff message's
`hints` field carries the determination, computed in the content script at
step 2 from data already available to the page:

```
addressBarEntered =
  document.referrer === '' &&
  performance.getEntriesByType('navigation')[0]?.type === 'navigate'
```

Accepted failure modes, documented rather than hidden: a link click from a
page that sent no referrer (e.g. `rel=noreferrer`, or an https→http
downgrade) is indistinguishable from a typed URL and will be recorded; a
typed URL reached via a redirect chain reports `type: 'navigate'` with a
referrer and will *not* be recorded. Both err toward the privacy-safe or
merely-incomplete side, never toward passive monitoring, and both are covered
by explicit Phase 4 test cases.

### 7. Message contract

The content script may send exactly two message types to the service worker —
`handoff/create` (payload above) and `detection/ping` (health check used by
the master enable toggle, F54). Nothing else. There is no generic
"execute"/"render this" message shape, satisfying
`04-security-privacy.md` §3's "no security-boundary escape" requirement: page
content can only ever become *data in a handoff record*, never an instruction.

## Consequences

- The permission footprint stays at `content_scripts.matches` +
  `file:///*` (toggle-gated) + `storage` + `activeTab` + `commands`. No
  http(s) host permission is needed for any v1 feature.
- Every renderer runs under the project's own CSP, so ADR-0002's
  `wasm-unsafe-eval` Graphviz path and all bundled fonts work uniformly on
  every source — including `raw.githubusercontent.com`, whose own CSP would
  have broken an inline implementation.
- The viewer is a single, testable surface: Playwright E2E can open
  `viewer.html` with a seeded handoff record without needing a live remote
  host or a `file://` toggle it cannot flip.
- The source URL is no longer in the address bar. This is a real UX loss,
  mitigated by §5's header + copy action, and it must be called out in the
  product `README.md`'s known-behaviour notes.
- If Chrome *downloads* rather than displays a matched resource (it does this
  for some `Content-Type`/`Content-Disposition` combinations, and for some
  local file types), no content script runs and no handoff happens. The
  documented fallback is "Open file" (Flow B) or drag-and-drop; this is a
  known limitation, not a defect to chase.
- Document text briefly exists at rest in extension-origin IndexedDB during
  the handoff. It is single-use, TTL-swept, and never leaves the device — but
  `SECURITY.md`/`PRIVACY.md` must describe it accurately rather than claiming
  content is exclusively in memory.

## Alternatives considered

- **Inline rendering in the matched page**: rejected. Third-party CSPs
  (`raw.githubusercontent.com`'s `default-src 'none'; sandbox` being the
  flagship case) would block bundled fonts, images and WASM; it contradicts
  `03-architecture.md` §8; and it would force the whole renderer into a
  content-script bundle injected into arbitrary pages, widening the blast
  radius of any renderer bug.
- **Redirect + viewer re-fetch of the original URL**: rejected. It requires
  http(s) `host_permissions` (broad, or an ever-growing curated list) for
  bytes the browser has *already downloaded* — a strictly worse permission
  posture for zero functional gain, and one that
  `07-permissions-compliance.md` §1's minimization principle would have to be
  argued around. It also doubles fetches and would re-request non-idempotent
  URLs.
- **Handoff via `chrome.storage.session`**: rejected as the primary channel —
  quota is too small for the spec's 5 MB target and access from untrusted
  content-script contexts requires relaxing `setAccessLevel`.
- **Handoff via a long-lived `chrome.runtime.connect` port held across the
  navigation**: rejected — the port dies with the navigating document, and
  MV3 service-worker eviction makes an in-memory-only relay unreliable.
- **Rendering in a sandboxed iframe injected into the original page** (keeping
  the source URL in the address bar while escaping the host CSP): rejected for
  v1 — an iframe with a `chrome-extension://` document is still subject to the
  embedder page's `frame-src`, which `default-src 'none'` forbids, so it fails
  on exactly the host that motivated the decision.
