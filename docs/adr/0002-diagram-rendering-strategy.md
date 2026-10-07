# ADR-0002: Diagram & Math Rendering Strategy (Mermaid, Graphviz, PlantUML)

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §5–8; `docs/specs/03-architecture.md` §1, §4; `docs/specs/04-security-privacy.md`; feature matrix F11–F14, F79

## Context

Three diagram engines and one math engine must render untrusted,
attacker-controllable diagram source safely, inside an MV3 extension page
whose CSP cannot include `unsafe-eval`. Each engine has a materially
different safe-integration story that the specs describe at the requirement
level (§4–8) but not at the implementation-decision level.

## Decision

### Mermaid (F11, F79)

- Configure Mermaid with **`securityLevel: 'strict'`** (Mermaid's own
  sanitization of node text/labels, click bindings and HTML injection
  disabled), rendered **directly into the viewer DOM** (not a sandboxed
  `srcdoc` iframe).
- **Rejected: `securityLevel: 'sandbox'`** (Mermaid's built-in iframe mode).
  While marginally more isolated, it substantially complicates the required
  interactive features (inline fullscreen, zoom, pan, reset, SVG/PNG
  download — F11) because those need direct DOM/SVG access that a
  cross-origin sandboxed iframe deliberately restricts. `strict` mode plus
  the mandatory post-render step below closes the realistic gap.
- **Mandatory defense-in-depth**: run the SVG string Mermaid produces
  through the same DOMPurify sanitization step used for the main Markdown
  pipeline (`docs/specs/04-security-privacy.md` §3, "safe SVG handling")
  before insertion — `strict` mode is Mermaid's own guarantee, not a
  substitute for the project's general sanitize-before-DOM-insertion rule.
- Recognize both ```` ```mermaid ```` fences and `:::mermaid ... :::`
  containers (F79) as equivalent input to the same render path.
- Theme sync: re-render (not just re-color) on light/dark theme change,
  since Mermaid bakes theme into the generated SVG at render time; debounce
  rapid theme toggles.

### Graphviz / DOT (F13)

- Render client-side via a **WASM Graphviz build** (e.g. `@hpcc-js/wasm`),
  producing SVG, fully offline.
- The `.wasm` binary **must ship inside the extension package** (declared in
  `web_accessible_resources`), **never fetched from a CDN at runtime** — MV3's
  no-remote-code policy applies to WebAssembly binaries, not only JavaScript;
  fetching a `.wasm` module from an external host at runtime is treated the
  same as remote script loading for Chrome Web Store review purposes.
- The extension's `content_security_policy.extension_pages` must add
  `wasm-unsafe-eval` to `script-src` — required for `WebAssembly.instantiate`
  under MV3's default CSP, and is the **only** CSP relaxation this project
  makes (no `unsafe-eval`, no `unsafe-inline`, ever).
- Output SVG runs through the same DOMPurify pass as Mermaid's output before
  DOM insertion.
- Verification task (Phase 0 and Phase 3-B): confirm the chosen WASM
  library's exact CSP/bundling requirements against the current Chrome
  stable release before writing production code — WASM tooling and Chrome's
  MV3 policy enforcement both evolve, and this is the plan's single highest
  "verify before you build" item in the diagram stack.

### PlantUML (F14) — feasibility finding

**Finding: a mature, small, offline-capable client-side PlantUML renderer
does not practically exist today.** PlantUML's canonical implementation is a
large Java library; no compact WASM/JS port covers its full diagram grammar
reliably enough to meet this project's quality bar. This resolves the
spec's "prefer local/client-side rendering when technically feasible"
(`01-functional-requirements.md` §6, `03-architecture.md` §4) into a concrete
answer: **not feasible for v1.**

Decision: implement **only the opt-in remote-rendering path**, exactly as
the spec's own fallback describes:
- Off by default.
- A dedicated settings toggle (not bundled into a general "enable diagrams"
  switch) with explicit disclosure: "diagram source will be sent to
  `<server>`."
- A configurable server URL; no default public server is contacted without
  the user's explicit opt-in action.
- When disabled/unavailable, the document renders normally with a clear
  inline message in place of the diagram (never breaks the rest of the
  page) — reuses the same inline-error component as invalid-Mermaid/
  invalid-Graphviz states.
- If a genuinely production-ready client-side PlantUML renderer becomes
  available later, it is a follow-up enhancement, not a v1 blocker — noted
  as a known limitation, not a silent scope cut.

### KaTeX (F12)

- Standard client-side rendering (`katex.render`), no CSP relaxation needed
  (KaTeX does not `eval`).
- Font files (KaTeX's `.woff`/`.woff2`) are bundled with the extension and
  referenced locally — needed regardless of the general
  no-CDN-fonts stance (`04-security-privacy.md` §1) so that HTML export
  (Phase 7-A) can inline them for a fully offline, self-contained export
  file.
- Invalid LaTeX renders KaTeX's own inline error span, wrapped in the
  project's standard inline-error styling rather than left as KaTeX's raw
  default error markup, so it matches the rest of the app's error language.

## Consequences

- Three different sandboxing/CSP postures (strict+DOMPurify for Mermaid,
  WASM+CSP relaxation for Graphviz, opt-in network for PlantUML) means
  Phase 3-A and 3-B are correctly split (see the implementation plan) —
  they are not one uniform "diagrams" task.
- PlantUML's local-rendering gap is a known, documented v1 limitation, not
  an oversight — must appear in the plan's "Known limitations" for Phase 3-B
  and in the eventual product `README.md`.
- The `wasm-unsafe-eval` CSP addition is the one and only CSP exception in
  the whole product; any future feature proposing another CSP relaxation
  should be treated as a new ADR-level decision, not an incidental manifest
  edit.

## Alternatives considered

- **Mermaid `sandbox` iframe mode for all diagrams**: rejected per above —
  breaks required interactive features without a proportionate security
  gain over `strict` + DOMPurify.
- **Server-side rendering proxy for Graphviz** (matching the PlantUML
  pattern): rejected — Graphviz has a viable, mature client-side WASM path,
  so introducing a network dependency for it would be a strictly worse
  privacy/offline posture than necessary.
- **Bundling a partial/best-effort client-side PlantUML subset renderer**:
  rejected for v1 — partial diagram-type coverage would be confusing
  (some PlantUML diagrams silently unsupported while others work) and adds
  meaningful bundle size for uncertain benefit; the opt-in remote path
  already has a clear, spec-anticipated fallback story.
