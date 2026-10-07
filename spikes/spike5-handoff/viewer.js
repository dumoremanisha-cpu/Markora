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

(async () => {
  const params = new URLSearchParams(location.search);
  const token = params.get('h');
  const db = await openDb();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(token);
    getReq.onsuccess = () => {
      const value = getReq.result;
      if (value) store.delete(token);
      resolve(value);
    };
    getReq.onerror = () => reject(getReq.error);
  });

  if (!record) {
    document.getElementById('status').textContent = 'no-record';
    return;
  }
  document.getElementById('status').textContent = 'ok';
  document.getElementById('hash').textContent = location.hash;
  document.getElementById('length').textContent = String(record.text.length);
  window.__markoraSpike5Text = record.text;
})();
