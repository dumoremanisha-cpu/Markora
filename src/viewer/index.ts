// The main document viewer (extension page). Reads a handed-off document
// (ADR-0006 §2), or acquires one directly via drag-and-drop / the File
// System Access picker (ADR-0001 Flow B), and renders it through the
// parse -> sanitize -> enhance pipeline.
import { t, getActiveLocale } from '../backend/i18n';
import { formatRelativeTime } from '../backend/utils/formatRelativeTime';
import {
  addBookmark,
  addRecent,
  getBookmarks,
  onBookmarksChanged,
  onSettingsChanged,
  removeBookmark,
  renameBookmark,
  setSettings,
} from '../backend/storage';
import type { FolderBookmark, Settings } from '../backend/storage';
import { DEFAULT_KEYBOARD_SHORTCUTS, THEME_CYCLE } from '../backend/storage/schema';
import { extractDomain } from '../backend/storage/recents';
import { readAndDeleteHandoff } from '../backend/storage/handoff';
import {
  LAST_FOLDER_HANDLE_ID,
  deleteHandle,
  getHandle,
  putHandle,
} from '../backend/storage/fsaaHandles';
import type { HandleRecord } from '../backend/storage/fsaaHandles';
import { isMdxSource, renderMarkdownStreaming } from '../backend/viewer/markdown';
import { createToolbar } from '../frontend/components/toolbar';
import type { DocumentDirectionMode } from '../frontend/components/toolbar';
import { createToc } from '../frontend/components/toc';
import { createFileBrowser } from '../frontend/components/fileBrowser';
import { createSearch } from '../frontend/components/search';
import { createLightbox } from '../frontend/components/lightbox';
import { attachImageBlocking } from '../backend/viewer/images/enhance';
import { createShortcutHelp } from '../frontend/components/shortcutHelp';
import { createAboutModal } from '../frontend/components/aboutModal';
import { createOpenWorkspaceModal } from '../frontend/components/openWorkspaceModal';
import { createExportDialog } from '../frontend/components/exportDialog';
import { createPreferencesModal } from '../frontend/components/preferencesModal';
import { createAnnotationsPanel } from '../frontend/components/annotations';
import { applyAnnotationMarks } from '../frontend/components/annotations/marks';
import { createReadingProgress } from '../frontend/components/readingProgress';
import { createDocumentStats } from '../frontend/components/documentStats';
import { attachResizeHandle } from '../frontend/components/sidebar';
import { showToast } from '../frontend/components/notifications';
import { createPresentation } from '../frontend/components/presentation';
import { createMindMap } from '../frontend/components/mindmap';
import { SKELETON_THRESHOLD_CHARS, buildSkeleton } from '../frontend/components/skeleton';
import { iconDocument, iconKeyboard } from '../frontend/components/icons';
import { getAppliedTheme, initTheme, onThemeApplied, setTheme } from '../backend/utils/theme';
import { initI18nRuntime } from '../backend/utils/i18nRuntime';
import { buildTypographyCssVars } from '../backend/utils/typography';
import { formatShortcut } from '../backend/utils/shortcuts';
import {
  applyHighlightTheme,
  resolveEffectiveHighlightTheme,
  wireCodeBlockCopy,
} from '../backend/viewer/syntax';
import { startAutoRefresh } from './autoRefresh';
import type { RefreshSource } from './autoRefresh';
import {
  computeDocumentId,
  createAnnotation,
  editAnnotationComment,
  loadAndReanchor,
  removeAnnotation,
} from '../backend/viewer/annotations';
import { getPlainText, rangeToPlainTextOffsets } from '../backend/viewer/annotations/textOffsets';
import type { AnnotationType } from '../backend/storage/schema';
import type { ResolvedAnnotation } from '../backend/viewer/annotations/reanchor';
import { exportHtml } from '../backend/export/html';
import { exportDocx } from '../backend/export/docx';
import { printDocument } from '../backend/export/print';
import {
  GET_ACTIVE_DOCUMENT_MESSAGE,
  OPEN_PREFERENCES_MESSAGE,
} from '../backend/utils/activeDocumentBridge';
import type { ActiveDocumentInfo } from '../backend/utils/activeDocumentBridge';

// Dynamically imported (not a top-level static import): these pull in the
// Mermaid/KaTeX adapters, which should stay out of viewer.js's eagerly-
// parsed/compiled bundle — they're only ever invoked after first paint
// (task 7), so there's no reason for the JS engine to pay their (small but
// non-zero) parse/compile cost before that point.
function loadMermaidAdapter() {
  return import('../backend/viewer/mermaid');
}
function loadMathAdapter() {
  return import('../backend/viewer/math');
}
function loadDiagramsAdapter() {
  return import('../backend/viewer/diagrams');
}

const app = document.getElementById('app');
if (!app) throw new Error('viewer: #app not found');

let headerSourceEl: HTMLElement;
let copyButtonEl: HTMLElement;
let contentEl: HTMLElement;
let rawEl: HTMLElement;
let emptyStateEl: HTMLElement;
let emptyTitleEl: HTMLElement;
let emptyDescriptionEl: HTMLElement;
let emptyOpenFileButton: HTMLElement;
let emptyOpenFolderButton: HTMLElement;
let emptyDropHintEl: HTMLElement;
let documentViewEl: HTMLElement;
let statusBarEl: HTMLElement;
let statusBarSourceEl: HTMLElement;
let statusBarSyncEl: HTMLElement;
let statusBarSyncLabelEl: HTMLElement;
let statusBarEncodingEl: HTMLElement;
let statusBarModifiedEl: HTMLElement;
let statusBarHotkeysButton: HTMLButtonElement;
let statusBarHotkeysLabelEl: HTMLElement;
let currentSettings: Settings;
let isRawMode = false;
let rawSourceText = '';
/**
 * A real last-modified timestamp for the open document, when one actually
 * exists — a genuine `File.lastModified` from drag-and-drop or a
 * FileSystemFileHandle (Phase 17). `null` for anything without one
 * (address-bar/handoff-loaded documents: no `File` object, just fetched
 * text). `new_ui/main.png`'s title-area badge row showed a fabricated
 * "Updated 2 hours ago" with no such real data behind it — deliberately not
 * built (see Phase 12's "Explicitly not built"); this is the honest,
 * reduced version that plan flagged as worth doing instead.
 */
let currentLastModified: number | null = null;
// F36 per-document RTL override (05-ux-i18n-accessibility.md §6): session-
// only, reset to "auto" on every new document load — never persisted, and
// distinct from Settings.textDirectionOverride (the chrome-wide default).
let documentDirectionMode: DocumentDirectionMode = 'auto';

const toc = createToc();
const search = createSearch();
const lightbox = createLightbox();
const shortcutHelp = createShortcutHelp();
const aboutModal = createAboutModal();
const preferencesModal = createPreferencesModal();
const readingProgress = createReadingProgress();
const documentStats = createDocumentStats();
const presentation = createPresentation({ onClose: () => lightbox.setEnabled(true) });
const mindMap = createMindMap();
const annotationsPanel = createAnnotationsPanel({
  onCreateHighlight: (range) => void createAnnotationFromSelection('highlight', range),
  onCreateUnderline: (range) => void createAnnotationFromSelection('underline', range),
  onCreateComment: (range, commentText) =>
    void createAnnotationFromSelection('comment', range, commentText),
  onDeleteAnnotation: (id) => void deleteAnnotationAndRefresh(id),
  onEditComment: (id, commentText) => void editAnnotationAndRefresh(id, commentText),
});
let currentDocumentId = '';
/** The last-resolved active (non-orphaned) annotation set for the open document — kept in sync by `refreshAnnotations()`, read by HTML/print export (Phase 7-A) rather than each re-deriving it. */
let currentActiveAnnotations: ResolvedAnnotation[] = [];
const fileBrowser = createFileBrowser({
  onOpenFile: (handle, path, workspaceName) =>
    void loadFromFileHandle(handle, `${workspaceName}/${path}`, path, workspaceName),
  // Opens the "Open Workspace / Folder" modal (new_ui/2.png) rather than
  // going straight to the native picker — this button is reached from
  // *inside* an already-open file browser, i.e. the "add another
  // workspace" action the modal exists for. The empty state's own "Open
  // Folder" button (first-ever open, no workspace yet) still goes straight
  // to the picker below, unchanged.
  onRequestOpenFolder: () => {
    openWorkspaceModal.setBookmarks(currentBookmarks);
    openWorkspaceModal.open();
  },
  // Sidebar footer's "Open File" (`new_ui/main.png`) — the same real
  // single-file picker flow the toolbar/empty-state already use, just also
  // reachable from inside the sidebar now.
  onRequestOpenFile: () => void openFilePicker(),
  onToggleBookmarkWorkspace: (handle, name) => void toggleBookmarkForWorkspace(handle, name),
  onSelectBookmark: (bookmark) => void selectBookmark(bookmark),
  onRemoveBookmark: (id) => void removeBookmarkAndRefresh(id),
  onRenameBookmark: (id, name) => void renameBookmarkAndRefresh(id, name),
  onReconnectFolder: () => void reconnectPendingFolder(),
  onAllWorkspacesClosed: () => void forgetLastOpenedFolder(),
});
const openWorkspaceModal = createOpenWorkspaceModal({
  onBrowseDirectory: () => {
    openWorkspaceModal.close();
    void openFolderPicker();
  },
  onSelectBookmark: (bookmark) => void selectBookmark(bookmark),
  getOpenWorkspaceCount: () => fileBrowser.getOpenWorkspaceCount(),
});

// Mobile-drawer scrim (Phase 10 UI polish, Ui-prompt.md "collapse into
// drawers on smaller widths"): the sidebars' existing @media(max-width:768px)
// fixed-overlay treatment had no backdrop and no click-outside-to-close.
// Only visible at that same breakpoint (see .markora-drawer-backdrop CSS);
// harmless at desktop widths since the sidebars aren't in overlay mode there.
const drawerBackdropEl = document.createElement('div');
drawerBackdropEl.className = 'markora-drawer-backdrop';
drawerBackdropEl.addEventListener('click', () => {
  toc.hide();
  fileBrowser.hide();
  annotationsPanel.hide();
  syncPanelUi();
});

function syncDrawerBackdrop(): void {
  const anyOpen = toc.isVisible() || fileBrowser.isVisible() || annotationsPanel.isVisible();
  drawerBackdropEl.classList.toggle('markora-drawer-backdrop--visible', anyOpen);
}

// Keeps the toolbar's Files/TOC/Notes/Search toggle buttons' selected
// (pressed) visual state a pure reflection of each panel's real visibility —
// never flipped by the buttons themselves, since every one of these panels
// can also be opened/closed by a path other than its toolbar button (its own
// close control, a Settings change, Escape, mutual exclusion between TOC and
// annotations). Runs from the same observers as syncDrawerBackdrop below.
function syncToolbarPanelStates(): void {
  toolbar.setTocOpen(toc.isVisible());
  toolbar.setFileBrowserOpen(fileBrowser.isVisible());
  toolbar.setAnnotationsOpen(annotationsPanel.isVisible());
  toolbar.setSearchOpen(search.isOpen());
}

function syncPanelUi(): void {
  syncDrawerBackdrop();
  syncToolbarPanelStates();
}

// Safety net for the panels' own in-header close buttons (TOC/file-browser/
// annotations), which call each controller's internal hide() directly
// rather than through one of the syncPanelUi() call sites above — catching
// every class-list flip here means the backdrop and toolbar never get stuck
// out of sync regardless of which control opened/closed the panel.
for (const panelEl of [toc.el, fileBrowser.el, annotationsPanel.el]) {
  new MutationObserver(syncPanelUi).observe(panelEl, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
// Search uses the `hidden` attribute rather than a visibility class.
new MutationObserver(syncToolbarPanelStates).observe(search.el, {
  attributes: true,
  attributeFilter: ['hidden'],
});

let currentBookmarks: FolderBookmark[] = [];
let pendingReconnectRecord: HandleRecord | null = null;
let stopAutoRefreshFn: (() => void) | null = null;
let currentRefreshSource: RefreshSource | undefined;

let resizeCommitTimer: number | undefined;
function onTocResize(px: number): void {
  // The outline and annotations panels share one sidebar slot/width setting
  // (F51) — they're never visible at once, so keeping both in sync means
  // whichever one the user opens next already reflects the last resize.
  toc.setWidth(px);
  annotationsPanel.setWidth(px);
  window.clearTimeout(resizeCommitTimer);
  resizeCommitTimer = window.setTimeout(() => void setSettings({ tocSidebarWidth: px }), 200);
}

/** Re-anchors this document's stored annotations against its current rendered content and refreshes both the inline marks and the panel list (ADR-0003). Called after every render and after every create/edit/delete. */
async function refreshAnnotations(): Promise<void> {
  if (!currentDocumentId) return;
  const plainText = getPlainText(contentEl);
  const result = await loadAndReanchor(currentDocumentId, plainText);
  currentActiveAnnotations = result.active;
  applyAnnotationMarks(contentEl, result.active);
  annotationsPanel.render(result.active, result.orphaned);
  toolbar.setAnnotationsCount(result.active.length + result.orphaned.length);
}

async function createAnnotationFromSelection(
  type: AnnotationType,
  range: Range,
  commentText?: string,
): Promise<void> {
  if (!currentDocumentId) return;
  const plainText = getPlainText(contentEl);
  const { start, end } = rangeToPlainTextOffsets(contentEl, range);
  const exactText = plainText.slice(start, end);
  if (!exactText.trim()) return;
  await createAnnotation({
    documentId: currentDocumentId,
    plainText,
    start,
    end,
    exactText,
    type,
    commentText,
  });
  window.getSelection()?.removeAllRanges();
  showToast(t('toast.annotationCreated'), 'success');
  await refreshAnnotations();
}

async function deleteAnnotationAndRefresh(id: string): Promise<void> {
  if (!currentDocumentId) return;
  await removeAnnotation(currentDocumentId, id);
  showToast(t('toast.annotationDeleted'), 'info');
  await refreshAnnotations();
}

async function editAnnotationAndRefresh(id: string, commentText: string): Promise<void> {
  if (!currentDocumentId) return;
  await editAnnotationComment(currentDocumentId, id, commentText);
  showToast(t('toast.annotationUpdated'), 'success');
  await refreshAnnotations();
}

function onToggleAnnotations(): void {
  if (annotationsPanel.isVisible()) {
    annotationsPanel.hide();
    syncPanelUi();
    return;
  }
  annotationsPanel.show();
  syncPanelUi();
  // Mutually exclusive with the outline (F51) — same sidebar slot.
  if (currentSettings.showToc) void setSettings({ showToc: false });
}

let fileBrowserResizeCommitTimer: number | undefined;
function onFileBrowserResize(px: number): void {
  fileBrowser.setWidth(px);
  window.clearTimeout(fileBrowserResizeCommitTimer);
  fileBrowserResizeCommitTimer = window.setTimeout(
    () => void setSettings({ folderBrowserSidebarWidth: px }),
    200,
  );
}

function toggleRawRendered(): void {
  if (documentViewEl.hidden) return;
  isRawMode = !isRawMode;
  if (isRawMode) {
    rawEl.textContent = rawSourceText;
  }
  contentEl.hidden = isRawMode;
  rawEl.hidden = !isRawMode;
  toolbar.setRawMode(isRawMode);
}

function cycleTheme(): void {
  const next =
    THEME_CYCLE[(THEME_CYCLE.indexOf(currentSettings.theme) + 1) % THEME_CYCLE.length] ?? 'system';
  void setTheme(next);
}

function onOpenPresentation(): void {
  if (documentViewEl.hidden || isRawMode) return;
  presentation.applySettings(currentSettings.presentation);
  lightbox.setEnabled(false);
  presentation.open(contentEl, rawSourceText, currentSettings.markdown.frontMatter);
}

function onOpenMindMap(): void {
  if (documentViewEl.hidden || isRawMode) return;
  const label = headerSourceEl.dataset.fullSource
    ? titleFromIdentifier(headerSourceEl.dataset.fullSource)
    : t('mindmap.title');
  mindMap.open(contentEl, label);
}

function onExportHtml(): void {
  if (documentViewEl.hidden || isRawMode) return;
  void exportHtml({
    contentEl,
    sourceLabel: headerSourceEl.dataset.fullSource ?? '',
    includeAnnotations: currentSettings.includeAnnotationsInExports,
    activeAnnotations: currentActiveAnnotations,
    embedToc: currentSettings.htmlExportEmbedToc,
  });
}

function onExportPrint(): void {
  if (documentViewEl.hidden || isRawMode) return;
  void printDocument({
    contentEl,
    includeAnnotations: currentSettings.includeAnnotationsInExports,
    activeAnnotations: currentActiveAnnotations,
  });
}

function onExportDocx(): void {
  if (documentViewEl.hidden || isRawMode) return;
  void exportDocx({
    source: rawSourceText,
    isMdx: isMdxSource(headerSourceEl.dataset.fullSource ?? ''),
    markdownFeatures: currentSettings.markdown,
    sourceLabel: headerSourceEl.dataset.fullSource ?? '',
    documentId: currentDocumentId,
    includeAnnotations: currentSettings.includeAnnotationsInExports,
    blockRemoteImages: currentSettings.blockRemoteImages,
  });
}

/** `new_ui/export.png`'s "Markdown Source" card — the document's own raw
 * text, exactly as opened (front matter, table syntax, code fences and
 * all), downloaded as-is. No conversion, so no export module to reuse. */
function onExportMarkdown(): void {
  if (documentViewEl.hidden || isRawMode) return;
  const sourceLabel = headerSourceEl.dataset.fullSource ?? 'document';
  const stem = titleFromIdentifier(sourceLabel).replace(/\.[^./]+$/, '') || 'document';
  const blob = new Blob([rawSourceText], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stem}.md`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `new_ui/export.png`'s "Copy to Clipboard" card. Copies the document's
 * real raw Markdown text (not a fabricated rich-paste format) — the
 * mockup's "paste into Slack/Notion/Jira" framing implies HTML clipboard
 * data matching exportHtml()'s output, which isn't returned as a string
 * anywhere in that module today (it only ever triggers a file download
 * internally); building that round-trip is real future work, not
 * something to fake here as a plain-text copy dressed up as more than it
 * is. */
async function onCopyMarkdownToClipboard(): Promise<void> {
  if (documentViewEl.hidden || isRawMode) return;
  try {
    await navigator.clipboard.writeText(rawSourceText);
    showToast(t('export.dialog.copySuccess'), 'success');
  } catch {
    showToast(t('export.dialog.copyError'), 'error');
  }
}

const DIRECTION_CYCLE: DocumentDirectionMode[] = ['auto', 'ltr', 'rtl'];

/**
 * Forces every already-rendered block in the open document to a fixed
 * direction, or restores per-block auto-detection. `dir="auto"` on an
 * element always resolves from *that element's own* content regardless of
 * an ancestor's `dir` — so overriding here means rewriting each block's own
 * attribute (set by `rtlAuto.ts`/the alert/container/front-matter renderers,
 * all consistently `dir="auto"`), not just the container's.
 */
function applyDocumentDirectionOverride(mode: DocumentDirectionMode): void {
  const blocks = contentEl.querySelectorAll<HTMLElement>('[dir]');
  for (const block of blocks) block.dir = mode;
}

function cycleDirection(): void {
  const next = DIRECTION_CYCLE[(DIRECTION_CYCLE.indexOf(documentDirectionMode) + 1) % 3];
  documentDirectionMode = next ?? 'auto';
  applyDocumentDirectionOverride(documentDirectionMode);
  toolbar.setDirectionMode(documentDirectionMode);
}

const exportDialog = createExportDialog({
  onExportHtml,
  onExportDocx,
  onExportPrint,
  onExportMarkdown,
  onCopyToClipboard: () => void onCopyMarkdownToClipboard(),
});

const toolbar = createToolbar({
  onNavigateBack: () => void navigateHistory(-1),
  onNavigateForward: () => void navigateHistory(1),
  onToggleToc: () => void setSettings({ showToc: !currentSettings.showToc }),
  onToggleFileBrowser: () => {
    fileBrowser.toggle();
    syncPanelUi();
  },
  onToggleSearch: () => (search.isOpen() ? search.close() : search.open(contentEl)),
  onToggleRawRendered: toggleRawRendered,
  onToggleTheme: cycleTheme,
  onCycleDirection: cycleDirection,
  onToggleAnnotations,
  onOpenPresentation,
  onOpenMindMap,
  onSearchInFolder: () => {
    fileBrowser.show();
    syncPanelUi();
    fileBrowser.focusSearch();
  },
  onOpenExportDialog: () => {
    if (documentViewEl.hidden || isRawMode) return;
    exportDialog.open(headerSourceEl.dataset.fullSource ?? '');
  },
  onExportHtml,
  onExportDocx,
  onExportPrint,
  onOpenSettings: () => preferencesModal.open(currentSettings),
  onOpenShortcutHelp: () => shortcutHelp.open(currentSettings),
  onOpenAbout: () => aboutModal.open(),
});

function buildShell(): void {
  const header = document.createElement('header');
  header.className = 'markora-header';
  headerSourceEl = document.createElement('span');
  headerSourceEl.className = 'markora-header__source';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'markora-header__copy';
  copyButton.textContent = t('viewer.header.copy');
  copyButton.addEventListener('click', () => void copySource());
  copyButtonEl = copyButton;
  header.append(headerSourceEl, copyButton);

  contentEl = document.createElement('div');
  contentEl.className = 'markora-content';
  wireCodeBlockCopy(contentEl);
  lightbox.attach(contentEl);
  attachImageBlocking(contentEl);

  rawEl = document.createElement('pre');
  rawEl.className = 'markora-raw-source';
  rawEl.hidden = true;

  documentViewEl = document.createElement('div');
  documentViewEl.className = 'markora-document-view';
  documentViewEl.hidden = true;
  documentViewEl.append(header, contentEl, rawEl);

  emptyStateEl = buildEmptyState();

  // The one `<main>` landmark for the whole content area (Phase 9 a11y
  // finding): `contentEl` used to be a `<main>` on its own, but it's a
  // sibling of `emptyStateEl` inside this div, not a wrapper around it —
  // axe's "region" rule correctly flags the empty state's h1/paragraphs as
  // landmark-less whenever no document is loaded (a state no prior test
  // exercised via axe, since every existing scan drops a file first).
  // Landmark role belongs on their shared parent, not on one sibling.
  const contentArea = document.createElement('main');
  contentArea.className = 'markora-content-area';
  contentArea.append(documentViewEl, emptyStateEl);

  const mainLayout = document.createElement('div');
  mainLayout.className = 'markora-main-layout';
  // Desktop workspace follows the reference UI's reading order: files on the
  // left, the document in the centre, and the TOC/annotations in the right
  // utility rail. The TOC and annotations controllers remain mutually
  // exclusive; moving their DOM position changes presentation only, not
  // their storage, rendering, keyboard, or drawer behaviour.
  mainLayout.append(drawerBackdropEl, fileBrowser.el, contentArea, toc.el, annotationsPanel.el);
  attachResizeHandle(toc.el, {
    minWidth: 200,
    maxWidth: 480,
    initialWidth: currentSettings.tocSidebarWidth,
    onResize: onTocResize,
  });
  attachResizeHandle(annotationsPanel.el, {
    minWidth: 200,
    maxWidth: 480,
    initialWidth: currentSettings.tocSidebarWidth,
    onResize: onTocResize,
  });
  attachResizeHandle(fileBrowser.el, {
    minWidth: 200,
    maxWidth: 480,
    initialWidth: currentSettings.folderBrowserSidebarWidth,
    onResize: onFileBrowserResize,
  });
  fileBrowser.setWidth(currentSettings.folderBrowserSidebarWidth);

  // The toolbar needs its own landmark, same reasoning as the `<main>` fix
  // above for contentArea (axe's "region" rule: all page content must be
  // contained by a landmark) — it was previously appended straight to
  // `#app`, outside any landmark entirely. A plain, unstyled `<header>`
  // wrapper is a top-level "banner" landmark by default; toolbar.el keeps
  // its own `role="toolbar"` div untouched inside it.
  const toolbarLandmark = document.createElement('header');
  toolbarLandmark.className = 'markora-toolbar-landmark';
  toolbarLandmark.append(toolbar.el);

  statusBarEl = buildStatusBar();

  app!.append(
    toolbarLandmark,
    mainLayout,
    search.el,
    lightbox.el,
    shortcutHelp.el,
    aboutModal.el,
    openWorkspaceModal.el,
    exportDialog.el,
    preferencesModal.el,
    readingProgress.el,
    statusBarEl,
    presentation.el,
    mindMap.el,
  );

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    app!.classList.add('markora-dragging');
  });
  document.addEventListener('dragleave', (e) => {
    if (e.target === document.documentElement) app!.classList.remove('markora-dragging');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    app!.classList.remove('markora-dragging');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    void loadFromFile(file);
  });

  document.addEventListener('keydown', onGlobalKeyDown);
}

/** Bottom status bar (`Ui-prompt.md`/`new_ui/main.png` visual spec): every
 * field is real, derived state — the open document's source label, its
 * sync status (mirrors the same `currentRefreshSource` concept the popup's
 * Active Document card already surfaces via `activeDocumentBridge.ts`),
 * `File.text()`'s fixed UTF-8 decoding, and the word-count/reading-time
 * stats already computed by `documentStats` (moved in here rather than
 * duplicated). Hidden until a document is open; the Hotkeys button reuses
 * the existing shortcut-help modal rather than a new surface. */
function buildStatusBar(): HTMLElement {
  // <footer>, not <div>: a top-level footer is a "contentinfo" landmark by
  // default (same reasoning as toolbarLandmark's <header> above) — axe's
  // "region" rule flags any page content that isn't contained by a landmark.
  const bar = document.createElement('footer');
  bar.className = 'markora-status-bar';
  bar.hidden = true;

  const leftGroup = document.createElement('div');
  leftGroup.className = 'markora-status-bar__group';
  statusBarSourceEl = document.createElement('span');
  statusBarSourceEl.className = 'markora-status-bar__source';
  statusBarEncodingEl = document.createElement('span');
  statusBarEncodingEl.className = 'markora-status-bar__encoding';
  statusBarEncodingEl.textContent = t('viewer.statusBar.encoding');
  statusBarModifiedEl = document.createElement('span');
  statusBarModifiedEl.className = 'markora-status-bar__modified';
  statusBarModifiedEl.hidden = true;
  leftGroup.append(statusBarSourceEl, statusBarEncodingEl, statusBarModifiedEl);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'markora-status-bar__group';
  statusBarSyncEl = document.createElement('span');
  statusBarSyncEl.className = 'markora-status-bar__sync';
  const syncDot = document.createElement('span');
  syncDot.className = 'markora-status-bar__sync-dot';
  syncDot.setAttribute('aria-hidden', 'true');
  statusBarSyncLabelEl = document.createElement('span');
  statusBarSyncLabelEl.className = 'markora-status-bar__sync-label';
  statusBarSyncEl.append(syncDot, statusBarSyncLabelEl);

  statusBarHotkeysButton = document.createElement('button');
  statusBarHotkeysButton.type = 'button';
  statusBarHotkeysButton.className = 'markora-status-bar__hotkeys';
  statusBarHotkeysLabelEl = document.createElement('span');
  statusBarHotkeysLabelEl.className = 'markora-status-bar__hotkeys-label';
  statusBarHotkeysLabelEl.textContent = t('viewer.statusBar.hotkeys');
  statusBarHotkeysButton.append(iconKeyboard(), statusBarHotkeysLabelEl);
  statusBarHotkeysButton.addEventListener('click', () => shortcutHelp.open(currentSettings));

  rightGroup.append(documentStats.el, statusBarSyncEl, statusBarHotkeysButton);

  bar.append(leftGroup, rightGroup);
  updateStatusBarSync();
  return bar;
}

function updateStatusBarSync(): void {
  const synced = !!currentRefreshSource;
  statusBarSyncEl.classList.toggle('markora-status-bar__sync--offline', !synced);
  statusBarSyncLabelEl.textContent = t(
    synced ? 'popup.activeDocument.synced' : 'popup.activeDocument.unsynced',
  );
}

/** Hidden entirely (not a fake "—") when there's no real `File.lastModified` for the open document — see `currentLastModified`'s doc comment. */
function updateStatusBarModified(): void {
  if (currentLastModified === null) {
    statusBarModifiedEl.hidden = true;
    return;
  }
  statusBarModifiedEl.hidden = false;
  statusBarModifiedEl.textContent = t('viewer.statusBar.modified', {
    time: formatRelativeTime(currentLastModified, getActiveLocale()),
  });
  statusBarModifiedEl.title = new Intl.DateTimeFormat(getActiveLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(currentLastModified);
}

function onGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (shortcutHelp.isOpen()) return shortcutHelp.close();
    if (preferencesModal.isOpen()) return preferencesModal.close();
    if (lightbox.isOpen()) return lightbox.close();
    if (search.isOpen()) return search.close();
    return;
  }

  const target = event.target;
  const isEditable =
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  // Every shortcut below requires Ctrl/Cmd, so none of them can ever be a
  // character a user is trying to type — only bail out here for a bare
  // (unmodified) keystroke, which really could be normal text entry.
  // Blocking the Ctrl-combos too meant every one of them silently did
  // nothing the moment focus was inside any input/textarea (the TOC filter,
  // an annotation comment box, the file browser's search field, ...) — a
  // real source of "the shortcut doesn't work" reports that had nothing to
  // do with the shortcut itself.
  if (isEditable && !(event.ctrlKey || event.metaKey)) return;

  const combo = formatShortcut(event);
  if (combo === 'Ctrl+/') {
    event.preventDefault();
    shortcutHelp.open(currentSettings);
    return;
  }
  if (combo === currentSettings.shortcuts.toggleToc) {
    event.preventDefault();
    void setSettings({ showToc: !currentSettings.showToc });
    return;
  }
  if (combo === currentSettings.shortcuts.toggleRawRendered) {
    event.preventDefault();
    toggleRawRendered();
    return;
  }
  if (combo === currentSettings.shortcuts.focusSearch) {
    event.preventDefault();
    search.open(contentEl);
    return;
  }
  if (
    combo ===
    (currentSettings.shortcuts.openPreferences ?? DEFAULT_KEYBOARD_SHORTCUTS.openPreferences)
  ) {
    event.preventDefault();
    preferencesModal.open(currentSettings);
  }
}

function buildEmptyState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'markora-empty-state';

  const illustration = iconDocument();
  illustration.classList.add('markora-empty-state__illustration');

  const title = document.createElement('h1');
  title.textContent = t('viewer.emptyState.title');
  emptyTitleEl = title;

  const description = document.createElement('p');
  description.textContent = t('viewer.emptyState.description');
  emptyDescriptionEl = description;

  const actions = document.createElement('div');
  actions.className = 'markora-empty-state__actions';

  const openFileButton = document.createElement('button');
  openFileButton.type = 'button';
  openFileButton.textContent = t('viewer.emptyState.openFile');
  openFileButton.addEventListener('click', () => void openFilePicker());
  emptyOpenFileButton = openFileButton;

  const openFolderButton = document.createElement('button');
  openFolderButton.type = 'button';
  openFolderButton.textContent = t('viewer.emptyState.openFolder');
  openFolderButton.addEventListener('click', () => void openFolderPicker());
  emptyOpenFolderButton = openFolderButton;

  actions.append(openFileButton, openFolderButton);

  const dropHint = document.createElement('p');
  dropHint.className = 'markora-empty-state__drop-hint';
  dropHint.textContent = t('viewer.dropzone.prompt');
  emptyDropHintEl = dropHint;

  el.append(illustration, title, description, actions, dropHint);
  return el;
}

/** Persisted error state for a load failure (Phase 10 UI polish) — reuses
 * the empty state's shape/actions instead of relying only on the 4s toast,
 * so an inaccessible/invalid file leaves the user with something they can
 * still act on (Open file/folder are already right there) rather than a
 * message that has vanished by the time they look back at the screen. */
function showEmptyStateError(messageKey: string): void {
  emptyDescriptionEl.textContent = t(messageKey);
  emptyStateEl.classList.add('markora-empty-state--error');
}

function buildDisabledState(): void {
  app!.replaceChildren();
  document.body.dataset.markoraStatus = 'disabled';
  const el = document.createElement('div');
  el.className = 'markora-disabled-state';
  const title = document.createElement('h1');
  title.textContent = t('viewer.disabled.title');
  const description = document.createElement('p');
  description.textContent = t('viewer.disabled.description');
  el.append(title, description);
  app!.append(el);
}

async function copySource(): Promise<void> {
  const text = headerSourceEl.dataset.fullSource ?? headerSourceEl.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('viewer.header.copySuccess'), 'success');
  } catch {
    showToast(t('viewer.header.copyError'), 'error');
  }
}

async function renderDocument(
  text: string,
  sourceLabel: string,
  lastModified?: number,
): Promise<void> {
  emptyStateEl.hidden = true;
  emptyStateEl.classList.remove('markora-empty-state--error');
  emptyDescriptionEl.textContent = t('viewer.emptyState.description');
  documentViewEl.hidden = false;
  headerSourceEl.textContent = `${t('viewer.header.sourceLabel')}: ${sourceLabel}`;
  headerSourceEl.dataset.fullSource = sourceLabel;
  statusBarEl.hidden = false;
  statusBarSourceEl.textContent = sourceLabel;
  currentDocumentId = computeDocumentId(sourceLabel);
  currentLastModified = lastModified ?? null;
  updateStatusBarModified();

  isRawMode = false;
  rawEl.hidden = true;
  contentEl.hidden = false;
  toolbar.setRawMode(false);
  rawSourceText = text;
  search.close();

  // Large documents can take a perceptible moment even with the yielded
  // pipeline below — fill that window with a shaped placeholder instead of
  // leaving the previous/blank pane visible. Small/typical documents finish
  // fast enough that this never has a chance to be seen.
  if (text.length > SKELETON_THRESHOLD_CHARS) {
    contentEl.replaceChildren(buildSkeleton());
  }

  // The parse/render/sanitize work is done in bounded, yielded slices
  // (docs/specs/06-testing-quality-gate.md §1a budgets P1/P2/P4) so no
  // single synchronous task blows past budget — see
  // renderMarkdownStreaming's doc comment. DOM insertion itself still
  // happens once, in one assignment: incrementally inserting each chunk
  // as it's ready forces a browser layout pass per chunk, which measured
  // *slower* overall than one bulk insertion at the end.
  const chunks: string[] = [];
  const { malformed } = await renderMarkdownStreaming(
    text,
    {
      isMdx: isMdxSource(sourceLabel),
      features: currentSettings.markdown,
      codeLineNumbers: currentSettings.codeLineNumbers,
      codeLineWrap: currentSettings.codeLineWrap,
      alertTitleMode: currentSettings.alertTitleMode,
      externalLinkIndicator: currentSettings.externalLinkIndicator,
      blockRemoteImages: currentSettings.blockRemoteImages,
    },
    (chunkHtml) => chunks.push(chunkHtml),
  );
  contentEl.innerHTML = chunks.join('');
  documentDirectionMode = 'auto';
  toolbar.setDirectionMode('auto');
  lightbox.attach(contentEl);
  attachImageBlocking(contentEl);
  annotationsPanel.attachSelectionToolbar(contentEl);
  annotationsPanel.attachMarkClicks(contentEl);
  // e2e test hook only (Phase 1 §8) — not read by any product code.
  document.body.dataset.markoraStatus = malformed ? 'rendered-malformed' : 'rendered';
  if (malformed) showToast(t('viewer.error.malformed'), 'warning');
  else showToast(t('toast.success.documentLoaded'), 'success');

  scrollToFragmentIfPresent();

  // Deferred to the next task: the TOC (and, added in Phase 5, reading
  // progress/stats/annotations) are enhancements over the already-painted
  // content, not part of it, so populating them shouldn't sit on the
  // critical path the P1/P2/P4 budgets measure (docs/specs/06-testing-
  // quality-gate.md §1a) — on the ~8,300-heading P2 stress fixture this
  // moved several hundred ms off the "rendered" status's wall-clock time.
  window.setTimeout(() => {
    toc.refresh(contentEl);
    documentStats.update(getPlainText(contentEl));
    readingProgress.refresh();
    void refreshAnnotations();
  }, 0);

  // Diagrams/math hydrate after the surrounding text is already painted
  // (Phase 3-A task 7, P5 budget) — same "not part of first paint" reasoning
  // as the TOC above, and each has its own not-on-the-critical-path engine
  // load (Mermaid/KaTeX/Graphviz-WASM fetched lazily, only for documents
  // that actually use them; PlantUML's adapter has no engine to load but
  // still only fires its network request from here, never earlier).
  window.setTimeout(() => {
    void loadMermaidAdapter().then((m) => m.renderDiagramsIn(contentEl, getAppliedTheme()));
    void loadMathAdapter().then((m) => m.renderMathIn(contentEl));
    void loadDiagramsAdapter().then((m) => {
      void m.renderGraphvizIn(contentEl);
      void m.renderPlantumlIn(contentEl, {
        enabled: currentSettings.plantumlEnabled,
        serverUrl: currentSettings.plantumlServerUrl,
      });
    });
  }, 0);
}

/** F60: a `#fragment` carried through the handoff (or present on direct navigation) scrolls to and highlights the matching heading on load. */
function scrollToFragmentIfPresent(): void {
  const raw = location.hash.slice(1);
  if (!raw) return;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    id = raw;
  }
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView();
  target.classList.add('markora-anchor-target');
  window.setTimeout(() => target.classList.remove('markora-anchor-target'), 2000);
}

function titleFromIdentifier(identifier: string): string {
  const clean = identifier.split(/[?#]/)[0] ?? identifier;
  const parts = clean.split('/');
  return parts[parts.length - 1] || clean;
}

interface LoadMeta {
  recent?: { sourceType: 'local' | 'remote'; identifier: string; domain?: string };
  refreshSource?: RefreshSource;
  activeFilePath?: string | null;
  activeWorkspaceName?: string | null;
  /** Toolbar back/forward (F48): re-runs whatever load produced this document (re-reading a file handle, re-reading a dropped File, or replaying a handoff's already-fetched text) without touching recent-documents/auto-refresh bookkeeping twice — `navigateHistory` below calls this with history recording suppressed. Omitted only for loads that must never become a history stop (currently none — every real "open" path provides one). */
  historyReplay?: () => Promise<void>;
}

/** Toolbar back/forward (F48) — an in-app stack of successfully opened documents, independent of `window.history`/the URL (this is a single extension page, not a multi-page app, so the browser's own back/forward has nothing to navigate between). Each entry's `replay()` re-runs the exact load that produced it; navigating never re-pushes (see `isReplayingHistory` below), and opening anything new past the current point in the stack discards whatever "forward" entries existed. */
interface NavHistoryEntry {
  replay: () => Promise<void>;
}
const navHistory: NavHistoryEntry[] = [];
let navIndex = -1;
let isReplayingHistory = false;

function updateNavButtons(): void {
  toolbar.setNavigationState(navIndex > 0, navIndex < navHistory.length - 1);
}

async function navigateHistory(delta: number): Promise<void> {
  const targetIndex = navIndex + delta;
  const entry = navHistory[targetIndex];
  if (!entry) return;
  navIndex = targetIndex;
  isReplayingHistory = true;
  try {
    await entry.replay();
  } finally {
    isReplayingHistory = false;
    updateNavButtons();
  }
}

/** Runs after every successful document render: records it in "recent documents" (F22/F59, gated per ADR-0001 §4 by the caller), (re)starts auto-refresh for the right access flow (F23), syncs the folder browser's active-file highlight (F64), and records the back/forward history stop (F48). */
async function afterDocumentLoaded(meta: LoadMeta): Promise<void> {
  if (meta.recent) {
    void addRecent({
      id: crypto.randomUUID(),
      title: titleFromIdentifier(meta.recent.identifier),
      sourceType: meta.recent.sourceType,
      identifier: meta.recent.identifier,
      domain: meta.recent.domain,
      lastOpenedAt: Date.now(),
    });
  }
  restartAutoRefresh(meta.refreshSource);
  fileBrowser.setActiveFile(meta.activeWorkspaceName ?? null, meta.activeFilePath ?? null);
  if (meta.historyReplay && !isReplayingHistory) {
    // A fresh navigation from partway back in the stack discards whatever
    // used to be "forward" of it — same semantics as a browser tab.
    navHistory.splice(navIndex + 1);
    navHistory.push({ replay: meta.historyReplay });
    navIndex = navHistory.length - 1;
  }
  updateNavButtons();
}

/** (Re)starts polling for the given source, replacing any previous poll — a new document load always supersedes the old one's auto-refresh, never stacks. */
function restartAutoRefresh(source: RefreshSource | undefined): void {
  currentRefreshSource = source;
  updateStatusBarSync();
  stopAutoRefreshFn?.();
  stopAutoRefreshFn = null;
  if (!source || !currentSettings.autoRefreshEnabled) return;
  stopAutoRefreshFn = startAutoRefresh(source, {
    intervalMs: currentSettings.autoRefreshIntervalMs,
    onChanged: (text, lastModified) => {
      const scrollY = window.scrollY;
      const label = headerSourceEl.dataset.fullSource ?? '';
      void renderDocument(text, label, lastModified).then(() => window.scrollTo(0, scrollY));
    },
    // Transient fetch/read failures (a momentary file-lock, a dropped
    // connection) shouldn't spam a toast on every ~2s poll; the next
    // successful poll recovers silently.
    onError: () => {},
  });
}

async function loadFromHandoff(token: string): Promise<void> {
  const record = await readAndDeleteHandoff(token);
  if (!record) {
    document.body.dataset.markoraStatus = 'no-record';
    showToast(t('viewer.error.noHandoffRecord'), 'error');
    showEmptyStateError('viewer.error.noHandoffRecord');
    return;
  }
  await renderDocument(record.text, record.url);
  const isLocal = record.url.startsWith('file://');
  await afterDocumentLoaded({
    recent:
      isLocal || record.hints.addressBarEntered
        ? {
            sourceType: isLocal ? 'local' : 'remote',
            identifier: record.url,
            domain: isLocal ? undefined : extractDomain(record.url),
          }
        : undefined,
    refreshSource: isLocal ? { kind: 'fileUrl', url: record.url } : undefined,
    // The handoff token itself is single-use (already deleted above), but
    // the text it resolved to isn't — replaying just re-renders that same
    // snapshot rather than trying to re-consume a token that's gone.
    historyReplay: () => renderDocument(record.text, record.url),
  });
}

/** Drag-and-drop (F06) — no FileSystemFileHandle is available from a DataTransfer File, so this route can't auto-refresh (known limitation, documented in ARCHITECTURE.md). */
async function loadFromFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    await renderDocument(text, file.name, file.lastModified);
    await afterDocumentLoaded({
      recent: { sourceType: 'local', identifier: file.name },
      // Re-reads the same in-memory File on replay rather than caching its
      // text separately — a dropped File stays a valid Blob reference for
      // as long as this page holds onto it.
      historyReplay: () => loadFromFile(file),
    });
  } catch {
    showToast(t('viewer.error.readFailed'), 'error');
    // Only take over the screen with a persisted error when there's nothing
    // already open to protect — a failed load while a document is showing
    // must never hide that working document.
    if (documentViewEl.hidden) showEmptyStateError('viewer.error.readFailed');
  }
}

/** FSAA single-file picker (ADR-0001 Flow B) and folder-browser file clicks (F19) both go through here — both have a real handle, so both get Flow B auto-refresh. */
async function loadFromFileHandle(
  handle: FileSystemFileHandle,
  identifier: string,
  activeFilePath: string | null = null,
  activeWorkspaceName: string | null = null,
): Promise<void> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    await renderDocument(text, identifier, file.lastModified);
    await afterDocumentLoaded({
      recent: { sourceType: 'local', identifier },
      refreshSource: { kind: 'fileHandle', handle },
      activeFilePath,
      activeWorkspaceName,
      // Re-reads the handle fresh on replay (picks up any on-disk edit made
      // while the user was elsewhere in the stack) rather than caching text.
      historyReplay: () =>
        loadFromFileHandle(handle, identifier, activeFilePath, activeWorkspaceName),
    });
  } catch {
    showToast(t('viewer.error.readFailed'), 'error');
    if (documentViewEl.hidden) showEmptyStateError('viewer.error.readFailed');
  }
}

async function openFilePicker(): Promise<void> {
  try {
    const handles = await window.showOpenFilePicker({
      types: [
        {
          description: 'Markdown',
          accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx'] },
        },
      ],
    });
    const handle = handles[0];
    if (!handle) return;
    await loadFromFileHandle(handle, handle.name);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    showToast(t('viewer.error.pickerFailed'), 'error');
  }
}

// --- Folder browsing / multi-workspace (F19-F21, F63-F65, F80) ---
// F19/F80 originally opened one folder at a time, replacing whatever was
// open. `new_ui/2.png`/`5.png`'s workspace model keeps every opened folder
// open side by side — this adds a workspace rather than replacing one, and
// with zero previously open (the common single-folder case every existing
// test exercises) that is observably identical to the old behavior.

async function openWorkspace(handle: FileSystemDirectoryHandle): Promise<void> {
  if (fileBrowser.isWorkspaceOpen(handle.name)) {
    showToast(t('toast.workspaceAlreadyOpen', { name: handle.name }), 'info');
    return;
  }
  fileBrowser.show();
  syncPanelUi();
  fileBrowser.hideReconnectBanner();
  pendingReconnectRecord = null;
  // Best-effort: a failure here (e.g. IndexedDB unavailable, or in-memory
  // pressure) should never block browsing the folder the user just picked —
  // it only costs the F80 "remember for next time" convenience, not this
  // session's use of it. Only the most-recently-opened workspace is
  // remembered for the silent bootstrap reconnect below — restoring the
  // *full* set of open workspaces across a browser restart would need its
  // own persisted list, deferred rather than half-built here.
  await putHandle(LAST_FOLDER_HANDLE_ID, handle.name, handle).catch(() => {});
  await fileBrowser.addWorkspace(handle, handle.name);
}

/** Closing every open workspace (one at a time, or via "Clear All") must actually mean "empty" — including after a reload, not just until the next silent-reconnect bootstrap check picks the last-opened folder back up. Best-effort, same reasoning as `openWorkspace`'s own `putHandle` call: a storage failure here shouldn't block the close the user just performed. */
async function forgetLastOpenedFolder(): Promise<void> {
  await deleteHandle(LAST_FOLDER_HANDLE_ID).catch(() => {});
  pendingReconnectRecord = null;
  fileBrowser.hideReconnectBanner();
}

async function openFolderPicker(): Promise<void> {
  try {
    const handle = await window.showDirectoryPicker();
    await openWorkspace(handle);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    showToast(t('toast.folderPickerFailed'), 'error');
  }
}

async function toggleBookmarkForWorkspace(
  handle: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  // Best-effort match by name only — two different folders sharing a name
  // are indistinguishable this way (a documented, known limitation; see
  // ARCHITECTURE.md). A full identity check would need
  // FileSystemHandle.isSameEntry() against every bookmark's stored handle.
  const existing = currentBookmarks.find((b) => b.name === name);
  if (existing) {
    currentBookmarks = await removeBookmark(existing.id);
    showToast(t('toast.bookmarkRemoved'), 'info');
  } else {
    const handleId = crypto.randomUUID();
    await putHandle(handleId, name, handle).catch(() => {});
    currentBookmarks = await addBookmark({
      id: crypto.randomUUID(),
      name,
      handleId,
      createdAt: Date.now(),
    });
    showToast(t('toast.bookmarkAdded'), 'success');
  }
  fileBrowser.setBookmarks(currentBookmarks);
}

async function removeBookmarkAndRefresh(id: string): Promise<void> {
  currentBookmarks = await removeBookmark(id);
  fileBrowser.setBookmarks(currentBookmarks);
}

async function renameBookmarkAndRefresh(id: string, name: string): Promise<void> {
  currentBookmarks = await renameBookmark(id, name);
  fileBrowser.setBookmarks(currentBookmarks);
}

/** A bookmark click is itself the user gesture, so requesting permission (not just querying it) here is safe and matches F80's "Reconnect" intent — no separate confirmation step needed. */
async function selectBookmark(bookmark: FolderBookmark): Promise<void> {
  const record = await getHandle(bookmark.handleId);
  if (!record) {
    showToast(t('viewer.error.readFailed'), 'error');
    return;
  }
  const query = await record.handle.queryPermission?.({ mode: 'read' });
  if (query === 'granted') {
    await openWorkspace(record.handle);
    return;
  }
  const requested = await record.handle.requestPermission?.({ mode: 'read' });
  if (requested === 'granted') await openWorkspace(record.handle);
  else showToast(t('toast.folderPermissionDenied'), 'error');
}

/** Silent (query-only, no prompt) reconnect attempt for the last-opened folder at bootstrap — Chrome does not guarantee permission survives every restart (ADR-0001 Flow B), so a `false` return means the "Reconnect" banner takes over instead of a forced re-pick. */
async function trySilentReconnect(record: HandleRecord): Promise<boolean> {
  const query = await record.handle.queryPermission?.({ mode: 'read' });
  if (query !== 'granted') return false;
  await openWorkspace(record.handle);
  return true;
}

/** The "Reconnect folder" button click is the user gesture that makes `requestPermission()` valid here. */
async function reconnectPendingFolder(): Promise<void> {
  const record = pendingReconnectRecord;
  if (!record) return;
  const requested = await record.handle.requestPermission?.({ mode: 'read' });
  if (requested === 'granted') {
    await openWorkspace(record.handle);
  } else {
    showToast(t('toast.folderPermissionDenied'), 'error');
  }
}

/** F81 live-apply: pure CSS custom properties + attribute/class toggles only — no re-parse, per the P10 budget (docs/specs/06-testing-quality-gate.md §1a). Markdown-feature/highlight-theme/code-line settings intentionally do not live-apply (they'd require a re-parse); they take effect the next time a document is (re)loaded. */
function applyLiveSettings(settings: Settings): void {
  const vars = buildTypographyCssVars(settings);
  for (const [name, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(name, value);
  }
  document.documentElement.dataset.contentWidthMode = settings.contentWidthMode;
  document.documentElement.classList.toggle(
    'markora-no-sticky-tables',
    !settings.stickyTableHeaders,
  );
  document.documentElement.classList.toggle(
    'markora-utility-sidebar-left',
    settings.utilitySidebarPosition === 'left',
  );
  if (settings.showToc) {
    toc.show();
    // Mutually exclusive with the annotations panel — same sidebar slot (F51).
    annotationsPanel.hide();
  } else {
    toc.hide();
  }
  toc.setSyncScrollEnabled(settings.tocSyncScroll);
  syncPanelUi();
  readingProgress.setCelebrationEnabled(settings.readingProgressCelebration);
  if (settings.showReadingProgress) readingProgress.show();
  else readingProgress.hide();
  if (settings.showDocumentStats) documentStats.show();
  else documentStats.hide();
  fileBrowser.setFilterSettings({
    fileTypeFilter: settings.fileTypeFilter,
    exclusions: settings.folderExclusions,
  });
}

/**
 * F37/F81 live language switching. Two distinct problems, one fix: (1) the
 * viewer's chrome components (toolbar, toc, search, ...) are constructed at
 * module load time — before `initI18nRuntime()`'s async catalog fetch can
 * possibly resolve — so a non-English configured language would otherwise
 * render in English until the *next* change; (2) a language switch made
 * while the viewer is already open must update every surface without a
 * reload. Both are fixed by calling this once right after the first locale
 * resolves, and again on every subsequent change — unlike the popup/settings
 * pages, the viewer can't just tear down and rebuild (it would lose the
 * loaded document, scroll position, and annotation/search/TOC state), so
 * each component gets its own targeted `refreshLocale()` instead.
 */
function refreshLocaleAcrossComponents(): void {
  if (headerSourceEl.dataset.fullSource) {
    headerSourceEl.textContent = `${t('viewer.header.sourceLabel')}: ${headerSourceEl.dataset.fullSource}`;
  }
  copyButtonEl.textContent = t('viewer.header.copy');
  emptyTitleEl.textContent = t('viewer.emptyState.title');
  emptyDescriptionEl.textContent = t('viewer.emptyState.description');
  emptyOpenFileButton.textContent = t('viewer.emptyState.openFile');
  emptyOpenFolderButton.textContent = t('viewer.emptyState.openFolder');
  emptyDropHintEl.textContent = t('viewer.dropzone.prompt');
  statusBarEncodingEl.textContent = t('viewer.statusBar.encoding');
  statusBarHotkeysLabelEl.textContent = t('viewer.statusBar.hotkeys');
  updateStatusBarSync();
  updateStatusBarModified();
  toolbar.refreshLocale();
  toc.refreshLocale();
  search.refreshLocale();
  lightbox.refreshLocale();
  shortcutHelp.refreshLocale();
  aboutModal.refreshLocale();
  openWorkspaceModal.refreshLocale();
  exportDialog.refreshLocale();
  preferencesModal.refreshLocale();
  readingProgress.refreshLocale();
  documentStats.refreshLocale();
  presentation.refreshLocale();
  mindMap.refreshLocale();
  annotationsPanel.refreshLocale();
  fileBrowser.refreshLocale();
}

/**
 * Answers the popup's "Active Document" card (`new_ui/extension_popup.png`)
 * with real, live state — never a fixture. `open: false` when no document is
 * loaded yet, including before `bootstrap()` finishes.
 *
 * Includes this tab's own id/window via `chrome.tabs.getCurrent()` — the
 * only permission-free way for the popup to learn them. This project
 * deliberately never requests the `tabs` permission (permissions.md rule
 * 4), so `chrome.tabs.query({ url })` silently returns tabs with no `url`
 * field at all and can never match — a real, confirmed bug found via live
 * testing (not a hypothetical): `focusOrOpenViewer()`'s query for an
 * already-open viewer tab always came back empty, so it always opened a
 * redundant new tab instead of focusing the existing one. Broadcasting via
 * `chrome.runtime.sendMessage` (received by every extension page, no
 * permission needed) and asking the tab to report its own identity via
 * `chrome.tabs.getCurrent()` (also permission-free) sidesteps the whole
 * problem.
 */
async function getActiveDocumentInfo(): Promise<ActiveDocumentInfo> {
  const tab = await chrome.tabs.getCurrent();
  const identity = { tabId: tab?.id, windowId: tab?.windowId };
  if (!currentDocumentId) return { open: false, ...identity };
  return {
    open: true,
    sourceLabel: headerSourceEl.dataset.fullSource ?? '',
    byteSize: new Blob([rawSourceText]).size,
    synced: !!currentRefreshSource,
    ...identity,
  };
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type === GET_ACTIVE_DOCUMENT_MESSAGE) {
    void getActiveDocumentInfo().then(sendResponse);
    return true; // keep the message channel open for the async sendResponse above
  }
  if (message?.type === OPEN_PREFERENCES_MESSAGE) {
    preferencesModal.open(currentSettings);
    sendResponse(true);
    return false;
  }
  return undefined;
});

async function bootstrap(): Promise<void> {
  const settings = await initI18nRuntime(refreshLocaleAcrossComponents);
  currentSettings = settings;
  if (!settings.extensionEnabled) {
    buildDisabledState();
    return;
  }

  await initTheme();
  void applyHighlightTheme(
    resolveEffectiveHighlightTheme(settings.highlightTheme, getAppliedTheme()),
  );
  buildShell();
  refreshLocaleAcrossComponents();
  applyLiveSettings(settings);

  // Mermaid bakes its theme into the generated SVG at render time, so a
  // theme change re-renders (not just re-colors) every diagram already on
  // screen — debounced against rapid toggles inside resyncMermaidTheme
  // itself (ADR-0002). Dynamically imported: before any diagram exists,
  // there's nothing to resync, so the Mermaid adapter chunk shouldn't load
  // just because the theme changed once at bootstrap.
  onThemeApplied((mode) => {
    void loadMermaidAdapter().then((m) => {
      m.resyncMermaidTheme(contentEl, mode);
      presentation.refresh(contentEl);
    });
    // Phase 16 fix: previously only resolved/applied at boot (see
    // applyHighlightTheme's own doc comment for the full mechanism bug) —
    // toggling the app theme live now re-resolves the *effective* highlight
    // theme too, so an untouched 'github' default still pairs with dark
    // mode after a live toggle, not just after a fresh page load.
    void applyHighlightTheme(resolveEffectiveHighlightTheme(currentSettings.highlightTheme, mode));
  });

  presentation.applySettings(settings.presentation);

  onSettingsChanged((next) => {
    const refreshSettingsChanged =
      next.autoRefreshEnabled !== currentSettings.autoRefreshEnabled ||
      next.autoRefreshIntervalMs !== currentSettings.autoRefreshIntervalMs;
    const highlightThemeChanged = next.highlightTheme !== currentSettings.highlightTheme;
    // Every one of these feeds renderMarkdownStreaming's options (see the
    // renderDocument call site) — parse-stage settings, unlike the CSS-var
    // ones applyLiveSettings handles, can't take effect by re-styling the
    // DOM already on screen. Without this check they silently only applied
    // starting with the *next* document load, which is exactly the "toggle
    // does nothing" complaint the settings audit was meant to close out.
    const markdownRenderingChanged =
      JSON.stringify(next.markdown) !== JSON.stringify(currentSettings.markdown) ||
      next.codeLineNumbers !== currentSettings.codeLineNumbers ||
      next.codeLineWrap !== currentSettings.codeLineWrap ||
      next.alertTitleMode !== currentSettings.alertTitleMode ||
      next.externalLinkIndicator !== currentSettings.externalLinkIndicator ||
      next.blockRemoteImages !== currentSettings.blockRemoteImages;
    currentSettings = next;
    applyLiveSettings(next);
    presentation.applySettings(next.presentation);
    if (refreshSettingsChanged) restartAutoRefresh(currentRefreshSource);
    // Phase 16 fix: picking a new "Code block theme" in Settings previously
    // had zero live effect (only applied on the next full reload) — every
    // other appearance setting here already live-applies (F81); this one
    // silently didn't.
    if (highlightThemeChanged) {
      void applyHighlightTheme(
        resolveEffectiveHighlightTheme(next.highlightTheme, getAppliedTheme()),
      );
    }
    if (markdownRenderingChanged && currentDocumentId && !isRawMode) {
      const scrollY = window.scrollY;
      const label = headerSourceEl.dataset.fullSource ?? '';
      void renderDocument(rawSourceText, label, currentLastModified ?? undefined).then(() =>
        window.scrollTo(0, scrollY),
      );
    }
  });

  currentBookmarks = await getBookmarks();
  fileBrowser.setBookmarks(currentBookmarks);
  onBookmarksChanged((next) => {
    currentBookmarks = next;
    fileBrowser.setBookmarks(next);
  });

  const params = new URLSearchParams(location.search);
  const token = params.get('h');
  if (token) {
    await loadFromHandoff(token);
  } else {
    // F80: silent (no prompt) reconnect to the last-opened folder, falling
    // back to the "Reconnect" affordance rather than forcing a re-pick —
    // Chrome does not guarantee permission survives every restart.
    const lastFolderRecord = await getHandle(LAST_FOLDER_HANDLE_ID);
    if (lastFolderRecord) {
      const reconnected = await trySilentReconnect(lastFolderRecord);
      if (!reconnected) {
        pendingReconnectRecord = lastFolderRecord;
        fileBrowser.show();
        syncPanelUi();
        fileBrowser.showReconnectBanner(lastFolderRecord.name);
      }
    }
  }
}

void bootstrap();
