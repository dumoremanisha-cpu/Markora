// Spike-only TTL, short enough to assert against in a test without a real
// wait; ADR-0006 §2 specifies ~60s for the real implementation.
const TTL_MS = 2000;
const DB_NAME = 'markora-spike5-handoff';
const STORE = 'handoff';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'token' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sweepExpired() {
  const db = await openDb();
  const now = Date.now();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (now - cursor.value.createdAt > TTL_MS) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

// TTL sweep at service-worker start-up, per ADR-0006 §2.
sweepExpired();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'handoff/create') return undefined;
  (async () => {
    await sweepExpired();
    const db = await openDb();
    const token = crypto.randomUUID();
    const record = {
      token,
      url: message.url,
      text: message.text,
      hints: message.hints,
      createdAt: Date.now(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
    sendResponse({ token });
  })();
  return true; // keep the message channel open for the async response
});

// Exposed for the viewer page and for the test to force a sweep check.
self.__markoraSpike5 = { openDb, DB_NAME, STORE, TTL_MS };
