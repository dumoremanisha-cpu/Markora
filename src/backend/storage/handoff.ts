// Extension-origin IndexedDB store for the content-script -> viewer handoff
// (ADR-0006 §2). Deliberately separate from chrome.storage.local: document
// text is transient, single-use, and TTL-swept — it must never sit in the
// same store as durable settings/recents/bookmarks data.
export interface HandoffRecord {
  token: string;
  url: string;
  text: string;
  hints: { addressBarEntered: boolean };
  createdAt: number;
}

const DB_NAME = 'markora-handoff';
const DB_VERSION = 1;
const STORE = 'handoff';
// ADR-0006 §2: "e.g. 60s" — long enough to cover the content-script ->
// viewer navigation, short enough that an abandoned record doesn't linger.
export const HANDOFF_TTL_MS = 60_000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'token' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as DOMException);
  });
}

/** Deletes every record older than the TTL. Run at service-worker start-up and before each new write. */
export async function sweepExpiredHandoffs(now = Date.now()): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const record = cursor.value as HandoffRecord;
      if (now - record.createdAt > HANDOFF_TTL_MS) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as DOMException);
  });
  db.close();
}

/** Deletes every handoff record unconditionally — the "Clear Cache" (F55) action's immediate cleanup, distinct from the passive TTL sweep above. A record mid-navigation at the moment this runs is lost, same as any TTL expiry; both are already-accepted, documented behavior (ADR-0006 §2). */
export async function clearAllHandoffs(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as DOMException);
  });
  db.close();
}

export async function createHandoff(
  url: string,
  text: string,
  hints: HandoffRecord['hints'],
): Promise<string> {
  await sweepExpiredHandoffs();
  const db = await openDb();
  const token = crypto.randomUUID();
  const record: HandoffRecord = { token, url, text, hints, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error as DOMException);
  });
  db.close();
  return token;
}

/** Reads a handoff record and deletes it in the same transaction — single-use (ADR-0006 §2). */
export async function readAndDeleteHandoff(token: string): Promise<HandoffRecord | undefined> {
  const db = await openDb();
  const record = await new Promise<HandoffRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(token);
    getReq.onsuccess = () => {
      const value = getReq.result as HandoffRecord | undefined;
      if (value) store.delete(token);
      resolve(value);
    };
    getReq.onerror = () => reject(getReq.error as DOMException);
  });
  db.close();
  return record;
}
