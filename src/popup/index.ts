// Popup: quick actions only, never the full app or folder browsing
// (code-conventions.md §3). Quick Controls / Recent & Bookmarks /
// Preferences tabs (`new_ui/extension_popup.png`, the user's own Markora
// mockup — see docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md §0's Phase 7
// policy update for why this is now a literal visual reference).
import { getActiveLocale, t } from '../backend/i18n';
import {
  clearCache,
  clearRecents,
  getBookmarks,
  getRecents,
  getSettings,
  onBookmarksChanged,
  onRecentsChanged,
  removeRecent,
  setSettings,
} from '../backend/storage';
import type { FolderBookmark, RecentEntry, ThemeSetting } from '../backend/storage';
import { groupRecents, matchesRecentQuery } from '../backend/storage/recents';
import { THEME_CYCLE } from '../backend/storage/schema';
import type { FontFamilyKey } from '../backend/storage/schema';
import { formatBytes } from '../backend/utils/formatBytes';
import { formatRelativeTime } from '../backend/utils/formatRelativeTime';
import { initTheme, setHighContrastReadability, setTheme } from '../backend/utils/theme';
import { initI18nRuntime } from '../backend/utils/i18nRuntime';
import { AVAILABLE_LOCALES } from '../backend/i18n';
import { showToast } from '../frontend/components/notifications';
import { isEligibleForRenderAsMarkdown } from './eligibility';
import { createWhatsNew, shouldShowWhatsNew } from '../frontend/components/whatsNew';
import { buildHelpFeedbackList, buildLicenseStatusRow } from '../frontend/components/aboutContent';
import {
  GET_ACTIVE_DOCUMENT_MESSAGE,
  OPEN_PREFERENCES_MESSAGE,
  type ActiveDocumentInfo,
} from '../backend/utils/activeDocumentBridge';
import {
  iconBookmark,
  iconDocument,
  iconFileText,
  iconFolder,
  iconMinus,
  iconPlus,
  iconRaw,
  iconShield,
  iconTheme,
} from '../frontend/components/icons';

const VIEWER_URL = chrome.runtime.getURL('src/viewer/index.html');
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;

const app = document.getElementById('app');
if (!app) throw new Error('popup: #app not found');

type TabId = 'quickControls' | 'recentBookmarks' | 'preferences';

/**
 * The one-and-only place this content script file's compiled path is
 * looked up: crxjs rewrites `content_scripts[0].js[0]` in the built
 * manifest to the real (hashed) asset path, so reading it back from
 * `chrome.runtime.getManifest()` is the only way to reference it correctly
 * regardless of build output naming.
 */
function getContentScriptFile(): string | undefined {
  return chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
}

/**
 * F04 fallback (the feature that justifies `activeTab` + `scripting`,
 * `07-permissions-compliance.md` §2). Runs a read-only, message-free probe
 * first (never touches chrome.runtime, never creates a handoff) so a
 * declined page costs nothing beyond that one click's activeTab grant; only
 * on a qualifying page does it inject the existing detection/handoff
 * content script (ADR-0006 §2) to run the normal, already-tested handoff
 * path. This keeps the content script's message contract exactly as
 * ADR-0006 §7 fixes it (`detection/ping` + `handoff/create`, nothing else)
 * — the decline signal here never goes over chrome.runtime at all.
 */
async function renderActiveTabAsMarkdown(tabId: number): Promise<void> {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (): boolean => {
      const doc = document;
      if (doc.contentType === 'text/plain' || doc.contentType === 'text/markdown') return true;
      if (!doc.body) return false;
      const children = Array.from(doc.body.children).filter(
        (el) => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE',
      );
      return children.length === 1 && children[0]?.tagName === 'PRE';
    },
  });

  if (!probe?.result) {
    showToast(t('popup.renderAsMarkdown.declined'), 'warning');
    return;
  }

  const contentScriptFile = getContentScriptFile();
  if (!contentScriptFile) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      window.__markoraOnDemandRender = true;
    },
  });
  await chrome.scripting.executeScript({ target: { tabId }, files: [contentScriptFile] });
  window.close();
}

// Version badge + quick theme-cycle + close button live in their own row
// next to the brand title (new_ui/extension_popup.png) — real data (the
// installed manifest version) and real actions (the same THEME_CYCLE the
// viewer's toolbar button and the global chrome.commands shortcut already
// use; window.close() for the close button).
function buildHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'markora-popup__header';

  const brand = document.createElement('div');
  brand.className = 'markora-popup__brand';
  const appName = t('app.name');
  const mark = document.createElement('span');
  mark.className = 'markora-popup__brand-mark';
  mark.textContent = appName.charAt(0);
  mark.setAttribute('aria-hidden', 'true');
  const title = document.createElement('h1');
  title.textContent = appName;
  const version = document.createElement('span');
  version.className = 'markora-popup__version-badge';
  version.textContent = t('popup.header.versionBadge', {
    version: chrome.runtime.getManifest().version,
  });
  brand.append(mark, title, version);

  const actions = document.createElement('div');
  actions.className = 'markora-popup__header-actions';

  const themeButton = document.createElement('button');
  themeButton.type = 'button';
  themeButton.className = 'markora-popup__header-btn';
  themeButton.append(iconTheme());
  themeButton.setAttribute('aria-label', t('shortcuts.toggleTheme'));
  themeButton.title = t('shortcuts.toggleTheme');
  themeButton.addEventListener('click', () => {
    void getSettings().then((current) => {
      const next =
        THEME_CYCLE[(THEME_CYCLE.indexOf(current.theme) + 1) % THEME_CYCLE.length] ?? 'system';
      void setTheme(next);
    });
  });

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'markora-popup__header-btn';
  closeButton.textContent = t('common.closeSymbol');
  closeButton.setAttribute('aria-label', t('common.close'));
  closeButton.title = t('common.close');
  closeButton.addEventListener('click', () => window.close());

  actions.append(themeButton, closeButton);
  header.append(brand, actions);
  return header;
}

// Icon-on-top card recipe (this brief's ExtensionPopup Quick Controls grid)
// — same real actions, no functional change.
function makeActionCard(icon: () => SVGSVGElement, label: string, hint: string): HTMLButtonElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'markora-popup__action-card';
  const labelEl = document.createElement('span');
  labelEl.className = 'markora-popup__action-card-label';
  labelEl.textContent = label;
  const hintEl = document.createElement('span');
  hintEl.className = 'markora-popup__action-card-hint';
  hintEl.textContent = hint;
  card.append(icon(), labelEl, hintEl);
  return card;
}

function buildActionsGrid(activeTab: chrome.tabs.Tab | undefined): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'markora-popup__actions';

  const openFileButton = makeActionCard(
    iconDocument,
    t('popup.actions.openFile'),
    t('popup.actions.openFile.hint'),
  );
  openFileButton.addEventListener('click', () => void focusOrOpenViewer());

  const openFolderButton = makeActionCard(
    iconFolder,
    t('popup.actions.openFolder'),
    t('popup.actions.openFolder.hint'),
  );
  openFolderButton.addEventListener('click', () => void focusOrOpenViewer());

  const eligible = isEligibleForRenderAsMarkdown(activeTab?.url, chrome.runtime.getURL(''));
  const renderAsMarkdownButton = makeActionCard(
    iconRaw,
    t('popup.actions.renderAsMarkdown'),
    eligible
      ? t('popup.actions.renderAsMarkdown.hint')
      : t('popup.actions.renderAsMarkdown.unavailable'),
  );
  renderAsMarkdownButton.disabled = !eligible;
  if (eligible) {
    renderAsMarkdownButton.addEventListener('click', () => {
      const tabId = activeTab?.id;
      if (tabId === undefined) return;
      void renderActiveTabAsMarkdown(tabId);
    });
  }

  actions.append(openFileButton, openFolderButton, renderAsMarkdownButton);
  return actions;
}

/**
 * Broadcasts to every extension page and asks whichever one is the viewer
 * to report its own identity/state. This project deliberately never
 * requests the `tabs` permission (permissions.md rule 4), so
 * `chrome.tabs.query({ url })` can't see the viewer tab's `url` field at
 * all and always comes back empty — confirmed via live testing, not
 * assumed. `chrome.runtime.sendMessage` (received by every extension page)
 * plus the viewer answering with its own `chrome.tabs.getCurrent()` result
 * is the permission-free equivalent. Returns `null` when no viewer tab is
 * open (nothing answers) rather than a fake/fixture result.
 */
async function queryActiveDocument(): Promise<ActiveDocumentInfo | null> {
  try {
    const info = (await chrome.runtime.sendMessage({
      type: GET_ACTIVE_DOCUMENT_MESSAGE,
    })) as ActiveDocumentInfo | undefined;
    return info ?? null;
  } catch {
    return null;
  }
}

// Focuses (or opens) the viewer tab. Deliberately does NOT try to
// auto-trigger showOpenFilePicker() there: user activation from this popup
// click does not transfer to a tab focused/created via chrome.tabs.* (the
// same Chrome limitation ADR-0001 Flow B cites for why the picker itself
// must be triggered from inside the viewer). The viewer's own empty state
// shows an "Open file" button for that final, in-context click.
async function focusOrOpenViewer(): Promise<void> {
  const existing = await queryActiveDocument();
  if (existing?.tabId !== undefined) {
    await chrome.tabs.update(existing.tabId, { active: true });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: VIEWER_URL });
  }
  window.close();
}

/**
 * `new_ui/fullsetting.png`'s floating Preferences dialog only exists inside
 * an already-open viewer tab (it floats over that tab's own document). When
 * one is open, this focuses it and asks it to open that real dialog via
 * `chrome.tabs.sendMessage` — matching the mockup exactly instead of always
 * falling back to the plain standalone options page. With no viewer tab
 * open there is nothing for the dialog to float over, so the options page
 * (`chrome.runtime.openOptionsPage()`) stays the fallback, same as before.
 */
async function openFullSettings(): Promise<void> {
  const existing = await queryActiveDocument();
  if (existing?.tabId !== undefined) {
    await chrome.tabs.update(existing.tabId, { active: true });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    await chrome.tabs.sendMessage(existing.tabId, { type: OPEN_PREFERENCES_MESSAGE });
  } else {
    chrome.runtime.openOptionsPage();
  }
  window.close();
}

/** `new_ui/extension_popup.png`'s "ACTIVE DOCUMENT" card — omitted entirely (not a fake placeholder) when no viewer tab is open or nothing is loaded there yet. */
function buildActiveDocumentCard(info: ActiveDocumentInfo): HTMLElement {
  const card = document.createElement('div');
  card.className = 'markora-popup__active-doc';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'markora-popup__active-doc-eyebrow';
  eyebrow.textContent = t('popup.activeDocument.title');

  const row = document.createElement('div');
  row.className = 'markora-popup__active-doc-row';
  const icon = iconFileText();
  const textWrap = document.createElement('div');
  const name = document.createElement('p');
  name.className = 'markora-popup__active-doc-name';
  name.textContent = info.sourceLabel ?? '';
  const meta = document.createElement('p');
  meta.className = 'markora-popup__active-doc-meta';
  meta.textContent = t('popup.activeDocument.sizeStatus', {
    size: formatBytes(info.byteSize ?? 0),
    status: info.synced ? t('popup.activeDocument.synced') : t('popup.activeDocument.unsynced'),
  });
  if (info.synced) meta.classList.add('markora-popup__active-doc-meta--synced');
  textWrap.append(name, meta);
  row.append(icon, textWrap);

  card.append(eyebrow, row);
  return card;
}

function toggleRow(
  labelText: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const wrapper = document.createElement('div');
  wrapper.className = 'markora-popup__toggle-row';
  const label = document.createElement('label');
  label.append(labelText, input);
  wrapper.appendChild(label);
  return wrapper;
}

type QuickFontKey = Extract<FontFamilyKey, 'system' | 'georgia' | 'mono'>;
const QUICK_FONT_KEYS: QuickFontKey[] = ['system', 'georgia', 'mono'];
const QUICK_FONT_LABEL_KEYS: Record<QuickFontKey, string> = {
  system: 'popup.quickControls.typography.sans',
  georgia: 'popup.quickControls.typography.serif',
  mono: 'popup.quickControls.typography.mono',
};

/** Font-size stepper + a Sans/Serif/Mono quick-pick (`new_ui/extension_popup.png`'s Typography card) — both drive the same real `fontFamily`/`fontSize` settings the full Settings page's Appearance section uses, so a change here live-applies in any open viewer exactly like it would from there. */
function buildTypographyCard(settings: { fontSize: number; fontFamily: string }): HTMLElement {
  const card = document.createElement('div');
  card.className = 'markora-popup__typography';

  const title = document.createElement('p');
  title.className = 'markora-popup__typography-title';
  title.textContent = t('popup.quickControls.typography.title');

  const stepper = document.createElement('div');
  stepper.className = 'markora-popup__font-stepper';
  const decreaseButton = document.createElement('button');
  decreaseButton.type = 'button';
  decreaseButton.append(iconMinus());
  decreaseButton.setAttribute('aria-label', t('popup.quickControls.typography.decrease'));
  const sizeLabel = document.createElement('span');
  const renderSize = (size: number): void => {
    sizeLabel.textContent = `${size}px`;
  };
  renderSize(settings.fontSize);
  const increaseButton = document.createElement('button');
  increaseButton.type = 'button';
  increaseButton.append(iconPlus());
  increaseButton.setAttribute('aria-label', t('popup.quickControls.typography.increase'));

  let fontSize = settings.fontSize;
  const applySize = (next: number): void => {
    fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, next));
    renderSize(fontSize);
    void setSettings({ fontSize });
  };
  decreaseButton.addEventListener('click', () => applySize(fontSize - 1));
  increaseButton.addEventListener('click', () => applySize(fontSize + 1));
  stepper.append(decreaseButton, sizeLabel, increaseButton);

  const segmented = document.createElement('div');
  segmented.className = 'markora-popup__font-segmented';
  const buttons: HTMLButtonElement[] = [];
  for (const key of QUICK_FONT_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t(QUICK_FONT_LABEL_KEYS[key]);
    btn.classList.toggle(
      'markora-popup__font-segmented-option--active',
      settings.fontFamily === key,
    );
    btn.addEventListener('click', () => {
      for (const other of buttons) {
        other.classList.remove('markora-popup__font-segmented-option--active');
      }
      btn.classList.add('markora-popup__font-segmented-option--active');
      void setSettings({ fontFamily: key });
    });
    buttons.push(btn);
    segmented.appendChild(btn);
  }

  card.append(title, stepper, segmented);
  return card;
}

async function buildQuickControlsPanel(
  activeTab: chrome.tabs.Tab | undefined,
): Promise<HTMLElement> {
  const panel = document.createElement('section');
  panel.className = 'markora-popup__panel';

  const settings = await getSettings();

  // Real signal (chrome.extension.isAllowedFileSchemeAccess()), not shown
  // unconditionally: once the user grants file-URL access this banner
  // simply stops appearing next time the popup opens.
  const hasFileAccess = await chrome.extension.isAllowedFileSchemeAccess();
  if (!hasFileAccess) {
    panel.appendChild(buildSetupBanner());
  }

  panel.appendChild(buildActionsGrid(activeTab));

  const activeDocInfo = await queryActiveDocument();
  if (activeDocInfo?.open) {
    panel.appendChild(buildActiveDocumentCard(activeDocInfo));
  }

  panel.append(
    toggleRow(
      t('popup.quickControls.liveReload'),
      settings.autoRefreshEnabled,
      (checked) => void setSettings({ autoRefreshEnabled: checked }),
    ),
    toggleRow(
      t('popup.quickControls.syncScrollToc'),
      settings.tocSyncScroll,
      (checked) => void setSettings({ tocSyncScroll: checked }),
    ),
    toggleRow(
      t('popup.quickControls.highContrast'),
      settings.highContrastReadability,
      (checked) => void setHighContrastReadability(checked),
    ),
    buildTypographyCard(settings),
  );

  return panel;
}

function buildSetupBanner(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'markora-popup__setup-banner';

  const title = document.createElement('h2');
  title.textContent = t('popup.setup.fileAccess.title');

  const intro = document.createElement('p');
  intro.textContent = t('popup.setup.fileAccess.intro');

  const steps = document.createElement('ol');
  for (const key of [
    'popup.setup.fileAccess.step1',
    'popup.setup.fileAccess.step2',
    'popup.setup.fileAccess.step3',
    'popup.setup.fileAccess.step4',
  ]) {
    const li = document.createElement('li');
    li.textContent = t(key);
    steps.appendChild(li);
  }

  const openSettingsButton = document.createElement('button');
  openSettingsButton.type = 'button';
  openSettingsButton.textContent = t('popup.setup.fileAccess.openSettingsButton');
  openSettingsButton.addEventListener('click', () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });

  const hint = document.createElement('p');
  hint.className = 'markora-popup__hint';
  hint.textContent = t('popup.setup.openFileHint');

  panel.append(title, intro, steps, openSettingsButton, hint);
  return panel;
}

function renderRecentGroup(
  label: string,
  entries: RecentEntry[],
  locale: string,
  onRemove: (id: string) => void,
): HTMLElement {
  const details = document.createElement('details');
  details.className = 'markora-popup__recent-group';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = label;
  const list = document.createElement('ul');
  list.className = 'markora-popup__recent-entries';
  for (const entry of entries) list.appendChild(renderRecentEntry(entry, locale, onRemove));
  details.append(summary, list);
  return details;
}

// Card layout (icon + stacked title/meta, `new_ui/extension_popup_bookmark.png`)
// shows only real data: a locale-aware relative "last opened" time (same
// bare Intl.RelativeTimeFormat output the annotations panel already uses,
// no invented wrapper phrase) and, only when it's genuinely distinct from
// the title, the entry's own identifier (a real file:// or remote URL). The
// mockup also shows a full filesystem path under every entry, but File
// System Access / dropped File objects never expose a real OS path (a
// deliberate browser privacy restriction) — inventing one here would be
// exactly the fabricated-UI this project's core rule forbids, so local
// drag-drop/file-picker entries (whose identifier is just the filename,
// same as the title) show only the time.
function renderRecentEntry(
  entry: RecentEntry,
  locale: string,
  onRemove: (id: string) => void,
): HTMLElement {
  const li = document.createElement('li');
  li.className = 'markora-popup__recent-entry';

  // Only http(s)/file: identifiers can be reopened by navigating a tab to
  // them — folder-browser/drag-drop entries have no stable handle-free URL
  // (known limitation: reopen those from the viewer's folder browser or
  // "Open file" instead).
  const reopenable = /^(https?|file):\/\//i.test(entry.identifier);
  const icon = iconFileText();
  const textWrap = document.createElement('div');
  textWrap.className = 'markora-popup__recent-textwrap';

  const label = document.createElement(reopenable ? 'button' : 'span');
  label.className = 'markora-popup__recent-open';
  label.textContent = entry.title;
  if (reopenable && label instanceof HTMLButtonElement) {
    label.type = 'button';
    label.addEventListener('click', () => {
      void chrome.tabs.create({ url: entry.identifier });
      window.close();
    });
  }

  const meta = document.createElement('p');
  meta.className = 'markora-popup__recent-meta';
  const relative = formatRelativeTime(entry.lastOpenedAt, locale);
  meta.textContent =
    entry.identifier !== entry.title ? `${relative} · ${entry.identifier}` : relative;
  meta.title = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    entry.lastOpenedAt,
  );
  textWrap.append(label, meta);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'markora-popup__recent-remove';
  removeButton.textContent = t('common.closeSymbol');
  removeButton.setAttribute('aria-label', t('recents.remove'));
  removeButton.addEventListener('click', () => onRemove(entry.id));

  li.append(icon, textWrap, removeButton);
  return li;
}

/** Bookmarked folders (`new_ui/extension_popup.png`'s "Recent & Bookmarks" tab) — real data via `getBookmarks()`, the same store the viewer's file browser reads. Clicking one focuses/opens the viewer; folder handles can't be reopened directly from the popup (same FS-Access user-activation limitation as "Open file"/"Open folder" above), so the viewer's own reconnect-banner flow takes it from there. The mockup also shows a file count per bookmark, which would need a live rescan of a folder that may not even be open right now — left out rather than guessed, same reasoning as the path note above. */
function renderBookmarkEntry(bookmark: FolderBookmark, locale: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'markora-popup__recent-entry';
  const icon = iconBookmark();
  const textWrap = document.createElement('div');
  textWrap.className = 'markora-popup__recent-textwrap';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'markora-popup__recent-open';
  button.textContent = bookmark.name;
  button.addEventListener('click', () => void focusOrOpenViewer());
  const meta = document.createElement('p');
  meta.className = 'markora-popup__recent-meta';
  meta.textContent = formatRelativeTime(bookmark.createdAt, locale);
  meta.title = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    bookmark.createdAt,
  );
  textWrap.append(button, meta);
  li.append(icon, textWrap);
  return li;
}

async function buildRecentBookmarksPanel(): Promise<HTMLElement> {
  const panel = document.createElement('section');
  panel.className = 'markora-popup__panel';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'markora-popup__recent-search';
  searchInput.placeholder = t('popup.recent.searchPlaceholder');
  searchInput.setAttribute('aria-label', t('popup.recent.searchPlaceholder'));

  const actionsRow = document.createElement('div');
  actionsRow.className = 'markora-popup__recent-actions';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = t('recents.refresh');
  const clearAllButton = document.createElement('button');
  clearAllButton.type = 'button';
  clearAllButton.textContent = t('recents.clearAll');
  actionsRow.append(refreshButton, clearAllButton);

  const listEl = document.createElement('div');
  listEl.className = 'markora-popup__recent-list';

  const bookmarksTitle = document.createElement('p');
  bookmarksTitle.className = 'markora-popup__bookmarks-title';
  bookmarksTitle.textContent = t('popup.bookmarks.title');
  bookmarksTitle.hidden = true;
  const bookmarksList = document.createElement('ul');
  bookmarksList.className = 'markora-popup__recent-entries';

  panel.append(searchInput, actionsRow, listEl, bookmarksTitle, bookmarksList);

  const locale = getActiveLocale();
  let allRecents: RecentEntry[] = [];

  function render(): void {
    const filtered = allRecents.filter((entry) => matchesRecentQuery(entry, searchInput.value));
    listEl.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = t('popup.recent.empty');
      listEl.appendChild(empty);
    } else {
      const { local, remoteGroups } = groupRecents(filtered);
      if (local.length > 0) {
        listEl.appendChild(renderRecentGroup(t('recents.groupLocal'), local, locale, removeEntry));
      }
      for (const group of remoteGroups) {
        listEl.appendChild(renderRecentGroup(group.domain, group.entries, locale, removeEntry));
      }
    }
  }

  function removeEntry(id: string): void {
    void removeRecent(id).then((next) => {
      allRecents = next;
      render();
    });
  }

  async function refresh(): Promise<void> {
    allRecents = await getRecents();
    render();
  }

  function renderBookmarks(bookmarks: FolderBookmark[]): void {
    bookmarksTitle.hidden = bookmarks.length === 0;
    bookmarksList.replaceChildren(
      ...bookmarks.map((bookmark) => renderBookmarkEntry(bookmark, locale)),
    );
  }

  refreshButton.addEventListener('click', () => void refresh());

  // Same arm/disarm "click again to confirm" pattern as Settings' Clear
  // cache / Delete all annotations (settings/index.ts) — this used to fire
  // on a single click, the only bulk-destructive action in the app without
  // it, silently wiping the entire recent-documents history.
  let clearAllArmed = false;
  let clearAllDisarmTimer: ReturnType<typeof setTimeout> | undefined;
  function resetClearAllButton(): void {
    clearAllArmed = false;
    clearAllButton.textContent = t('recents.clearAll');
  }
  clearAllButton.addEventListener('click', () => {
    if (!clearAllArmed) {
      clearAllArmed = true;
      clearAllButton.textContent = t('recents.clearAll.confirm');
      clearAllDisarmTimer = setTimeout(resetClearAllButton, 4000);
      return;
    }
    clearTimeout(clearAllDisarmTimer);
    resetClearAllButton();
    void clearRecents().then(() => {
      allRecents = [];
      render();
    });
  });
  searchInput.addEventListener('input', render);
  onRecentsChanged((next) => {
    allRecents = next;
    render();
  });
  onBookmarksChanged(renderBookmarks);

  await refresh();
  renderBookmarks(await getBookmarks());
  return panel;
}

/** F55 — same two-click confirm pattern as the Settings page's Maintenance section (no native `confirm()`, for consistency and testability). */
function buildClearCacheButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('settings.maintenance.clearCache');
  let armed = false;
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      button.textContent = t('settings.maintenance.clearCache.confirm');
      disarmTimer = setTimeout(() => {
        armed = false;
        button.textContent = t('settings.maintenance.clearCache');
      }, 4000);
      return;
    }
    clearTimeout(disarmTimer);
    armed = false;
    button.textContent = t('settings.maintenance.clearCache');
    void clearCache().then(() => showToast(t('settings.maintenance.clearCache.done'), 'success'));
  });
  return button;
}

/** Merges the old Settings + Help tabs into one (`new_ui/extension_popup.png` names a single "Preferences" tab) — same real controls and data, just one tab instead of two. */
/** A label stacked above its control, full-width — unlike a side-by-side row, this doesn't squeeze/wrap a two-line label against a wide `<select>` in the popup's narrow width. */
function stackedField(labelText: string, control: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'markora-popup__field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

async function buildPreferencesPanel(): Promise<HTMLElement> {
  const panel = document.createElement('section');
  panel.className = 'markora-popup__panel';
  const settings = await getSettings();

  const generalGroup = document.createElement('div');
  generalGroup.className = 'markora-popup__pref-group';
  const generalTitle = document.createElement('p');
  generalTitle.className = 'markora-popup__pref-group-title';
  generalTitle.textContent = t('settings.section.general');

  const themeSelect = document.createElement('select');
  const themeOptions: Array<[ThemeSetting, string]> = [
    ['light', t('popup.settings.theme.light')],
    ['dark', t('popup.settings.theme.dark')],
    ['system', t('popup.settings.theme.system')],
  ];
  for (const [value, label] of themeOptions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = settings.theme === value;
    themeSelect.appendChild(option);
  }
  themeSelect.addEventListener('change', () => {
    void setTheme(themeSelect.value as ThemeSetting);
  });

  // F37 — the language selector belongs in both the popup quick-settings
  // and the full options page (05-ux-i18n-accessibility.md §5); option
  // labels are shared with Settings → Language's own dropdown.
  const languageSelect = document.createElement('select');
  const languageOptions: Array<[string, string]> = [
    ['auto', t('settings.general.language.auto')],
    ...AVAILABLE_LOCALES.map((tag): [string, string] => [
      tag,
      t(`settings.general.language.${tag}`),
    ]),
  ];
  for (const [value, label] of languageOptions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = settings.language === value;
    languageSelect.appendChild(option);
  }
  languageSelect.addEventListener('change', () => {
    void setSettings({ language: languageSelect.value });
  });

  const enabledToggle = toggleRow(
    t('popup.settings.extensionEnabled.label'),
    settings.extensionEnabled,
    (checked) => void setSettings({ extensionEnabled: checked }),
  );

  const buttonRow = document.createElement('div');
  buttonRow.className = 'markora-popup__pref-buttons';
  const optionsPageButton = document.createElement('button');
  optionsPageButton.type = 'button';
  optionsPageButton.textContent = t('popup.settings.openFullSettings');
  optionsPageButton.addEventListener('click', () => {
    void openFullSettings();
  });
  const clearCacheButton = buildClearCacheButton();
  buttonRow.append(optionsPageButton, clearCacheButton);

  generalGroup.append(
    generalTitle,
    stackedField(t('popup.settings.theme.label'), themeSelect),
    stackedField(t('settings.section.language'), languageSelect),
    enabledToggle,
    buttonRow,
  );

  const helpGroup = document.createElement('div');
  helpGroup.className = 'markora-popup__pref-group';
  const helpTitle = document.createElement('p');
  helpTitle.className = 'markora-popup__pref-group-title';
  helpTitle.textContent = t('popup.preferences.helpAndAbout');
  helpGroup.append(helpTitle, buildLicenseStatusRow(), buildHelpFeedbackList());

  panel.append(generalGroup, helpGroup);
  return panel;
}

// Two real, accurate claims (new_ui/extension_popup.png's footer), not one —
// left is identity, right is the same zero-telemetry privacy claim the
// Settings → Privacy panel makes, just rephrased to match the mockup.
function buildFooter(): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'markora-popup__footer';
  const brand = document.createElement('span');
  brand.textContent = t('popup.footer.brand');
  const tagline = document.createElement('span');
  tagline.append(iconShield(), document.createTextNode(t('popup.footer.zeroServerCalls')));
  footer.append(brand, tagline);
  return footer;
}

function buildTabs(panels: Record<TabId, HTMLElement>): HTMLElement {
  const nav = document.createElement('div');
  nav.className = 'markora-popup__tabs';
  nav.setAttribute('role', 'tablist');

  const tabOrder: TabId[] = ['quickControls', 'recentBookmarks', 'preferences'];
  const labelKeys: Record<TabId, string> = {
    quickControls: 'popup.tabs.quickControls',
    recentBookmarks: 'popup.tabs.recentBookmarks',
    preferences: 'popup.tabs.preferences',
  };

  const buttons: Record<TabId, HTMLButtonElement> = {} as Record<TabId, HTMLButtonElement>;

  const selectTab = (id: TabId) => {
    for (const tabId of tabOrder) {
      panels[tabId].hidden = tabId !== id;
      buttons[tabId].setAttribute('aria-selected', String(tabId === id));
    }
  };

  for (const id of tabOrder) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = t(labelKeys[id]);
    button.addEventListener('click', () => selectTab(id));
    buttons[id] = button;
    nav.appendChild(button);
  }

  selectTab('quickControls');
  return nav;
}

// F37/F81 live language switching: the popup has no long-lived document
// state to preserve (unlike the viewer), so re-rendering it from scratch on
// a language change is simplest and correct — this is exactly what
// re-opening the popup would already produce.
async function renderApp(): Promise<void> {
  app!.replaceChildren();

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const quickControlsPanel = await buildQuickControlsPanel(activeTab);
  const recentBookmarksPanel = await buildRecentBookmarksPanel();
  const preferencesPanel = await buildPreferencesPanel();

  const panels: Record<TabId, HTMLElement> = {
    quickControls: quickControlsPanel,
    recentBookmarks: recentBookmarksPanel,
    preferences: preferencesPanel,
  };

  const tabs = buildTabs(panels);
  app!.append(
    buildHeader(),
    tabs,
    quickControlsPanel,
    recentBookmarksPanel,
    preferencesPanel,
    buildFooter(),
  );
}

/** F52 — shown once per version, in-extension. Never shown right after onboarding: onboarding's Finish step already seeds `lastSeenWhatsNewVersion` to the version the user just installed. */
async function showWhatsNewIfDue(): Promise<void> {
  const settings = await getSettings();
  const currentVersion = chrome.runtime.getManifest().version;
  if (
    !shouldShowWhatsNew(
      currentVersion,
      settings.lastSeenWhatsNewVersion,
      settings.onboardingCompleted,
    )
  ) {
    return;
  }
  const whatsNew = createWhatsNew();
  document.body.appendChild(whatsNew.el);
  whatsNew.open(currentVersion);
  void setSettings({ lastSeenWhatsNewVersion: currentVersion });
}

async function bootstrap(): Promise<void> {
  await initI18nRuntime(() => void renderApp());
  await initTheme();
  await renderApp();
  await showWhatsNewIfDue();
}

void bootstrap();
