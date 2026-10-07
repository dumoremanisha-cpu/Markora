// Extension-origin IndexedDB store for File System Access handles (ADR-0001
// Flow B, F80). Deliberately separate from chrome.storage.local, which
// cannot serialize a FileSystemHandle (ADR-0004) — mirrors the pattern
// already used for handoff records (src/storage/handoff.ts), in its own
// database so "Clear Cache" (F55) can never accidentally reach it: clearing
// a stored folder handle would silently disconnect the user's folder, which
// functional-requirements.md §32's scope table explicitly forbids.
export interface HandleRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  createdAt: number;
}

const DB_NAME = 'markora-fsaa-handles';
const DB_VERSION = 1;
const STORE = 'handles';

/** Well-known id for the most-recently-opened folder (F80's silent-reconnect target), distinct from a user-created bookmark's id. */
export const LAST_FOLDER_HANDLE_ID = 'lastFolder';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as DOMException);
  });
}

export async function putHandle(
  id: string,
  name: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb();
  const record: HandleRecord = { id, name, handle, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as DOMException);
  });
  db.close();
}

export async function getHandle(id: string): Promise<HandleRecord | undefined> {
  const db = await openDb();
  const record = await new Promise<HandleRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as HandleRecord | undefined);
    req.onerror = () => reject(req.error as DOMException);
  });
  db.close();
  return record;
}

export async function deleteHandle(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as DOMException);
  });
  db.close();
}
