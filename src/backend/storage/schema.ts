// Settings schema (ADR-0004). Every field the product has today is named and
// typed here — no free-form blobs. New fields land here, never as ad hoc
// storage keys elsewhere (ADR-0004 Consequences).

export const SCHEMA_VERSION = 1;

export type ThemeSetting = 'light' | 'dark' | 'system';

/** Shared cycle order for the theme-toggle shortcut (chrome.commands global in the background, and the in-page toolbar button in the viewer). */
export const THEME_CYCLE: ThemeSetting[] = ['light', 'dark', 'system'];

/** F69 — each individually enable/disable-able, never one bundled GFM switch. */
export interface MarkdownFeatureToggles {
  tables: boolean;
  footnotes: boolean;
  taskLists: boolean;
  definitionLists: boolean;
  frontMatter: boolean;
  containers: boolean;
  typographer: boolean;
  lineBreaks: boolean;
  /** F11/F79 — fenced ```mermaid``` blocks and `:::mermaid ... :::` containers render as diagrams. */
  mermaidDiagrams: boolean;
  /** F12 — inline `$...$` and display `$$...$$` math renders via KaTeX. */
  math: boolean;
  /** F13 — fenced ```dot```/```graphviz``` blocks render via the bundled WASM Graphviz renderer (ADR-0002). Fully offline; unlike PlantUML this needs no network opt-in. */
  graphvizDiagrams: boolean;
}

/** One of the ~14 curated highlight.js themes (F70). See src/viewer/syntax/themes.ts. */
export type HighlightThemeKey =
  | 'github'
  | 'github-dark'
  | 'monokai'
  | 'monokai-sublime'
  | 'nord'
  | 'atom-one-light'
  | 'atom-one-dark'
  | 'vs'
  | 'vs2015'
  | 'xcode'
  | 'a11y-light'
  | 'a11y-dark'
  | 'tokyo-night-light'
  | 'tokyo-night-dark';

/** F35 — curated, OS-available font stacks. See "Known limitations" in ARCHITECTURE.md's Phase 2-B entry: the spec calls for ~9 *bundled* local fonts (no CDN); sourcing bundled font binaries is deferred, so this ships as a curated system-font-stack list today, swappable for real `@font-face` assets later without another schema/UI change. */
export type FontFamilyKey =
  | 'system'
  | 'georgia'
  | 'times'
  | 'garamond'
  | 'palatino'
  | 'verdana'
  | 'trebuchet'
  | 'atkinson'
  | 'opendyslexic-fallback'
  | 'mono';

export type CodeFontFamilyKey = 'mono-system' | 'courier' | 'consolas' | 'lucida';

export type ContentWidthMode = 'centered' | 'full';

/**
 * F56 — presentation style overrides. Every color/font field defaults to
 * `''`, meaning "inherit from the active light/dark theme" rather than
 * forcing a value (`01-functional-requirements.md` §22). Autoplay's key and
 * interval live here too since they're the same "configurable, not
 * hard-coded" Presentation settings surface, even though F76 (not F56) is
 * the feature that reads them.
 */
export interface PresentationSettings {
  backgroundColor: string;
  textColor: string;
  headingColor: string;
  accentColor: string;
  /** '' = inherit from theme; otherwise one of `FontFamilyKey`. */
  fontFamily: '' | FontFamilyKey;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
  /** Single lowercase character compared case-insensitively against `event.key`. */
  autoPlayKey: string;
  autoPlayIntervalMs: number;
}

export const DEFAULT_PRESENTATION_SETTINGS: PresentationSettings = {
  backgroundColor: '',
  textColor: '',
  headingColor: '',
  accentColor: '',
  fontFamily: '',
  backgroundImageUrl: '',
  backgroundImageOpacity: 0.3,
  autoPlayKey: 'p',
  autoPlayIntervalMs: 5000,
};

/** F39/F73 — in-page (app-recordable) shortcuts only. The theme toggle is a `chrome.commands` global instead, re-bound at chrome://extensions/shortcuts (see background/index.ts, manifest.config.ts). */
export interface KeyboardShortcutSettings {
  toggleToc: string;
  toggleRawRendered: string;
  focusSearch: string;
  openPreferences: string;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutSettings = {
  toggleToc: 'Ctrl+Shift+L',
  toggleRawRendered: 'Ctrl+Shift+M',
  focusSearch: 'Ctrl+F',
  openPreferences: 'Ctrl+,',
};

export interface Settings {
  theme: ThemeSetting;
  /** "auto" resolves via chrome.i18n.getUILanguage()/navigator.languages (ADR-0007 §3, `src/i18n/locales.ts`'s `resolveLocale`). */
  language: 'auto' | string;
  /**
   * F36/F37 — global override for the *application chrome's* text direction
   * only (ADR-0007 §4). "auto" derives it from the resolved UI locale
   * (`src/utils/direction.ts`). Document content direction is a separate,
   * per-block concern (`src/viewer/markdown/plugins/rtlAuto.ts`'s
   * `dir="auto"`) and is never controlled by this field.
   */
  textDirectionOverride: 'auto' | 'ltr' | 'rtl';
  /** Reserved per ADR-0004; written once at install, never branched on in v1. */
  licenseStatus: { tier: 'free' };
  /** F54 master toggle — when false, content scripts and the viewer no-op cleanly. */
  extensionEnabled: boolean;
  /** F69 per-feature Markdown plugin toggles. Configuration-driven only until Phase 2-B's Settings → Markdown UI. */
  markdown: MarkdownFeatureToggles;
  /** F70 — configuration-driven only until Phase 2-B's Settings → Appearance UI. */
  highlightTheme: HighlightThemeKey;
  /** F10 — optional line numbers on fenced code blocks. */
  codeLineNumbers: boolean;
  /** F10 — optional line wrapping (vs. horizontal scroll) on fenced code blocks. */
  codeLineWrap: boolean;
  /** F44 — localized alert titles ("Note", "Warning", ...) vs. the literal `[!NOTE]`-style keyword. */
  alertTitleMode: 'localized' | 'literal';
  /** F25/F72 — external-link icon on text links only, never image-wrapped links. */
  externalLinkIndicator: boolean;
  /**
   * F72 — off by default; not built in Phase 2-A (security-privacy.md §6: any
   * network feature needs its own disclosed opt-in). Reserved for a future
   * phase that implements a local-only (no network fetch) hover preview.
   */
  externalLinkHoverPreview: boolean;

  // F35 typography/layout (Phase 2-B).
  fontFamily: FontFamilyKey;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  contentWidthMode: ContentWidthMode;
  codeFontFamily: CodeFontFamilyKey;
  headingScale: number;
  /**
   * F14 — off by default; the one settings field pair in the product whose
   * default materially changes network behavior (ADR-0002 PlantUML
   * section). Only ever contacted when this is explicitly true; the
   * disclosed opt-in surface lives in Settings → Privacy, naming
   * `plantumlServerUrl` before it can be turned on.
   */
  plantumlEnabled: boolean;
  /** F14 — configurable PlantUML rendering server; only ever contacted when `plantumlEnabled` is true. */
  plantumlServerUrl: string;
  /**
   * security-privacy.md §1 point 4 — off by default. When true, a remote
   * (http/https) image referenced by the open document never gets a real
   * `src`; it renders as a click-to-load placeholder instead, and export
   * falls back to linking the original URL rather than embedding it.
   * Document-relative/`file:` image sources are never affected — this is
   * about eliminating the one disclosed network exception in
   * security-privacy.md §1, not about content the extension already
   * treats as fully local.
   */
  blockRemoteImages: boolean;

  /** F73 — TOC sidebar width; also adjustable by drag. Shared by the Phase 5 annotations panel (F51) — the two occupy the same sidebar slot and are never visible at once. */
  tocSidebarWidth: number;
  showToc: boolean;
  /** Which side of the main layout the TOC/annotations utility rail renders on. Purely a visual `order` swap (`src/frontend/styles/index.css`'s `--utility-left` modifier) — the file browser's own side, storage, and keyboard behavior are unaffected. Defaults to `'right'`, matching the layout every existing install already has. */
  utilitySidebarPosition: 'left' | 'right';
  /** F16 — reading progress bar enable/disable. */
  showReadingProgress: boolean;
  /** F62 — purely cosmetic 100%-scroll celebration effect; off by default for new installs (also suppressed outright when `prefers-reduced-motion` is set, regardless of this setting). */
  readingProgressCelebration: boolean;
  /** F17 — document stats (word/char count, reading time) enable/disable. */
  showDocumentStats: boolean;
  /** F26 — lets the user turn off sticky positioning on table headers without disabling horizontal-scroll wrapping. */
  stickyTableHeaders: boolean;
  /** Scroll-spy: the TOC highlights the heading currently in view as the document scrolls. Always on until this toggle (popup Quick Controls, `new_ui/extension_popup.png`'s "Sync Scroll with TOC"); disabling it only stops the highlight — filtering and click-to-scroll are unaffected. */
  tocSyncScroll: boolean;
  /** Popup Quick Controls' "High-Contrast Readability" (`new_ui/extension_popup.png`) — strengthens text/border contrast beyond the normal theme tokens for low-vision reading, independent of light/dark theme. */
  highContrastReadability: boolean;

  // F39 keyboard shortcuts (Phase 2-B).
  shortcuts: KeyboardShortcutSettings;

  // Phase 4 — Files (F19-F23, F63-F65, F74, F80).
  /** F23/F74 — polls the open local document for external changes. Applies to both access flows (ADR-0001) and to `.txt` opened as Markdown. */
  autoRefreshEnabled: boolean;
  /** F23 — default ~2s per ADR-0001; user-configurable. */
  autoRefreshIntervalMs: number;
  /** F63 — folder names skipped during scanning/search, e.g. `node_modules`, `.git`, `dist`. */
  folderExclusions: string[];
  /** F64 — narrows the folder-browser/search file list. */
  fileTypeFilter: 'markdownOnly' | 'allSupportedText';
  /** F73 — folder-browser sidebar width; also adjustable by drag, same pattern as `tocSidebarWidth`. */
  folderBrowserSidebarWidth: number;

  // Phase 5 — Annotations (F27, ADR-0003/0004 §21).
  /** Default **on** per `01-functional-requirements.md` §21. Governs HTML/print/DOCX export (Phases 7-A/7-B); Phase 5 only owns the setting and the underlying resolved-annotation data those phases will read. */
  includeAnnotationsInExports: boolean;

  // Phase 6 — Presentation mode style + autoplay (F28, F56, F76).
  presentation: PresentationSettings;

  // Phase 7-A — Export (F30, ADR-0005). Print/PDF has no settings of its
  // own (print.css + the browser's native print dialog cover it).
  /** Off by default — an opt-in addition to the exported file, not a default expectation (`01-functional-requirements.md` §24). */
  htmlExportEmbedToc: boolean;

  // Phase 10 — Onboarding + "What's New" (F45, F52).
  /** Set once the first-run onboarding flow's Finish step runs. Also gates the very first "What's New" panel — onboarding already covers the current version, so it's seeded to that version at the same time (see `src/onboarding/index.ts`). */
  onboardingCompleted: boolean;
  /** Last extension version the "What's New" panel was shown for; `''` for a fresh install (immediately superseded by onboarding completion, never actually shown against `''`). */
  lastSeenWhatsNewVersion: string;
}

export const DEFAULT_MARKDOWN_FEATURE_TOGGLES: MarkdownFeatureToggles = {
  tables: true,
  footnotes: true,
  taskLists: true,
  definitionLists: true,
  frontMatter: true,
  containers: true,
  typographer: false,
  lineBreaks: false,
  mermaidDiagrams: true,
  math: true,
  graphvizDiagrams: true,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'auto',
  textDirectionOverride: 'auto',
  licenseStatus: { tier: 'free' },
  extensionEnabled: true,
  markdown: DEFAULT_MARKDOWN_FEATURE_TOGGLES,
  highlightTheme: 'github',
  codeLineNumbers: false,
  codeLineWrap: false,
  alertTitleMode: 'localized',
  externalLinkIndicator: true,
  externalLinkHoverPreview: false,

  fontFamily: 'system',
  fontSize: 16,
  lineHeight: 1.6,
  // Reference workspace's standard reading column. Users can still choose
  // any supported width in Settings; this affects new installs/default reset
  // only.
  contentWidth: 820,
  contentWidthMode: 'centered',
  codeFontFamily: 'mono-system',
  headingScale: 1,
  plantumlEnabled: false,
  plantumlServerUrl: 'https://www.plantuml.com/plantuml',
  blockRemoteImages: false,
  tocSidebarWidth: 240,
  showToc: true,
  utilitySidebarPosition: 'right',
  showReadingProgress: false,
  readingProgressCelebration: false,
  // Now rendered inline in the bottom status bar (new_ui/main.png) rather
  // than a floating pill — defaults on so the status bar's word-count/
  // reading-time fields aren't blank out of the box.
  showDocumentStats: true,
  stickyTableHeaders: true,
  tocSyncScroll: true,
  highContrastReadability: false,

  shortcuts: DEFAULT_KEYBOARD_SHORTCUTS,

  autoRefreshEnabled: true,
  autoRefreshIntervalMs: 2000,
  folderExclusions: ['node_modules', '.git', 'dist'],
  fileTypeFilter: 'markdownOnly',
  folderBrowserSidebarWidth: 260,

  includeAnnotationsInExports: true,

  presentation: DEFAULT_PRESENTATION_SETTINGS,

  htmlExportEmbedToc: false,

  onboardingCompleted: false,
  lastSeenWhatsNewVersion: '',
};

/** F22 — local document-open history. `sourceType` is what drives the popup's grouped display (F59) and the local-vs-remote recents-capture rule (ADR-0001 §4). */
export interface RecentEntry {
  id: string;
  title: string;
  sourceType: 'local' | 'remote';
  /** Local: file/folder-relative path or `file://` URL. Remote: the full URL. */
  identifier: string;
  /** Remote entries only — used for domain grouping (F75). */
  domain?: string;
  lastOpenedAt: number;
}

/** Soft cap on recents growth (ADR-0004), independent of the storage-quota warning path. */
export const RECENTS_CAP = 200;

/** F21 — a bookmarked local folder. The actual `FileSystemDirectoryHandle` lives in IndexedDB (`src/storage/fsaaHandles.ts`, ADR-0001 Flow B) — `chrome.storage.local` cannot serialize handles — this row is just the display metadata + the key linking to it. */
export interface FolderBookmark {
  id: string;
  name: string;
  handleId: string;
  createdAt: number;
}

/** F27, ADR-0003. */
export type AnnotationType = 'highlight' | 'underline' | 'comment';
export type AnnotationStatus = 'active' | 'orphaned';

/**
 * One user annotation, per ADR-0003's selector model (W3C Web Annotation
 * Data Model's TextQuoteSelector + TextPositionSelector pattern, implemented
 * directly — no library dependency). `status` is persisted so the last-known
 * orphaned/active state survives a reload even before re-anchoring reruns;
 * `src/viewer/annotations/reanchor.ts` recomputes it fresh on every load.
 */
export interface Annotation {
  id: string;
  /** Stable per-document key — local file path/handle name, or the normalized remote URL (scheme+host+path, query stripped). Never a content hash (ADR-0003). */
  documentId: string;
  /** The exact selected string (the "quote"). */
  exactText: string;
  /** ~32 chars of rendered plain-text context immediately before the selection. */
  prefix: string;
  /** ~32 chars of rendered plain-text context immediately after the selection. */
  suffix: string;
  /** Character offset of the selection start within the document's rendered plain-text content, at creation time. */
  charOffsetAtCreation: number;
  /** Non-cryptographic hash of the full rendered plain-text content at creation time — a re-anchoring confidence signal only, never the lookup key. */
  contentFingerprint: string;
  type: AnnotationType;
  /** Only meaningful for `type: 'comment'`. */
  commentText?: string;
  createdAt: number;
  updatedAt: number;
  status: AnnotationStatus;
}

export interface StoredData {
  schemaVersion: number;
  settings: Settings;
}

export type Migration = {
  fromVersion: number;
  migrate: (data: StoredData) => StoredData;
};

// Empty on purpose (ADR-0004): scaffolding for the first real schema change,
// not a speculative feature build-out.
export const MIGRATIONS: Migration[] = [];

export const STORAGE_KEYS = {
  schemaVersion: 'markora.schemaVersion',
  settings: 'markora.settings',
  recents: 'markora.recents',
  bookmarks: 'markora.bookmarks',
} as const;
