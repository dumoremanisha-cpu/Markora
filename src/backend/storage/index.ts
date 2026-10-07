// Typed wrapper over chrome.storage.local. This is the only module allowed
// to call chrome.storage.local directly (code-conventions.md §2,
// security-privacy.md §4) — never chrome.storage.sync, never a raw
// chrome.storage.* call from a component.
import { DEFAULT_SETTINGS, MIGRATIONS, RECENTS_CAP, SCHEMA_VERSION, STORAGE_KEYS } from './schema';
import type { Annotation, FolderBookmark, RecentEntry, Settings } from './schema';
import { removeRecentById, upsertRecent } from './recents';
import { clearAllHandoffs } from './handoff';
import { deleteHandle } from './fsaaHandles';
import { ANNOTATIONS_KEY_PREFIX, annotationsStorageKey } from './annotations';

let migrationsRun = false;

async function runMigrationsIfNeeded(): Promise<void> {
  if (migrationsRun) return;
  migrationsRun = true;

  const stored = await chrome.storage.local.get(STORAGE_KEYS.schemaVersion);
  let version = (stored[STORAGE_KEYS.schemaVersion] as number | undefined) ?? SCHEMA_VERSION;

  if (version === SCHEMA_VERSION) {
    if (stored[STORAGE_KEYS.schemaVersion] === undefined) {
      await chrome.storage.local.set({ [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
    }
    return;
  }

  const pending = MIGRATIONS.filter((m) => m.fromVersion >= version).sort(
    (a, b) => a.fromVersion - b.fromVersion,
  );
  for (const migration of pending) {
    const all = await chrome.storage.local.get(null);
    const migrated = migration.migrate({
      schemaVersion: version,
      settings: (all[STORAGE_KEYS.settings] as Settings) ?? DEFAULT_SETTINGS,
    });
    version = migrated.schemaVersion;
    await chrome.storage.local.set({
      [STORAGE_KEYS.schemaVersion]: migrated.schemaVersion,
      [STORAGE_KEYS.settings]: migrated.settings,
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION });
}

export async function getSettings(): Promise<Settings> {
  await runMigrationsIfNeeded();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const existing = stored[STORAGE_KEYS.settings] as Partial<Settings> | undefined;
  // `shortcuts` is written back wholesale by the recorder (setSettings({
  // shortcuts: {...} })), so an install that rebound one shortcut before a
  // new shortcut id (e.g. openPreferences) shipped would otherwise have a
  // stored `shortcuts` object missing that key — a shallow spread would let
  // it silently override the new default with `undefined`. Merge one level
  // deeper here so newly added shortcut ids always fall back to their
  // default until the user explicitly rebinds them.
  return {
    ...DEFAULT_SETTINGS,
    ...existing,
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...existing?.shortcuts },
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

/**
 * Subscribes to settings changes made anywhere (another tab, the popup, the
 * options page). Every surface that reads settings uses this to stay in
 * sync without polling.
 */
export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEYS.settings];
    if (!change) return;
    callback({ ...DEFAULT_SETTINGS, ...(change.newValue as Partial<Settings>) });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Recents (F22, F59, F75) ---

export async function getRecents(): Promise<RecentEntry[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.recents);
  return (stored[STORAGE_KEYS.recents] as RecentEntry[] | undefined) ?? [];
}

async function setRecents(list: RecentEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.recents]: list });
}

/** Adds/updates a recent entry (dedupe + cap per ADR-0004 — see src/storage/recents.ts). */
export async function addRecent(candidate: RecentEntry): Promise<RecentEntry[]> {
  const next = upsertRecent(await getRecents(), candidate, RECENTS_CAP);
  await setRecents(next);
  return next;
}

export async function removeRecent(id: string): Promise<RecentEntry[]> {
  const next = removeRecentById(await getRecents(), id);
  await setRecents(next);
  return next;
}

export async function clearRecents(): Promise<void> {
  await setRecents([]);
}

/**
 * Subscribes to recents changes made anywhere (another popup instance, the
 * viewer). Mirrors `onSettingsChanged`'s pattern.
 */
export function onRecentsChanged(callback: (recents: RecentEntry[]) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEYS.recents];
    if (!change) return;
    callback((change.newValue as RecentEntry[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Folder bookmarks (F21) ---

export async function getBookmarks(): Promise<FolderBookmark[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.bookmarks);
  return (stored[STORAGE_KEYS.bookmarks] as FolderBookmark[] | undefined) ?? [];
}

async function setBookmarks(list: FolderBookmark[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.bookmarks]: list });
}

export async function addBookmark(bookmark: FolderBookmark): Promise<FolderBookmark[]> {
  const next = [bookmark, ...(await getBookmarks())];
  await setBookmarks(next);
  return next;
}

export async function renameBookmark(id: string, name: string): Promise<FolderBookmark[]> {
  const next = (await getBookmarks()).map((b) => (b.id === id ? { ...b, name } : b));
  await setBookmarks(next);
  return next;
}

/** Removes the bookmark row and its linked IndexedDB handle record together — an orphaned handle would otherwise sit unreachable forever. */
export async function removeBookmark(id: string): Promise<FolderBookmark[]> {
  const bookmarks = await getBookmarks();
  const target = bookmarks.find((b) => b.id === id);
  const next = bookmarks.filter((b) => b.id !== id);
  await setBookmarks(next);
  if (target) await deleteHandle(target.handleId);
  return next;
}

/** Mirrors `onSettingsChanged`/`onRecentsChanged` — lets an already-open viewer react to a bookmark list change made elsewhere (another tab, or a "Clear Cache" run from Settings/popup). */
export function onBookmarksChanged(callback: (bookmarks: FolderBookmark[]) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEYS.bookmarks];
    if (!change) return;
    callback((change.newValue as FolderBookmark[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Annotations (F27, ADR-0003/0004) ---

export async function getAnnotationsForDocument(documentId: string): Promise<Annotation[]> {
  const key = annotationsStorageKey(documentId);
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as Annotation[] | undefined) ?? [];
}

async function setAnnotationsForDocument(documentId: string, list: Annotation[]): Promise<void> {
  await chrome.storage.local.set({ [annotationsStorageKey(documentId)]: list });
}

export async function addAnnotation(
  documentId: string,
  annotation: Annotation,
): Promise<Annotation[]> {
  const next = [...(await getAnnotationsForDocument(documentId)), annotation];
  await setAnnotationsForDocument(documentId, next);
  return next;
}

export async function updateAnnotation(
  documentId: string,
  id: string,
  patch: Partial<Annotation>,
): Promise<Annotation[]> {
  const next = (await getAnnotationsForDocument(documentId)).map((a) =>
    a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
  );
  await setAnnotationsForDocument(documentId, next);
  return next;
}

export async function deleteAnnotation(documentId: string, id: string): Promise<Annotation[]> {
  const next = (await getAnnotationsForDocument(documentId)).filter((a) => a.id !== id);
  await setAnnotationsForDocument(documentId, next);
  return next;
}

/** Mirrors `onSettingsChanged`/`onRecentsChanged`/`onBookmarksChanged` — scoped to one document's sharded key. */
export function onAnnotationsChanged(
  documentId: string,
  callback: (annotations: Annotation[]) => void,
): () => void {
  const key = annotationsStorageKey(documentId);
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[key];
    if (!change) return;
    callback((change.newValue as Annotation[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Maintenance (F55, F27) ---

/**
 * Clears exactly the scope defined in
 * `docs/specs/01-functional-requirements.md` §32: recents, bookmarks (their
 * linked FSAA handles too — an orphaned handle is exactly as unreachable as
 * a cleared bookmark row), and transient handoff records. Never touches
 * settings/schemaVersion, the last-opened-folder FSAA handle, or
 * `markora.annotations.*` — annotations are user-authored content, removable
 * only via the separate `deleteAllAnnotations()` below, behind its own
 * explicit confirmation (ADR-0004 clarification, Phase 5 task 9).
 */
export async function clearCache(): Promise<void> {
  const bookmarks = await getBookmarks();
  await Promise.all(bookmarks.map((b) => deleteHandle(b.handleId)));
  await Promise.all([setRecents([]), setBookmarks([]), clearAllHandoffs()]);
}

/** Total annotation count across every document — powers the "Delete all annotations" confirmation dialog's "N annotations will be lost" text. */
export async function getTotalAnnotationsCount(): Promise<number> {
  const all = await chrome.storage.local.get(null);
  let count = 0;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(ANNOTATIONS_KEY_PREFIX) && Array.isArray(value)) count += value.length;
  }
  return count;
}

/** The one path that removes annotation data — a distinct, explicitly-confirmed maintenance action, never bundled into Clear Cache (F55). Wipes every `markora.annotations.*` key, across every document. */
export async function deleteAllAnnotations(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith(ANNOTATIONS_KEY_PREFIX));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
}

export async function getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const quotaBytes = chrome.storage.local.QUOTA_BYTES;
  return { bytesInUse, quotaBytes };
}

export type { Settings, ThemeSetting, PresentationSettings } from './schema';
export type { RecentEntry, FolderBookmark } from './schema';
export type { Annotation, AnnotationType, AnnotationStatus } from './schema';
export { DEFAULT_SETTINGS } from './schema';
