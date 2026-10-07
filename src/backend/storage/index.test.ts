import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeChromeStorage {
  data: Record<string, unknown>;
  listeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void>;
}

function installFakeChrome(): FakeChromeStorage {
  const state: FakeChromeStorage = { data: {}, listeners: [] };

  const local = {
    get: vi.fn(async (key?: string | string[] | null) => {
      if (key === null || key === undefined) return { ...state.data };
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      for (const k of keys) if (k in state.data) result[k] = state.data[k];
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, { newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { newValue: v };
        state.data[k] = v;
      }
      for (const listener of state.listeners) listener(changes, 'local');
    }),
    remove: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const changes: Record<string, { newValue?: unknown }> = {};
      for (const k of keys) {
        changes[k] = { newValue: undefined };
        delete state.data[k];
      }
      for (const listener of state.listeners) listener(changes, 'local');
    }),
    getBytesInUse: vi.fn(async () => JSON.stringify(state.data).length),
    QUOTA_BYTES: 10_485_760,
  };

  const onChanged = {
    addListener: vi.fn(
      (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
        state.listeners.push(cb);
      },
    ),
    removeListener: vi.fn(
      (cb: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
        state.listeners = state.listeners.filter((l) => l !== cb);
      },
    ),
  };

  (globalThis as { chrome: unknown }).chrome = { storage: { local, onChanged } };
  return state;
}

describe('storage wrapper', () => {
  beforeEach(() => {
    installFakeChrome();
    vi.resetModules();
  });

  it('returns defaults when nothing is stored yet', async () => {
    const { getSettings, DEFAULT_SETTINGS } = await import('./index');
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a write', async () => {
    const { getSettings, setSettings } = await import('./index');
    await setSettings({ theme: 'dark' });
    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
  });

  it('writes the current schema version on first read (empty migration registry)', async () => {
    const { getSettings } = await import('./index');
    const { STORAGE_KEYS, SCHEMA_VERSION } = await import('./schema');
    await getSettings();
    const local = (
      globalThis as unknown as {
        chrome: { storage: { local: { get: (k: null) => Promise<Record<string, unknown>> } } };
      }
    ).chrome.storage.local;
    const all = await local.get(null);
    expect(all[STORAGE_KEYS.schemaVersion]).toBe(SCHEMA_VERSION);
  });

  it('round-trips a Phase 2-B typography/layout field (F35/F81)', async () => {
    const { getSettings, setSettings } = await import('./index');
    await setSettings({ fontSize: 20, tocSidebarWidth: 320 });
    const settings = await getSettings();
    expect(settings.fontSize).toBe(20);
    expect(settings.tocSidebarWidth).toBe(320);
  });

  it('round-trips a nested shortcuts patch without losing sibling fields (F39)', async () => {
    const { getSettings, setSettings, DEFAULT_SETTINGS } = await import('./index');
    await setSettings({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts, toggleToc: 'Ctrl+Alt+T' } });
    const settings = await getSettings();
    expect(settings.shortcuts.toggleToc).toBe('Ctrl+Alt+T');
    expect(settings.shortcuts.toggleRawRendered).toBe(DEFAULT_SETTINGS.shortcuts.toggleRawRendered);
  });

  it('notifies onSettingsChanged subscribers of writes made elsewhere', async () => {
    const { setSettings, onSettingsChanged } = await import('./index');
    const seen: string[] = [];
    const unsubscribe = onSettingsChanged((settings) => seen.push(settings.theme));
    await setSettings({ theme: 'dark' });
    expect(seen).toEqual(['dark']);
    unsubscribe();
    await setSettings({ theme: 'light' });
    expect(seen).toEqual(['dark']);
  });

  it('recents: adds, dedupes on reopen, removes, and clears', async () => {
    const { addRecent, getRecents, removeRecent, clearRecents } = await import('./index');
    const entry1 = {
      id: 'a',
      title: 'a.md',
      sourceType: 'local' as const,
      identifier: '/a.md',
      lastOpenedAt: 1,
    };
    await addRecent(entry1);
    await addRecent({ ...entry1, lastOpenedAt: 2 });
    expect(await getRecents()).toHaveLength(1);
    expect((await getRecents())[0]?.lastOpenedAt).toBe(2);

    await removeRecent('a');
    expect(await getRecents()).toHaveLength(0);

    await addRecent(entry1);
    await clearRecents();
    expect(await getRecents()).toHaveLength(0);
  });

  it('bookmarks: adds, renames, and removing one also deletes its FSAA handle', async () => {
    const { addBookmark, getBookmarks, renameBookmark, removeBookmark } = await import('./index');
    const { putHandle, getHandle } = await import('./fsaaHandles');

    await putHandle('handle-1', 'docs', { kind: 'directory', name: 'docs' } as never);
    await addBookmark({ id: 'b1', name: 'docs', handleId: 'handle-1', createdAt: 1 });
    expect(await getBookmarks()).toHaveLength(1);

    await renameBookmark('b1', 'renamed');
    expect((await getBookmarks())[0]?.name).toBe('renamed');

    await removeBookmark('b1');
    expect(await getBookmarks()).toHaveLength(0);
    expect(await getHandle('handle-1')).toBeUndefined();
  });

  it('clearCache clears recents/bookmarks/handles/handoffs but never settings', async () => {
    const {
      addRecent,
      addBookmark,
      clearCache,
      getRecents,
      getBookmarks,
      getSettings,
      setSettings,
    } = await import('./index');
    const { putHandle, getHandle } = await import('./fsaaHandles');
    const { createHandoff, readAndDeleteHandoff } = await import('./handoff');

    await setSettings({ theme: 'dark' });
    await addRecent({
      id: 'r1',
      title: 'r',
      sourceType: 'local',
      identifier: '/r.md',
      lastOpenedAt: 1,
    });
    await putHandle('h1', 'folder', { kind: 'directory', name: 'folder' } as never);
    await addBookmark({ id: 'b1', name: 'folder', handleId: 'h1', createdAt: 1 });
    const token = await createHandoff('https://example.com/x.md', 'text', {
      addressBarEntered: false,
    });

    await clearCache();

    expect(await getRecents()).toHaveLength(0);
    expect(await getBookmarks()).toHaveLength(0);
    expect(await getHandle('h1')).toBeUndefined();
    expect(await readAndDeleteHandoff(token)).toBeUndefined();
    expect((await getSettings()).theme).toBe('dark');
  });

  it('annotations: adds, updates, deletes, and shards by document (ADR-0003/0004)', async () => {
    const { addAnnotation, getAnnotationsForDocument, updateAnnotation, deleteAnnotation } =
      await import('./index');
    const base = {
      id: 'ann-1',
      documentId: 'doc-a.md',
      exactText: 'hello',
      prefix: '',
      suffix: '',
      charOffsetAtCreation: 0,
      contentFingerprint: 'fp1',
      type: 'highlight' as const,
      createdAt: 1,
      updatedAt: 1,
      status: 'active' as const,
    };

    await addAnnotation('doc-a.md', base);
    await addAnnotation('doc-b.md', { ...base, id: 'ann-2', documentId: 'doc-b.md' });

    expect(await getAnnotationsForDocument('doc-a.md')).toHaveLength(1);
    expect(await getAnnotationsForDocument('doc-b.md')).toHaveLength(1);

    await updateAnnotation('doc-a.md', 'ann-1', { commentText: 'note' });
    const updated = await getAnnotationsForDocument('doc-a.md');
    expect(updated[0]?.commentText).toBe('note');
    expect(updated[0]?.updatedAt).toBeGreaterThanOrEqual(base.updatedAt);

    await deleteAnnotation('doc-a.md', 'ann-1');
    expect(await getAnnotationsForDocument('doc-a.md')).toHaveLength(0);
    // Untouched — sharded storage means one document's delete never reaches another's key.
    expect(await getAnnotationsForDocument('doc-b.md')).toHaveLength(1);
  });

  it('clearCache never touches annotations; deleteAllAnnotations is the only path that does', async () => {
    const {
      addAnnotation,
      clearCache,
      deleteAllAnnotations,
      getAnnotationsForDocument,
      getTotalAnnotationsCount,
    } = await import('./index');
    const annotation = {
      id: 'ann-1',
      documentId: 'doc.md',
      exactText: 'hi',
      prefix: '',
      suffix: '',
      charOffsetAtCreation: 0,
      contentFingerprint: 'fp',
      type: 'highlight' as const,
      createdAt: 1,
      updatedAt: 1,
      status: 'active' as const,
    };
    await addAnnotation('doc.md', annotation);
    expect(await getTotalAnnotationsCount()).toBe(1);

    await clearCache();
    expect(await getAnnotationsForDocument('doc.md')).toHaveLength(1);

    await deleteAllAnnotations();
    expect(await getAnnotationsForDocument('doc.md')).toHaveLength(0);
    expect(await getTotalAnnotationsCount()).toBe(0);
  });

  it('getStorageUsage reports bytes-in-use and the manifest quota', async () => {
    const { getStorageUsage, setSettings } = await import('./index');
    await setSettings({ theme: 'dark' });
    const { bytesInUse, quotaBytes } = await getStorageUsage();
    expect(bytesInUse).toBeGreaterThan(0);
    expect(quotaBytes).toBe(10_485_760);
  });
});
