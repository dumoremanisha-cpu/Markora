import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// Every permission beyond `storage` is added by the phase that first needs
// it — see docs/specs/07-permissions-compliance.md §3. Phase 1 adds
// `host_permissions: ["file:///*"]` (inert until the user enables Chrome's
// "Allow access to file URLs" toggle) per ADR-0001 Flow A + ADR-0006 §4, and
// the content-script match patterns for ADR-0001 §2 detection. `activeTab`
// + `scripting` are added at Phase 2-B task 11 for the popup's "Render this
// page as Markdown" fallback action (07-permissions-compliance.md §2's
// `activeTab`/`scripting` rows record the four-question justification).
const REMOTE_SUFFIX_MATCHES = [
  '*://*/*.md',
  '*://*/*.markdown',
  '*://*/*.mdown',
  '*://*/*.mkd',
  '*://*/*.mdx',
  '*://*/llms.txt',
];

// Curated raw-content hosts whose Markdown URLs don't always carry a
// literal suffix (ADR-0001 §2). Self-hosted Gitea instances have no fixed
// host and are intentionally not enumerated here — their raw files are
// still caught by the suffix patterns above in the common case; the gap is
// a documented, known limitation (see DEVELOPMENT.md).
const CURATED_RAW_HOST_MATCHES = [
  '*://raw.githubusercontent.com/*',
  '*://*.gitlab.io/*',
  '*://gitlab.com/*/-/raw/*',
  '*://bitbucket.org/*/raw/*',
];

const FILE_URL_MATCHES = [
  'file:///*.md',
  'file:///*.markdown',
  'file:///*.mdown',
  'file:///*.mkd',
  'file:///*.mdx',
];

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extensionName__',
  description: '__MSG_extensionDescription__',
  default_locale: 'en',
  version: pkg.version,
  // No icon set yet — a placeholder/borrowed icon would risk the
  // independence requirement (CLAUDE.md); real icons are a later phase.
  background: {
    service_worker: 'src/backend/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_ui: {
    page: 'src/settings/index.html',
    open_in_tab: true,
  },
  // `commands` needs no entry in the `permissions` array (it produces no
  // install-time warning); "toggle-theme" is the one shortcut functional-
  // requirements.md §30 names as a chrome.commands global (the rest are
  // in-page listeners scoped to an open viewer tab, wired in
  // src/viewer/index.ts). Re-bound by the user at chrome://extensions/shortcuts.
  // Alt+Shift+D, not Ctrl+Shift+D: Chrome reserves Ctrl+Shift+D itself
  // ("Bookmark all tabs"), so `suggested_key` for that combo is silently
  // left unbound rather than handed to the extension — Alt+Shift+* isn't a
  // Chrome/OS default anywhere, so it actually fires.
  commands: {
    'toggle-theme': {
      suggested_key: { default: 'Alt+Shift+D', mac: 'Alt+Shift+D' },
      description: '__MSG_commandToggleTheme__',
    },
  },
  // activeTab + scripting: added for Phase 2-B task 11's "Render this page
  // as Markdown" popup action (F04 fallback). Four-question justification
  // recorded in docs/specs/07-permissions-compliance.md §2.
  permissions: ['storage', 'activeTab', 'scripting'],
  // unlimitedStorage (ADR-0004, Phase 4 task 14): never statically active —
  // optional_permissions means Chrome grants nothing at install time. Only
  // requested at runtime via chrome.permissions.request(), only after
  // chrome.storage.local usage crosses the warning threshold, and only on
  // the user's explicit click in Settings → Maintenance (never
  // speculatively). See docs/specs/07-permissions-compliance.md §2's
  // amendment #2.
  optional_permissions: ['unlimitedStorage'],
  // Inert unless the user has enabled "Allow access to file URLs" for this
  // extension at chrome://extensions — that toggle remains the real gate
  // (ADR-0001 Flow A, ADR-0006 §4). No http(s) host permission is added:
  // remote documents are handed off from already-loaded tab content, never
  // re-fetched by the extension (ADR-0006 §2).
  host_permissions: ['file:///*'],
  content_scripts: [
    {
      matches: [...FILE_URL_MATCHES, ...REMOTE_SUFFIX_MATCHES, ...CURATED_RAW_HOST_MATCHES],
      // Deliberately not "index.ts" — crxjs/Rollup emit background and
      // content-script entries as separate top-level chunks named by
      // basename; sharing "index.ts" with src/background/index.ts caused
      // the generated service-worker-loader.js to import the *content*
      // script's chunk instead of the background's (DEVELOPMENT.md).
      js: ['src/backend/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  // viewer.html is opened via location.replace() from the content script
  // (ADR-0006 §2 step 3) — a same-origin extension navigation that Chrome
  // otherwise silently blocks unless the target is web-accessible to the
  // matched pages (Spike 5 finding, DEVELOPMENT.md). `matches` intentionally
  // uses `<all_urls>` rather than mirroring FILE_URL_MATCHES/REMOTE_SUFFIX_
  // MATCHES/CURATED_RAW_HOST_MATCHES exactly: the tested Chrome build fails
  // to load the extension at all (service worker never registers) when
  // *both* content_scripts and web_accessible_resources declare host-
  // wildcard match patterns together — a reproduced, bisected browser bug,
  // not an architectural choice. See DEVELOPMENT.md for the reproduction
  // and the security-impact analysis of this substitution.
  web_accessible_resources: [
    {
      resources: ['src/viewer/index.html'],
      matches: ['<all_urls>'],
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
});
