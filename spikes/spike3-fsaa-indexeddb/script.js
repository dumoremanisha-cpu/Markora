const DB_NAME = 'markora-spike3-fsaa';
const STORE = 'handles';
const KEY = 'last-directory';
let currentHandle = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

document.getElementById('pick-dir').addEventListener('click', async () => {
  try {
    currentHandle = await window.showDirectoryPicker();
    setStatus(`picked: ${currentHandle.name}`);
  } catch (e) {
    setStatus(`pick-failed: ${e.message}`);
  }
});

document.getElementById('store').addEventListener('click', async () => {
  if (!currentHandle) return setStatus('no handle to store');
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(currentHandle, KEY);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
    setStatus(`stored: ${currentHandle.name}`);
  } catch (e) {
    setStatus(`store-failed: ${e.message}`);
  }
});

document.getElementById('retrieve').addEventListener('click', async () => {
  try {
    const db = await openDb();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!handle) return setStatus('retrieve-failed: no record');
    currentHandle = handle;
    setStatus(`retrieved: ${handle.name} (kind=${handle.kind})`);
  } catch (e) {
    setStatus(`retrieve-failed: ${e.message}`);
  }
});

document.getElementById('query-permission').addEventListener('click', async () => {
  if (!currentHandle) return setStatus('no handle to query');
  try {
    const permission = await currentHandle.queryPermission({ mode: 'read' });
    setStatus(`permission: ${permission}`);
  } catch (e) {
    setStatus(`query-failed: ${e.message}`);
  }
});
