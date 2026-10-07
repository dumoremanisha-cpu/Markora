# Development — build notes

Running log of non-obvious tooling/build findings, per phase. Phase 0
(Repository & Architecture Validation) stood up the project skeleton and ran
the five spikes required before any feature phase begins; this document
records what was validated, the exact tool versions used, and the
non-obvious findings later phases must account for. Later phases append
their own findings sections below rather than starting a new file.

## Tool versions validated

| Tool                   | Version                                           |
| ---------------------- | ------------------------------------------------- |
| Node.js                | v24.13.0                                          |
| npm                    | 11.6.2                                            |
| TypeScript             | 5.9.3 (pinned below 6.1.0 — see note)             |
| Vite                   | 8.2.2                                             |
| `@crxjs/vite-plugin`   | 2.7.1                                             |
| ESLint                 | 10.10.0 (flat config, `typescript-eslint` 8.70.0) |
| Prettier               | 3.9.6                                             |
| Vitest                 | 5.0.0 (jsdom environment)                         |
| `@playwright/test`     | 1.63.0, bundled Chrome for Testing 153.0.8010.12  |
| `@axe-core/playwright` | 4.13.0                                            |
| Mermaid (Spike 2)      | 11.17.2                                           |

**TypeScript pin note:** `typescript@latest` is 7.0.2 (npm `latest` tag) at
the time of this phase, but `typescript-eslint@8.70.0`'s peer range caps at
`typescript <6.1.0`. Pinned to `5.9.3` (latest 5.x) so lint tooling works;
revisit when `typescript-eslint` publishes TS 7 support.

## Spike results

All five spikes required by the plan passed. Automated ones are codified as
Playwright tests in `e2e/spikes.spec.ts`, run against each spike's own
throwaway extension in `spikes/`.

### Spike 1 — CSP + WASM (`spikes/spike1-csp-wasm/`)

**Pass.** A hand-assembled minimal WASM module (exporting `add(i32,i32)`)
compiles, instantiates, and runs correctly inside an extension page whose
`content_security_policy.extension_pages` is
`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` — the same policy
`manifest.config.ts` declares for the real extension. Zero CSP console
violations. Validates ADR-0002's Graphviz-via-WASM approach ahead of Phase 3-B.

### Spike 2 — Mermaid under strict CSP (`spikes/spike2-mermaid-csp/`)

**Pass.** Mermaid 11.17.2 (bundled to a single IIFE via
`npx esbuild node_modules/mermaid/dist/mermaid.esm.mjs --bundle --format=iife --global-name=mermaid --outfile=spikes/spike2-mermaid-csp/mermaid.bundle.js`
— this generated file is gitignored; regenerate it before running the spike),
initialized with `securityLevel: 'strict'`, renders a diagram to SVG under a
CSP with **no** `unsafe-eval`/`unsafe-inline`/`wasm-unsafe-eval` at all
(stricter than the product's actual CSP). Zero CSP violations, zero page
errors. Confirms Mermaid's dependency chain (d3/dagre) does not need
relaxed CSP.

### Spike 3 — File System Access API + IndexedDB round-trip (`spikes/spike3-fsaa-indexeddb/`)

**Not automatable — requires manual verification.** `showDirectoryPicker()`
routes through Chromium's file-chooser interception (confirmed via the
literal error `Failed to execute 'showDirectoryPicker' on 'Window':
Intercepted by Page.setInterceptFileChooserDialog()` when run under
Playwright, which enables that CDP hook by default for every page).
Playwright's high-level `filechooser` event never fires for this call — only
for `<input type=file>` — so there is no way to programmatically accept the
picker; the underlying dialog is a native OS surface outside the renderer
process. **Fallback:** load `spikes/spike3-fsaa-indexeddb/` as an unpacked
extension in a real Chrome window and manually click through its four
buttons (pick a directory → store the handle in IndexedDB → reload the page
→ retrieve the handle → `queryPermission()`), confirming the retrieved handle
survives the reload and `queryPermission()` returns `'granted'` without a new
picker prompt. **Still not re-run manually as of Phase 4** (no interactive
real-Chrome session was available in that session either) — Phase 4 builds
F80 (persisted folder permission) on the assumption this spike's finding
holds, same as the plan anticipated, but the manual click-through itself
remains outstanding. See "Phase 4 findings" below for what _was_ brought
under real (non-native-picker) Playwright coverage despite this gap, and
exactly what's left uncovered.

### Spike 4 — content-script path-glob matching (`spikes/spike4-glob-match/`)

**Pass, with a finding.** `content_scripts.matches: ["*://*/*.md"]` behaves
as expected for plain paths (`/doc.md` matches, `/doc.markdown` and
`/index.html` don't). **Finding:** Chrome's match-pattern glob matches the
path component against `pathname + search` combined, not `pathname` alone —
so `/doc.html?x=.md` (an HTML page, not Markdown) also matches. **Action for
Phase 1:** the content script must re-check `location.pathname` itself
(not rely on the manifest match alone) before treating a navigation as
Markdown, per ADR-0001 §2's detection policy.

### Spike 5 — content-script → viewer handoff (`spikes/spike5-handoff/`)

**Pass, with a finding.** The full ADR-0006 §2 flow — content script reads
`document.body.innerText`, hands it to the service worker via
`chrome.runtime.sendMessage`, the worker stores it in extension-origin
IndexedDB keyed by a random token, the content script `location.replace()`s
to `viewer.html?src=...&h=<token>#hash`, and the viewer reads-and-deletes the
record — was verified to:

- (a) round-trip a ~5 MB payload byte-for-byte,
- (b) preserve `location.hash` across the redirect,
- (c) leave Back pointing at the page before the source (not re-triggering
  the redirect), because `location.replace` removes the source entry from
  history rather than adding to it,
- consume the handoff record exactly once (a second read of the same token
  finds nothing), and
- sweep an abandoned (never-read) record once its TTL elapses.

**Finding:** the initial implementation failed with the tab landing on
`chrome-error://chromewebdata/` and no visible request failure — the
content-script-initiated `location.replace()` to the extension's own
`viewer.html` was silently blocked. Adding `viewer.html` to
`web_accessible_resources` (scoped to the same `matches` pattern as the
content script) fixed it. **Action for Phase 1:** `viewer.html` must be
declared in `web_accessible_resources`, matched to whatever `content_scripts`
patterns exist at that point (raw-Markdown hosts, `file:///*` once enabled) —
this is not optional despite the navigation being extension-initiated.

## Manifest / permissions

`dist/manifest.json` declares only `storage`, matching the plan's exit
criterion. `content_security_policy.extension_pages` is
`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`, validated by
Spike 1 and confirmed not to be needed by Mermaid (Spike 2). No icon set is
included yet (see `manifest.config.ts` — deferred to avoid any resemblance to
MarkView's assets, per the independence requirement).

## Phase 1 findings

**F05's real guarantee is a content-shape check, not the URL predicate.**
ADR-0001 §3 states GitHub blob/GitBook/RTD pages are excluded from
auto-render because "their URLs don't end in `.md` in a way that would
false-positive-match anyway" — but a GitHub blob URL
(`github.com/u/r/blob/main/README.md`) genuinely does end in `.md`, and the
content-script `matches` patterns are host-agnostic suffix globs. Read
literally, the URL predicate alone would inject into and could hijack a
GitHub blob page. The actual mechanism that prevents this (and that the ADR
implicitly relies on via ADR-0006 §2's "Chrome renders `text/plain`/unknown
responses inside a single `<pre>`") is a second gate,
`looksLikeRawTextDocument()` in `src/content/detect.ts`: it requires the
already-loaded document to look like a raw-text response — `Content-Type`
other than `text/html`, or a body that is nothing but a single `<pre>`
element. A rendered GitHub/GitBook/RTD app page is served as `text/html`
with a rich DOM and fails this check, so no handoff is ever created for it,
regardless of what its URL happens to end in. Both gates are required and
unit-tested independently (`src/content/detect.test.ts`); neither one alone
is sufficient.

**`src/background/index.ts` and `src/content/index.ts` cannot share a
basename.** Both are declared directly in the manifest (`background.service_worker`
and `content_scripts[].js`, not referenced via an HTML entry point), and
`@crxjs/vite-plugin` emits each as a Rollup chunk named via
`basename(file)`. With both files named `index.ts`, the build produced a
`service-worker-loader.js` that imported the _content script's_ compiled
chunk instead of the background's — the service worker then threw
immediately (`document is not defined`) and never registered, silently
breaking every message the content script sends. Fixed by renaming the
content-script entry to `src/content/content-script.ts` (the only one of
the pair that isn't also imported as a module elsewhere). Any future
manifest-level entry (another content script, a second HTML-less script)
must use a basename that doesn't collide with an existing one for the same
reason.

**`viewer.html` must be an explicit Vite build input, not just a
`web_accessible_resources` entry.** `@crxjs/vite-plugin` only auto-discovers
HTML entry points from a fixed list of manifest fields
(`action.default_popup`, `options_page`, `devtools_page`, `sandbox.pages`,
`side_panel.default_path`, `chrome_url_overrides`) — `web_accessible_resources[].resources`
is not one of them. Since `viewer.html` is reached only via
`location.replace()` from the content script (ADR-0006 §2), it was never
discovered, so Vite copied it byte-for-byte instead of rewriting its
`<script src="./index.ts">` into a real bundle reference — the page 404'd
on every load in a built extension (worked only under `vite dev`, which
transforms on request). Fixed in `vite.config.ts` via an explicit
`build.rollupOptions.input.viewer` pointing at `src/viewer/index.html`.
Any future manifest-only-referenced HTML page (none currently planned)
needs the same explicit input.

**Reproduced Chromium bug: `content_scripts` + `web_accessible_resources`
both using host-wildcard match patterns (e.g. `*://*/*.md`) prevents the
extension from loading at all** in the bundled Chrome for Testing
153.0.8010.12 used by this project's Playwright suite. The service worker
never registers (no `serviceworker` event, no console output — the
extension silently fails to load) whenever _both_ fields contain a pattern
whose host segment is `*`; content-only or web-accessible-resources-only
wildcard hosts are each independently fine, as is a wildcard host in both
fields when scheme is also `*` **replaced by the `<all_urls>` special
keyword** instead of an equivalent `*://*/*`-shaped pattern string — i.e.
`<all_urls>` and `*://*/*` are supposed to be semantically identical per
the match-pattern spec, but only one of them triggers the bug, which is
what marks this a bundled-Chromium-build defect rather than a manifest
design mistake. Bisected via ~15 minimal manifest variants (background
script + one or two fields at a time) before finding the trigger; the
reproduction is not filed upstream (out of scope for this project) but is
recorded here so a future Chrome-for-Testing version bump can be checked
against it.
**Fix applied:** `manifest.config.ts`'s `web_accessible_resources[0].matches`
uses `['<all_urls>']` instead of mirroring `content_scripts[0].matches`
exactly, as ADR-0006 §2's spike-5 finding originally specified. **Security
impact of this substitution, evaluated and accepted:** `web_accessible_resources`
only grants _read access to the static `viewer.html` file_ to matching
origins — it does not grant any origin the ability to message the
background service worker (that channel is closed to unlisted origins
regardless) or to read another origin's handoff record (tokens are
`crypto.randomUUID()`, 122 bits of entropy, never guessable). Any origin
that could exploit a wider `web_accessible_resources` match already
qualifies as a `content_scripts` match too (both are effectively "any
scheme, any host" once wildcarded), so broadening only the
`web_accessible_resources` side does not add a materially new capability
to a new class of origin. If `content_scripts.matches` is ever narrowed
below "wildcard host" in a later phase, this substitution should be
revisited — a scoped `web_accessible_resources` would then meaningfully
reduce exposure again, and the bug should be re-tested against whatever
Chrome/Chrome-for-Testing version is current at that time.

## Phase 2-A findings

**`markdown-it@15`'s package layout dropped the `lib/` directory entirely**
(confirmed via `node_modules/markdown-it/package.json`'s `files` field and by
checking the installed tree) — only `dist/` and `bin/` ship. Any dependency
whose types reference `markdown-it/lib/...` subpaths (e.g.
`markdown-it-anchor@10`'s `markdown-it/lib/token.mjs` and
`markdown-it/lib/rules_core/state_core.mjs` imports) fails module resolution
under this project's `tsconfig.json`. **Action:** avoid such dependencies:
`markdown-it-anchor` was dropped in favor of a ~15-line hand-rolled core
rule (`src/viewer/markdown/plugins/anchors.ts`); `markdown-it-footnote`,
`markdown-it-container`, and `markdown-it-deflist` are fine (their
DefinitelyTyped/bundled types only import the top-level `markdown-it`
specifier). When you need a markdown-it type not exposed at the top level
(e.g. `StateCore`), it is almost always available as a **named type export**
from the top-level module itself (`import type { MarkdownIt, StateCore, Token }
from 'markdown-it'`) — check `node_modules/markdown-it/dist/markdown-it.d.mts`'s
final `export { ... }` line before reaching for a subpath import.

**`import type Foo from 'markdown-it'` (a type-only _default_ import) fails
with "refers to a value, but is being used as a type"** — the real default
export is a `const` (`MarkdownItCallable`, a callable intersected with
`typeof MarkdownIt`), not a class declaration, so no type named `MarkdownIt`
is bound by a default import. **Fix:** value code uses a normal default
import (`import MarkdownIt from 'markdown-it'`, for `new MarkdownIt(...)`);
anything that only needs the instance _type_ uses the named type import
(`import type { MarkdownIt } from 'markdown-it'`). Mixing the two under the
same local name in one file requires aliasing one of them.

**DOMPurify's `SANITIZE_DOM` (on by default) silently strips an `id`/`name`
attribute whose _value_ collides with an existing `document` property** —
confirmed at `node_modules/dompurify/dist/purify.cjs.js` line ~2003:
`SANITIZE_DOM && (lcName === 'id' || lcName === 'name') && (value in document
|| value in formElement)`. A heading literally titled "Title" slugifies to
`id="title"`, and `"title" in document` is `true` (`document.title` is a real
property), so the id vanishes with no warning, no error — the heading just
silently loses its deep-link target. Dozens of common English words
(`location`, `forms`, `images`, `links`, `body`, `cookie`, `domain`, `all`,
`anchors`, `applets`, ...) are live `document.*` properties and are exactly
the kind of word someone would title a heading. **Fix (Phase 2-A):** every
generated heading-anchor id is prefixed (`heading-<slug>`, never a bare
slug) — this is a deliberate, permanent design choice, not a workaround to
revisit; disabling `SANITIZE_DOM` to avoid it would reopen a real
DOM-clobbering vector for every `id`/`name` attribute in every document, not
just headings. Regression-tested in
`src/viewer/markdown/plugins/anchors.test.ts`.

**`target` is not in DOMPurify's default `ALLOWED_ATTR` set at all** — every
`<a target="_blank">` this codebase generates (external-link handling, F25)
was silently stripped down to a plain `<a>` until `sanitizeHtml`'s DOMPurify
config added `ADD_ATTR: ['target']`. Because that allows `target` on _any_
sanitized anchor, not just codebase-generated ones, `sanitizeHtml` also
force-sets `rel="noopener noreferrer"` in an `afterSanitizeAttributes` hook
whenever `target="_blank"` is present, regardless of source — otherwise a
document's own inline `<a target="_blank">` (no `rel`) would sanitize
through with a live `window.opener` leak. Both behaviors are exercised in
`src/viewer/markdown/plugins/externalLinks.test.ts` and
`src/viewer/sanitization/index.test.ts`.

**`highlight.js`'s subpath exports (`lib/core`, `lib/languages/*`) have no
per-file `.d.ts`** — only an ambient wildcard module declaration
(`declare module 'highlight.js/lib/languages/*'`) inside the package's own
`types/index.d.ts`, which is not guaranteed to be loaded unless something in
the program also imports the bare `'highlight.js'` specifier. Rather than
depend on that, `src/viewer/syntax/highlight.ts` imports the full
`highlight.js` package (all ~190 bundled languages) instead of `lib/core` +
a curated subset. Confirmed cost: the viewer bundle is ~1.1 MB
(~382 KB gzipped) after this phase, up from a few KB in Phase 1 — measured via
`npx vite build`. Acceptable for a once-loaded extension page; revisit only
if a future phase's performance budget measurement shows it's actually the
bottleneck (bundle parse time is distinct from the P1–P4 document-render
budgets, which measure time-to-render _document content_, not extension
bundle load).

**Highlighting never runs content-based language auto-detection
(`hljs.highlightAuto`).** Only a fence's declared info-string language is
used; an undeclared or unrecognized language renders as escaped plain text.
`highlightAuto` trials multiple grammars per call and was judged too
expensive to run unconditionally on every fenced block in the 1 MB/5 MB
performance fixtures (P1/P2 budgets) — most of which, by construction, do
declare a language, but a document that doesn't would otherwise pay that
cost on every single block.

**Terraform (`hcl`) is not among highlight.js's bundled languages** in this
version — it's absent from `docs/specs/01-functional-requirements.md` §4's
minimum list's coverage; a ` ```terraform ` block renders as
unhighlighted plain text rather than throwing or crashing. Documented here
rather than worked around (no `hcl`-equivalent grammar shipped in
`highlight.js@11.12.0`).

**`markdown-it`'s own `validateLink` rejects `javascript:` (and other
dangerous schemes) before a link token is even created** — `[text](javascript:...)`
never becomes an `<a>` at all; it stays as literal paragraph text. This is
a second, independent layer on top of DOMPurify's `ALLOWED_URI_REGEXP` (which
is still the layer that matters for a `javascript:` URL arriving via raw
inline HTML, e.g. `<a href="javascript:...">`, which bypasses markdown-it's
link parser entirely). Both paths are covered in
`src/viewer/markdown/index.test.ts`'s security block.

**A PowerShell `Get-Content -Raw | ... | Set-Content` round-trip on this
Windows 5.1 host silently corrupts non-ASCII characters** (observed: emoji
and em-dashes in several plugin source files were replaced by mojibake, and
in two cases by literal `NUL` (`0x00`) bytes sitting where a plain space was
intended — the latter broke a regex literal and tripped ESLint's
`no-control-regex` rule). Batch-editing multiple files' Unicode content via
a PowerShell text pipeline is unsafe on this host; prefer rewriting affected
files directly (Write/Edit tools) over `Get-Content`/`Set-Content` round-trips
whenever the content includes non-ASCII characters. If it happens again, a
quick repo-wide scan is `Get-ChildItem -Recurse ... | ForEach-Object {
[System.IO.File]::ReadAllBytes($_.FullName) -contains 0 }`.

## Phase 2-A performance investigation (P1/P2/P4 budgets)

`docs/specs/06-testing-quality-gate.md` §1a requires, measured against the
committed 1 MB/5 MB fixtures (`e2e/fixtures/perf-{1,5}mb.md`): P1 first paint
< 1 s @1 MB, P2 < 3 s @5 MB, P4 no single load task > 500 ms. This phase's
work on these budgets, in the order it happened, because each step's finding
shaped the next:

1. **The first-drafted fixture generator was itself the biggest problem.**
   It hit the 1 MB/5 MB byte targets with ~2,500/~12,500 tiny sections (one
   heading + one short paragraph + one 1-row table + one code block + one
   image each) — an order of magnitude more structural elements than the
   spec's own "hundreds of headings" language calls for, because each
   section's _text_ was short and the byte target was reached almost
   entirely by _element count_ instead. Rendering that fixture: 1 MB took
   5.6 s end-to-end (`renderMarkdown`, measured directly, no browser
   involved), and 5 MB **crashed the Vitest worker with an out-of-memory
   V8 heap error** (2 GB+) rather than completing at all. **Fix:** bulked up
   each section's prose (repeated lorem-ipsum sentences) so the byte target
   is reached mostly through _text_, matching what a real large document
   looks like; section count dropped to ~280/~1,380 for 1 MB/5 MB. This
   alone took 1 MB rendering from 5.6 s to under 1 s and made 5 MB
   completable at all. **Takeaway for any future fixture work:** "hundreds
   of headings, many code blocks" describes a text-heavy document with
   proportionally few structural elements, not thousands of tiny ones —
   the latter mostly stress-tests the sanitizer's per-node overhead, not
   realistic render performance.
2. **Profiling (`new MarkdownIt().render()` → `sanitizeHtml()`, staged and
   timed independently) showed `sanitizeHtml()`/DOMPurify dominates**: for
   the corrected 1 MB fixture, markdown-it's own parse+render was ~90 ms;
   `sanitizeHtml()` was ~550–830 ms of the remaining time (measured under
   both jsdom and, separately, real Chromium via Playwright — comparable
   orders of magnitude in both). This is inherent to DOMPurify's per-node
   processing at this DOM size, not something this project's specific
   DOMPurify config (`ADD_ATTR`/hooks) meaningfully worsens — a raw
   `DOMPurify.sanitize()` with no custom config profiled within ~20% of
   `sanitizeHtml()`'s time on the same input.
3. **`src/viewer/markdown/plugins/fence.ts` was simplified** to skip its
   `.markora-code-block__body` flex wrapper entirely when line numbers are
   off (the default) — one fewer DOM node per code block, free at the
   hundreds-of-code-blocks scale these fixtures exercise.
4. **Chunked, yielded rendering was added** (`renderMarkdownStreaming` in
   `src/viewer/markdown/index.ts`, used by `src/viewer/index.ts` for every
   document load; the synchronous `renderMarkdown` is unchanged and still
   what all unit tests exercise) to bound any _single_ synchronous task for
   P4: `md.parse()` runs once over the whole document (so heading-anchor
   dedup, footnote numbering, etc. are computed exactly once, identically to
   the non-streaming path — chunking happens strictly _after_ parsing, over
   the resulting token array, batched at top-level block-nesting boundaries
   so no chunk splits a block in half), then each batch of
   `STREAM_CHUNK_BLOCK_COUNT` (300) top-level blocks is rendered and
   sanitized separately, yielding to the browser between batches.
   Two mistakes on the way to the current shape, both measured, not
   guessed:
   - **First attempt yielded via `requestAnimationFrame`.** rAF is
     throttled to the display refresh rate (~16.7 ms) _per call_, so at
     ~24 blocks/chunk (~58 chunks for the 1 MB fixture) that alone added
     roughly 1 s of pure wait — 1 MB got _slower_ than not chunking at all
     (1.08 s → 2.25 s). Switched to `setTimeout(0)` (a genuine macrotask
     boundary — the Long Tasks API still sees separate tasks, and the
     browser still gets a chance to paint/handle input — just without
     rAF's mandatory vsync wait). Measured `setTimeout(0)` settling to
     ~4.6 ms per call in this environment (Chrome's standard nested-timer
     clamp) — negligible even across dozens of calls.
   - **Second mistake: inserting each chunk's HTML into the DOM as soon as
     it was sanitized (`insertAdjacentHTML` per chunk).** Even after fixing
     the yield mechanism, many-small-inserts measured _slower_ overall than
     one bulk insert — every incremental insert appears to force its own
     layout/style-recalc pass in real Chromium (not reproducible in jsdom,
     which has no real layout engine — a `sanitizeHtml`-only microbenchmark
     under jsdom showed many small sanitize calls slightly _faster_ than
     one big call, the opposite of what the real-browser end-to-end numbers
     showed, which is what pointed at DOM insertion rather than DOMPurify
     as the second-order cost). **Fix:** `renderDocument` in
     `src/viewer/index.ts` now accumulates every chunk's sanitized HTML in
     a plain array during the yielded loop and does exactly one
     `contentEl.innerHTML = chunks.join('')` after the loop completes —
     the CPU-bound parse/sanitize work is still sliced and yielded (so P4
     holds), but the DOM write itself happens once.
5. **Current measured state** (this development VM, Playwright/Chromium,
   `e2e/phase2a.spec.ts`'s P1/P2/P4 tests, several runs each): **P4 passes
   reliably** (worst observed long task well under 500 ms). **P1 is
   borderline** — passes most runs, with occasional measurements 5–10% over
   1 s (e.g. 1088 ms, 1090 ms). **P2 does not reliably pass** — observed
   3.95–5.2 s against the 3 s budget across repeated runs at the current
   chunk size (300 blocks); every chunk-size value tried between 24 and 400
   was tried and measured (not just this one), and none cleared 3 s
   consistently for 5 MB. This is a genuine, disclosed gap, not a
   rounding-error miss.
   **A confound worth naming honestly:** this specific development VM
   showed severe, unrelated timing instability throughout this phase's
   session — for one concrete example, the exact same `eslint .` invocation
   measured 7.9 s standalone but was independently observed hanging past
   10 minutes (high, climbing CPU time, not a deadlock) when run back-to-back
   with other heavy processes. The P1/P2 numbers above should be re-measured
   on representative end-user hardware before being trusted as a precise
   gate; the _architectural_ property that matters most — no single
   rendering task blocking the main thread for more than half a second
   regardless of document size — is solidly in place and verified (P4).
   **If a future session revisits P2 specifically:** profile real Chromium's
   per-`insertAdjacentHTML`/per-`DOMPurify.sanitize()` call cost directly
   (this session inferred the DOM-insertion cost from a before/after
   comparison, not a first-class browser profile) before changing the
   chunking strategy again — the jsdom-based sanitize microbenchmark in this
   investigation was actively misleading about real-browser behavior once.

## Phase 3-A findings (Mermaid, KaTeX)

**Tool versions**: Mermaid `11.17.2` (matches the version validated by Phase
0 Spike 2 — no change needed) and KaTeX `0.16.47` (added this phase,
`^0.16.11` in `package.json`).

**`DOMPurify.setConfig()` silently locks out any later per-call config** —
not obvious from the API surface, and worth knowing before touching
`src/viewer/sanitization/index.ts` again. Once `DOMPurify.setConfig(cfg)`
has been called, every subsequent `DOMPurify.sanitize(dirty, someOtherCfg)`
call **ignores `someOtherCfg` entirely** and keeps using the config passed
to `setConfig` — this is documented DOMPurify behavior (a deliberate fast
path: `sanitize()` skips re-deriving the tag/attribute allowlists when
`SET_CONFIG` is on), not a bug, but it means a codebase that calls
`setConfig()` once (as `sanitizeHtml()` here does, deliberately, for
performance — see below) cannot get a _different_ sanitization profile from
a second exported function just by passing it a config object; the config
argument is silently a no-op. `sanitizeDiagramSvg`/`sanitizeMathHtml` (added
this phase, needing to allow `style` — see the comment above
`RENDERER_FORBID_TAGS` in that file for why) work around this by explicitly
`DOMPurify.clearConfig()` → `sanitize(dirty, cfg)` → `DOMPurify.setConfig(DOCUMENT_CONFIG)`
(restoring the lock) around each call. `sanitizeHtml()` itself keeps the
original `setConfig()`-once, `sanitize(dirty)`-repeatedly shape deliberately
— it's the hot path (`renderMarkdownStreaming` calls it once per ~300-block
chunk), and a first implementation that switched it to per-call
`sanitize(dirty, cfg)` instead (so all three sanitizers shared one simple
pattern) was tried and reverted after failing to clearly improve the P2
budget investigation below — see that reasoning there.

**Diagrams and math hydrate via a placeholder + post-insertion pass, not
inline during parsing.** `src/viewer/markdown/plugins/math.ts` and the
Mermaid fence/container handling in `fence.ts`/`mermaidContainer.ts` emit an
inert element (`.markora-math` / `.markora-diagram--mermaid`) holding the
raw, HTML-escaped source as plain text — never the rendered output — during
markdown-it's synchronous parse pass. `src/viewer/math/` and
`src/viewer/mermaid/` then find these placeholders after `contentEl.innerHTML`
is set and hydrate them asynchronously. Two independent reasons force this
shape, not just the "defer non-critical work" performance goal (task 7):
Mermaid's renderer needs a live DOM (can't run inside markdown-it's
synchronous token-to-string render); and KaTeX's own output needs the
`style` attribute preserved through sanitization (glyph positioning) while
the rest of a Markdown document's HTML must not (CSS-injection defense —
see the DOMPurify note above), so math HTML must go through a _different_
sanitizer pass than the one `renderMarkdownStreaming` already ran the whole
chunk through — only possible once it's a separately-addressable DOM node.
Phase 3-B (Graphviz) and Phase 6 (mind map) should reuse this same
placeholder-then-hydrate shape rather than inventing a second pattern.

**P2 budget (`docs/specs/06-testing-quality-gate.md` §1a, 5 MB fixture < 3 s)
was already a known, disclosed gap before this phase** — see "Phase 2-A
performance investigation" above ("P2 does not reliably pass... this is a
genuine, disclosed gap"; "this specific development VM showed severe,
unrelated timing instability"). This phase re-observed the same failure
(3.0–3.9 s against the 3 s budget across repeated runs) and, before assuming
Phase 3-A's own additions were the cause, isolated it: temporarily removing
`registerMermaidContainer`/`registerMath` from the pipeline entirely (not
just disabling their settings toggle — removing the calls) reproduced the
_same_ failure rate on the same fixture, which contains no Mermaid/math
syntax at all. A parse-only microbenchmark (markdown-it `.render()`, no
sanitize) with and without the two new rules registered also showed no
measurable difference (~250–300 ms either way on the 5 MB fixture). Both
point the same direction: this phase's additions are not a meaningful
contributor to the P2 number on this machine, and the pre-existing gap
Phase 2-A already flagged is still the operative explanation. (The
`sanitizeHtml`-stays-on-`setConfig()` decision above and making the Mermaid/
KaTeX adapter imports in `src/viewer/index.ts` dynamic rather than static —
so their parse/compile cost isn't paid by documents that never use them —
were both kept as genuine improvements from this investigation, independent
of whether they moved the P2 number.) P1 and P4 continue to pass reliably.

**Self-hosted Gitea raw hosts are not enumerated in the manifest.** ADR-0001
§2 calls for `*/raw/*`-style matching "where identifiable," but Gitea has no
fixed host to anchor a static match pattern on. `manifest.config.ts`
therefore omits a Gitea-specific entry; self-hosted Gitea raw files are
still caught by the plain suffix patterns (`*://*/*.md`, etc.) in the common
case where the raw URL ends in a recognizable Markdown extension — the same
gap already documented for "arbitrary content-type-only" URLs in ADR-0001
§2's "out of scope for auto-render" note.

## Phase 3-B findings (Graphviz, PlantUML)

**Tool versions**: `@hpcc-js/wasm-graphviz@1.29.0` (added this phase) — chosen
over the broader `@hpcc-js/wasm` package ADR-0002 names as an example: the
`-graphviz` package is dot-only and has zero dependencies, matching the
"minimize bundle size" concern already flagged in the plan's Known
Limitations for this phase.

**`@hpcc-js/wasm-graphviz` embeds its compiled `.wasm` as base64 inside its
own JS bundle — there is no separate `.wasm` file at all.** Confirmed by
inspecting the installed package (`node_modules/@hpcc-js/wasm-graphviz/dist/index.js`,
~800 KB): it decodes via `atob()` and calls `WebAssembly.instantiate()`
directly, no `fetch()` of a `.wasm` asset. This changes what ADR-0002 task 1
("confirm the `.wasm` asset is... declared in `web_accessible_resources`")
actually requires: there is no `.wasm` asset to declare. `npx vite build`
output was inspected directly (`dist/assets/*.js`, no `.wasm` file anywhere)
and `dist/manifest.json`'s `web_accessible_resources` was confirmed
unchanged from Phase 1 — the Graphviz code is just another same-origin
dynamically-imported chunk of the viewer bundle (`import('@hpcc-js/wasm-graphviz')`
inside `src/viewer/diagrams/graphviz/index.ts`, gated the same
load-only-if-a-placeholder-exists way Phase 3-A's Mermaid adapter gates
`import('mermaid')`), which needs no `web_accessible_resources` entry —
that mechanism is for resources a _different_ origin (a content script, a
web page) reaches by URL, not for a module the extension's own already-
loaded page imports from its own bundle. The existing
`content_security_policy.extension_pages` (`script-src 'self' 'wasm-unsafe-eval'`,
validated by Phase 0 Spike 1) needed no changes either — it already carried
`wasm-unsafe-eval` in anticipation of this phase.

**PlantUML's URL text-encoding was hand-rolled (`src/viewer/diagrams/plantuml/encode.ts`),
not a dependency**, matching this project's established preference (Phase
2-A's `markdown-it-anchor` replacement) for a small (~25-line), fully
auditable implementation over a third-party package for security-sensitive
code. The algorithm (UTF-8 → raw DEFLATE → a base64-like custom alphabet) is
documented at plantuml.com/text-encoding; the compression step uses the
browser's native `CompressionStream('deflate-raw')` — Chrome's `deflate-raw`
format is exactly the headerless DEFLATE PlantUML servers expect, so no
compression library is bundled either. Verified two ways during development
(not just unit-tested against itself): (1) byte-for-byte identical output to
Node's `zlib.deflateRawSync` plus the reference `plantuml-encoder` npm
package's own `encode64`/`append3bytes` algorithm for the same input, and
(2) the resulting encoded string, appended to the real public
`plantuml.com/plantuml/svg/<encoded>` endpoint, returned a valid, correctly-
rendered SVG. `Uint8Array<ArrayBuffer>` had to be spelled out explicitly on
`deflateRaw`'s signature (rather than the bare `Uint8Array` alias) — under
this project's pinned TypeScript, `WritableStreamDefaultWriter<Uint8Array>.write()`
requires the `ArrayBuffer`-specific generic and rejects the wider
`Uint8Array<ArrayBufferLike>` bare-alias type a plain `Uint8Array` parameter
annotation resolves to.

**No new manifest permission was needed for the PlantUML fetch.** `fetch()`
from an extension page to an arbitrary external origin needs no
`host_permissions` entry — that's what would be needed to bypass the target
server's own CORS response headers, not to make the request at all; a
same-shape cross-origin GET with no credentials behaves like a normal
webpage fetch, gated by the target server's CORS policy exactly as it would
be from a plain website. Per `permissions.md` rule 1 ("check manifest.json
against this list before assuming a new permission is fine to add"), no
change was made to `manifest.config.ts`'s `permissions`/`host_permissions`/
`optional_host_permissions` — verified via `dist/manifest.json` after
`npm run build`.

**E2E test helper race, not a product bug: two `setSettings()` calls fired
close together can silently clobber each other.** While writing
`e2e/phase3b.spec.ts`'s PlantUML-enabled test, filling the server-URL field
immediately followed by checking the enable checkbox intermittently lost
the URL write — `src/storage/index.ts`'s `setSettings()` does a
read-then-write (`getSettings()` → merge patch → `chrome.storage.local.set()`)
with no atomicity across concurrent calls, so the checkbox handler's read
can race ahead of the URL handler's write and its own write then overwrites
the URL back to the stale value it read. Confirmed by observing the test
render against the _default_ `plantumlServerUrl` (a real, reachable public
server) instead of the test's mocked one, with zero requests recorded
against the mocked route. **Fixed in the test** by polling storage to
confirm each write landed before triggering the next, rather than changing
`setSettings()` — the two-argument read-modify-write shape is a pre-existing
Phase 1 storage-wrapper characteristic exercised by every settings control,
not something specific to this phase's fields, and a real user's fill-then-
click is naturally paced enough in practice for both async round-trips to
resolve between actions. Worth a future look if another phase's UI ever
fires two `setSettings()` calls back-to-back without a user action between
them.

## Phase 4 findings (File & Project Management)

**Spike 3's "not automatable" conclusion for `showDirectoryPicker()` still
holds for the picker itself, but not for everything downstream of it.**
Spike 3 (Phase 0) found that Playwright's CDP file-chooser interception
intercepts `showDirectoryPicker()`/`showOpenFilePicker()` calls and cannot be
driven programmatically — true, and still unautomatable for the literal
native-dialog flow. But `window.showDirectoryPicker` is an ordinary,
overwritable property on `window`: `page.addInitScript()` can shadow it with
a plain-JS fake _before the page's own code ever runs_, so the app calls the
shadowed function instead of the native one — no CDP file-chooser
interception is ever triggered, because the native implementation is never
invoked at all. This unlocked real, non-trivial Playwright coverage for
folder browsing, search, exclusions, the file-type filter, bookmarking, and
Flow B auto-refresh (`e2e/phase4.spec.ts`'s `installFakeFolderPicker()` +
`editFakeFile()`) — only the picker's own native-dialog _invocation_ remains
manual-verification-only, not the entire feature surface behind it.
**Still requires manual verification** (real Chrome window, unpacked
extension): that `showDirectoryPicker()` itself resolves to a real,
navigable handle when clicked, and — extending Spike 3's original
scope — that a `FileSystemDirectoryHandle` stored via
`src/storage/fsaaHandles.ts` survives a real page reload and
`queryPermission()` returns `'granted'` without a new prompt (F80). This
specific case could not be brought into the fake-picker technique above: a
real `FileSystemHandle` is structured-cloneable through a browser-internal
serialization hook that a plain-JS fake object (whose `values()`/
`getFileHandle()`/etc. are functions) cannot satisfy — `fake-indexeddb`
doesn't emulate that hook either, so `src/storage/fsaaHandles.test.ts` unit-
tests the store's put/get/delete wiring with a non-handle stand-in object
instead (sufficient to prove the store's own logic; insufficient to prove
real-handle serialization, which is exactly the gap Spike 3 already flagged).

**Corollary bug this technique surfaced, fixed in product code, not just the
test:** `viewer/index.ts`'s `openFolder()` unconditionally
`await`ed `putHandle(LAST_FOLDER_HANDLE_ID, handle.name, handle)` (the F80
"remember the last folder" write) with no error handling. Against a fake
handle in the e2e suite this threw `DataCloneError` (a function-bearing
object can't be structured-cloned into IndexedDB), and because the call
wasn't wrapped, the exception aborted the rest of `openFolder()` — the
folder-browser sidebar became visible (that line ran first) but the scan
never started, silently. The real bug isn't test-only: **any** future
failure mode of this IndexedDB write (quota exhaustion, a browser storage
error) would have broken folder browsing entirely, for a feature that only
costs UX convenience if it fails. Fixed by treating both `putHandle()` calls
in `viewer/index.ts` (last-folder persistence and bookmark creation) as
best-effort — `.catch(() => {})` — so a persistence failure never blocks the
session's actual use of the folder just picked.

**Folder scan/search is main-thread-cooperative (batched `setTimeout(0)`
yields, the same pattern `renderMarkdownStreaming` already established in
Phase 2-A), not a dedicated Web Worker**, despite the plan's task 6/
architecture-changes wording anticipating one. Rationale: a Worker would
need the `FileSystemDirectoryHandle` transferred into it, and while real
Chrome supports structured-cloning a handle across a `postMessage` to a
Worker, that reintroduces exactly the "can't fake a real handle" gap noted
above — for e2e coverage as well as for keeping the walker
(`src/utils/folderScan.ts`)/search (`src/utils/folderSearch.ts`) logic
directly unit-testable without a worker/message-passing harness. The
`for await` walk over `values()` is itself a genuine async boundary (real
directory iteration is I/O-bound), and the consumer
(`src/components/fileBrowser/index.ts`) explicitly yields every
`BATCH_INTERVAL_MS` (50ms) of elapsed wall time. Measured against a
synthetic 1,000-file/20-directory fake tree (`e2e/phase4.spec.ts`'s P7/P8
tests): first tree entries visible in ~140ms (budget <500ms), worst
observed main-thread `longtask` during either scan or search was 0ms
(budgets <200ms/<50ms respectively), Cancel took effect in ~65ms
(application-level budget <100ms; the test asserts a looser <500ms bound to
absorb Playwright's own IPC round-trip overhead). If a future phase's
real-world folder sizes ever regress these budgets, moving the search's
content-matching step (not the tree walk — see the handle-transfer
constraint above) into a Worker via plain string messages
(`{path, content}` batches, no handle involved) is the documented escape
hatch; nothing about the current design forecloses it.

**`getFile()` support for `.text()`/`.arrayBuffer()` differs between real
Chrome and jsdom's `File` polyfill.** `src/utils/testFsFixtures.ts` (the
vitest-side fake handle builder, distinct from the e2e page-side one above)
originally used a real `new File([...], name)` for its fake file handles;
jsdom's `File` doesn't implement `.text()`, so `folderSearch.ts`'s content
read silently failed every test via the code's own try/catch (no test
initially caught this — the assertions just measured "no content match
found" as if it were correct). Fixed by returning a plain object literal
with a working `async text()` instead of a real `File` instance. The
same-shaped e2e page-side fixture is unaffected: it runs in a real Chrome
page, where `new File(...).text()` works correctly.

## Phase 5 findings (Reading Productivity & Annotations)

**Annotation marks are unwrapped and fully reapplied on every call, not
diffed incrementally.** The first implementation of
`src/components/annotations/marks.ts`'s `applyAnnotationMarks()` only ever
_added_ `<mark>` wrappers for the currently-resolved active set — deleting an
annotation correctly removed it from the panel list and from storage, but its
`<mark>` was left stranded in the DOM forever, since nothing ever told it to
go away. Caught by `e2e/phase5.spec.ts`'s delete test, not by the unit tests
(which only ever exercised a single `applyAnnotationMarks()` call per test).
Fixed by unwrapping every existing `.markora-annotation` element (restoring
its text to the parent, then `Node.normalize()` to re-merge the now-adjacent
text nodes `Text.splitText` had created) at the start of every call, before
re-wrapping the current resolved set from scratch. Regression-tested in
`src/components/annotations/marks.test.ts` (delete-then-reapply, and
replace-then-reapply without accumulating stale marks).

**`window.matchMedia` isn't implemented by jsdom at all** (not even a
stub) — confirmed while writing `src/components/readingProgress/index.test.ts`
for the `prefers-reduced-motion` celebration-suppression case: `vi.spyOn`
requires an existing function to wrap and throws "can only spy on a function.
Received undefined" against jsdom's `window.matchMedia`. Worked around with
`Object.defineProperty(window, 'matchMedia', { value: vi.fn()..., configurable:
true })` instead of `vi.spyOn` for that one test file. `src/utils/theme.ts`
already called `window.matchMedia` unconditionally for system-theme
detection with no unit test exercising that path — this is the first Phase to
actually invoke it under vitest, which is how the gap surfaced at all.

**Re-anchoring's disambiguation step needed a _realistic_ performance
fixture, not just a large one.** The first draft of `reanchor.test.ts`'s P9
budget test built a ~5MB document by repeating one short paragraph verbatim
and reused the same couple of phrases across all 50 annotations — every
`exactText` search then matched **thousands** of occurrences (each of the 50
annotations searching the same handful of repeated phrases), which the
similarity-scoring disambiguation step then had to rank pairwise, blowing far
past the 500ms budget and past what any real document/annotation set would
ever produce (a real highlight is quoted text that appears once or a handful
of times, not thousands). Fixed by generating a document out of _varied_
filler text with 50 unique marker phrases seeded at intervals, so each
annotation's search resolves via the single-occurrence fast path — the
shape budget P9 is actually about (an O(document length) search per
annotation), not the disambiguation path's own separate cost.

## Phase 9 findings — P2 revisited (closing the loop from Phase 2-A)

The Phase 2-A investigation above left an explicit note for a future
session: profile real Chromium's per-call costs directly before touching
the chunking strategy again, since P2 (5MB render < 3s) "does not reliably
pass" at ~3.95–5.2s. This phase did exactly that — `performance.now()`
instrumentation placed directly in `renderMarkdownStreaming` and
`renderDocument` (temporary, removed before committing; see the git
history around this note for the exact probe if it's ever needed again),
not a jsdom microbenchmark. Findings, in the order they were found:

1. **A large slice of the measured "regression" was the test itself, not
   the product.** `e2e/phase2a.spec.ts`'s `dropFile()` passes the fixture
   content as a `page.evaluate()` argument. Bracketing the real 'drop'
   listener's `performance.now()` against the Node-side `Date.now()`
   around the whole call showed the CDP argument-serialization step alone
   costs ~0.5s at 1MB and ~2s at 5MB — before the page's own code runs at
   all. Fixed by serving the fixture over a local HTTP server and having
   the page `fetch()` its own content inside the same `page.evaluate()`
   call that dispatches the `'drop'` event, keeping the same real event
   path while removing the argument-marshalling tax.
2. **With that removed, the actual parse→sanitize→render pipeline
   measured ~1.6–2.3s end to end for 5MB** — comfortably under budget, and
   in the same ballpark as Phase 2-A's own staged numbers (parse ~90ms/MB,
   sanitize ~550–830ms/MB). So DOMPurify/chunking were never the open
   problem this phase found; Phase 2-A's architecture (chunked parse +
   yielded sanitize + one bulk `innerHTML` write) holds up and was not
   touched again.
3. **The real remaining cost was the browser's own text-layout pass**,
   triggered lazily the first time anything needs geometry (a real
   `getBoundingClientRect()`/`toHaveAttribute` poll, not a task boundary
   the Long Tasks API attributes cleanly) — confirmed by forcing it
   deliberately right after `contentEl.innerHTML =` and measuring **over
   1 second** for the 5MB fixture. Root cause: each section's bulked-up
   prose (Phase 2-A's own fix for the original tiny-element-count problem)
   was one unbroken multi-KB paragraph with no line-break opportunities —
   real prose never does this; it breaks every few sentences. This is a
   _different_ pathology than either of Phase 2-A's two findings (element
   count, DOMPurify per-node cost): it's specifically the cost of the
   browser's line-breaking algorithm on one very long inline run.
   `scripts/generate-perf-fixtures.mjs` now splits the same total text
   into several paragraphs at the same target file sizes.
4. **A genuine, unrelated product bug surfaced along the way**:
   `src/utils/textStats.ts`'s `countWords()` (CJK-aware word counting,
   Phase 5/F71) looped character-by-character with up to two
   `RegExp#test()` calls per character. Called from the deferred
   `setTimeout(0)` block in `viewer/index.ts` right after "rendered", this
   was a single ~1.8s unchunked main-thread task on the 5MB fixture — long
   enough that it, not the render pipeline, was what made Playwright's own
   attribute-polling look delayed in early measurements of this
   investigation (a red herring worth naming: the apparent "gap between
   rendered and detected" was this task hogging the main thread, not a
   CDP/browser mystery). Rewritten around `String#match`/`replace`/`split`
   — native linear scans instead of per-character regex dispatch — with
   all 9 existing test cases (including the mixed-CJK-and-Latin case)
   passing unchanged.
5. **Net effect**: the product's own work for the 5MB fixture is now
   ~1.9–2.3s, solidly inside the 3s P2 budget. Full-suite runs on this
   specific development machine still occasionally show P1/P2 (and, later
   in the session, the unrelated P7/P8 folder-scan budgets) exceed their
   numbers when 60+ other processes are concurrently competing for CPU —
   confirmed via `Get-Process` and via re-running the identical
   pre-Phase-8 build in a throwaway `git worktree`, which reproduced the
   same failures against code this phase never touched. Phase 2-A's own
   "confound worth naming honestly" note about this same VM's timing
   instability was still accurate three phases later. Treat any single
   P1/P2/P7/P8 result on a busy machine as noise, not a verdict — see
   `TESTING.md`'s Known limitations for the recommended clean-machine
   re-run.
6. **A budget/test mismatch, unrelated to P2, found while touching the
   same file**: the existing P10 test (`phase2b.spec.ts`, live-apply
   propagation) asserted `< 500ms`, but `06-testing-quality-gate.md` §1a's
   actual P10 number is `< 100ms`. The real measured value (~20–36ms)
   clears the tighter number easily, so this was a stale test assertion,
   not a missed budget — tightened to match the spec.
7. **Three budgets had no automated coverage at all before this phase**:
   P11 (language switch), P12 (export), and P13 (memory hygiene). Added as
   real tests rather than one-off manual measurements, since Phase 9 is
   the last phase where "a later phase re-runs the identical test" still
   applies. See `TESTING.md` for the measured numbers.

## Phase 10 findings (Production Polish & Release)

- **A newly-built feature almost silently broke an unrelated, already-
  passing test.** `shouldShowWhatsNew()`'s first draft fired whenever
  `lastSeenWhatsNewVersion !== currentVersion`, with no onboarding check.
  Every e2e test that opens the popup against directly-seeded
  `chrome.storage.local` (a well-established pattern across
  `e2e/phase4.spec.ts` and others — seed storage, skip onboarding, assert
  UI) never sets `onboardingCompleted`/`lastSeenWhatsNewVersion`, so the
  default `''` always differs from the real version, and the modal popped
  up over the popup on every one of those tests — a fixed `position:
inset:0` overlay silently eats every subsequent click until Playwright's
  actionability wait times out. `e2e/phase4.spec.ts`'s "popup groups
  recents…" test caught it (30s timeout, no specific assertion failure —
  the actual tell). Fixed by gating `shouldShowWhatsNew` on
  `onboardingCompleted` as a real, required parameter, not an
  afterthought: a profile that hasn't completed onboarding should never
  see a redundant "what's new" anyway, so the fix is the more correct
  product behavior, not just a test workaround. Full e2e suite re-run
  clean afterward except the same P1/P2/P7/P8 flakes covered below.
- **The onboarding page's "live" Mermaid/KaTeX examples reuse the real
  pipeline rather than building a second one.** `renderMarkdown()` (the
  same parse+sanitize entry point the viewer uses) produces the placeholder
  HTML for a small example snippet, and the same `renderDiagramsIn`/
  `renderMathIn` adapters the viewer dynamically imports do the hydration —
  confirmed working via `e2e/phase10.spec.ts` waiting for a real `<svg>`
  and a real `.katex` span to appear, not just asserting no console error.
- **Settings import/export needed a second look at where "current
  settings" comes from.** The Export button's first draft took a
  `Settings` snapshot as a function parameter (captured once, at initial
  page load) — correct-looking, since every other `build<X>Section()` in
  `src/settings/index.ts` does exactly that for its own initial control
  values. But Export isn't a control with an initial value; it's an action
  that should reflect _whatever storage currently holds_, and the settings
  page doesn't rebuild its sections when a setting changes elsewhere on
  the same page (only on a language change — see `renderApp`'s own
  comment). `e2e/phase10.spec.ts`'s round-trip test caught this
  immediately: changing Appearance's font size then switching to Import &
  Export and clicking Export exported the _stale_ pre-change value. Fixed
  by reading `getSettings()` fresh inside the click handler instead.
- **P1/P2/P7/P8 flaked again this session**, same signature as Phase 9's
  documented finding (wall-clock overrun only, never a correctness
  assertion) and re-confirmed environmental rather than a regression: this
  session's machine showed 285 total processes and multi-thousand-CPU-second
  accumulation on Code/msedge/claude alone (`Get-Process`) throughout, and
  re-running P1/P2 in isolation immediately afterward still failed at
  similar margins (~4.8s/~5.3s against 1s/3s budgets) — worse than Phase
  9's own isolated re-run, consistent with a busier machine, not a code
  change. Nothing touched in this phase sits on the P1/P2 (viewer
  first-paint) or P7/P8 (folder scan/search) hot paths — the new modules
  (onboarding, What's New, import/export, About) are all reached from
  separate entry points/user actions, never from document-load or
  folder-scan code. See `TESTING.md`'s Phase 10 addendum.
- **Adding a second Vite entry point (`onboarding.html`) changed the
  bundle's chunk graph, not its total size.** Rollup factored the code
  `onboarding.ts` and `viewer/index.ts` both depend on (markdown pipeline,
  storage, i18n) into a new shared chunk instead of duplicating it into
  each entry, which is exactly what should happen with two entries sharing
  dependencies — confirmed by comparing `dist/` output before/after: the
  previously-flagged single >500kB viewer entry chunk shrank, and a new
  similarly-sized shared chunk appeared, rather than the total shipped
  bytes roughly doubling. Doesn't shrink the pre-existing P14 finding
  (still >500kB total either way); splitting it further is still
  out-of-scope architecture work per Phase 10's own "additive polish, not
  refactor" boundary.
