# Security & Privacy Rules

Source: `docs/specs/04-security-privacy.md`, `docs/specs/03-architecture.md`
§4, `docs/adr/0002-diagram-rendering-strategy.md`,
`docs/adr/0008-mdx-handling-and-safe-degradation.md`.

1. **Sanitize everything.** Every path that turns document content into HTML
   (markdown-it output, Mermaid/Graphviz SVG, MDX-transformed content) passes
   through DOMPurify *before* it touches the DOM. No renderer, no plugin, no
   "temporary" path is exempt.
2. **No script execution from document content, ever.** No `eval`, no
   `new Function`, no MDX compiler. MDX is transformed to safe text /
   placeholder chips per ADR-0008, never compiled or executed.
3. **URL scheme allowlist.** Links, images, and any URL-bearing attribute
   accept only `http:`, `https:`, `mailto:`, relative paths, and `file:`
   (only where the user has explicitly granted file-URL access).
   `javascript:` and other script-executing schemes are always blocked.
4. **Local-only storage.** Settings, recents, bookmarks, annotations use
   `chrome.storage.local` only, via the typed wrapper in `src/storage/` —
   never `chrome.storage.sync`, never a remote store, never a raw
   `chrome.storage.*` call from a component.
5. **No telemetry.** No analytics, crash reporting, or usage-tracking SDK
   that transmits document content or identifiable data. No
   `chrome.runtime.setUninstallURL`.
6. **Network features are opt-in, disclosed, and isolated.** The only
   sanctioned exceptions are: PlantUML remote rendering (off by default,
   explicit toggle, server URL shown before enabling) and
   document-referenced subresources (an image URL literally present in the
   open document — never speculative, never carrying document content or an
   identifier). Any new feature that would send data off-device needs the
   same treatment: off by default, disclosed, its own dedicated opt-in —
   never bundled into an unrelated toggle.
7. **Strict CSP.** Extension pages avoid `unsafe-inline`/`unsafe-eval`;
   `wasm-unsafe-eval` is the one documented, deliberate exception (Graphviz
   WASM — validated by Phase 0 Spike 1, recorded in `DEVELOPMENT.md`).
8. **Mermaid runs in `securityLevel: 'strict'`**, and its rendered SVG still
   goes through DOMPurify — strict mode is a hardening layer, not a
   substitute for sanitization.
9. **No privilege escalation from content.** Markdown/HTML/diagram content
   must never be able to message the background service worker or reach
   `chrome.*` APIs directly.
