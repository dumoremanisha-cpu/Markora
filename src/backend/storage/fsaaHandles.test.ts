import { describe, expect, it } from 'vitest';
import { LAST_FOLDER_HANDLE_ID, deleteHandle, getHandle, putHandle } from './fsaaHandles';

// A real FileSystemDirectoryHandle is browser-cloneable via a special
// internal hook that fake-indexeddb (used here for jsdom) does not emulate,
// and Playwright cannot fabricate a real one at all (DEVELOPMENT.md Spike
// 3). This plain stand-in is enough to exercise the store's own put/get/
// delete wiring — the store's job is CRUD-by-id, not handle serialization.
function fakeHandle(name: string): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

describe('fsaaHandles store (ADR-0001 Flow B, F80)', () => {
  it('round-trips a stored handle record', async () => {
    await putHandle(LAST_FOLDER_HANDLE_ID, 'my-docs', fakeHandle('my-docs'));
    const record = await getHandle(LAST_FOLDER_HANDLE_ID);
    expect(record?.name).toBe('my-docs');
    expect(record?.id).toBe(LAST_FOLDER_HANDLE_ID);
  });

  it('overwrites an existing record for the same id', async () => {
    await putHandle('bookmark-1', 'first', fakeHandle('first'));
    await putHandle('bookmark-1', 'second', fakeHandle('second'));
    const record = await getHandle('bookmark-1');
    expect(record?.name).toBe('second');
  });

  it('deletes a record', async () => {
    await putHandle('to-delete', 'gone', fakeHandle('gone'));
    await deleteHandle('to-delete');
    expect(await getHandle('to-delete')).toBeUndefined();
  });

  it('returns undefined for an id that was never stored', async () => {
    expect(await getHandle('never-stored')).toBeUndefined();
  });
});
