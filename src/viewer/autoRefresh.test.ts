import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAutoRefresh } from './autoRefresh';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('startAutoRefresh — Flow A (file:// content diff)', () => {
  it('establishes a baseline on the first check without firing onChanged', async () => {
    const fetchMock = vi.fn(async () => new Response('v1'));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();

    startAutoRefresh({ kind: 'fileUrl', url: 'file:///doc.md' }, { intervalMs: 1000, onChanged });
    await vi.advanceTimersByTimeAsync(0);

    expect(onChanged).not.toHaveBeenCalled();
  });

  it('fires onChanged with the new text when content changes', async () => {
    let body = 'v1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const onChanged = vi.fn();

    startAutoRefresh({ kind: 'fileUrl', url: 'file:///doc.md' }, { intervalMs: 1000, onChanged });
    await vi.advanceTimersByTimeAsync(0); // baseline

    body = 'v2';
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChanged).toHaveBeenCalledWith('v2');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('does not fire again when content is unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('stable')),
    );
    const onChanged = vi.fn();

    startAutoRefresh({ kind: 'fileUrl', url: 'file:///doc.md' }, { intervalMs: 1000, onChanged });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('startAutoRefresh — Flow B (FSAA lastModified)', () => {
  function fakeFileHandle(getLastModified: () => number, text = 'content'): FileSystemFileHandle {
    return {
      kind: 'file',
      name: 'doc.md',
      getFile: async () =>
        ({ lastModified: getLastModified(), text: async () => text }) as unknown as File,
    } as unknown as FileSystemFileHandle;
  }

  it('fires onChanged when lastModified advances', async () => {
    let lastModified = 100;
    const onChanged = vi.fn();
    startAutoRefresh(
      { kind: 'fileHandle', handle: fakeFileHandle(() => lastModified) },
      { intervalMs: 1000, onChanged },
    );
    await vi.advanceTimersByTimeAsync(0); // baseline

    lastModified = 200;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

describe('startAutoRefresh — focus-aware pause/resume (F74)', () => {
  it('pauses polling while document.hidden is true, resumes immediately on visibilitychange', async () => {
    const fetchMock = vi.fn(async () => new Response('v1'));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();

    startAutoRefresh({ kind: 'fileUrl', url: 'file:///doc.md' }, { intervalMs: 1000, onChanged });
    await vi.advanceTimersByTimeAsync(0);
    const callsAfterBaseline = fetchMock.mock.calls.length;

    setHidden(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock.mock.calls.length).toBe(callsAfterBaseline);

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterBaseline);
  });
});

describe('startAutoRefresh — stop()', () => {
  it('stops future polling', async () => {
    const fetchMock = vi.fn(async () => new Response('v1'));
    vi.stubGlobal('fetch', fetchMock);

    const stop = startAutoRefresh(
      { kind: 'fileUrl', url: 'file:///doc.md' },
      { intervalMs: 1000, onChanged: vi.fn() },
    );
    await vi.advanceTimersByTimeAsync(0);
    const callsBeforeStop = fetchMock.mock.calls.length;

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeStop);
  });

  it('never calls onChanged for a check that was already past its own await when stop() runs (Flow B)', async () => {
    // Regression: rapidly switching documents calls stop() on the old
    // poller, but a check already inside its `await handle.getFile()` isn't
    // interrupted by that — without a `stopped` re-check right after the
    // await resolves, its `onChanged` still fired and spliced the old
    // file's text into whatever document the user had already switched to
    // (caught live via a just-created annotation ending up "orphaned" on
    // the wrong document after two fast document switches).
    const resolvers: Array<(file: unknown) => void> = [];
    const handle = {
      kind: 'file',
      name: 'doc.md',
      getFile: () => new Promise((resolve) => resolvers.push(resolve)),
    } as unknown as FileSystemFileHandle;
    const onChanged = vi.fn();

    const stop = startAutoRefresh({ kind: 'fileHandle', handle }, { intervalMs: 1000, onChanged });
    await vi.advanceTimersByTimeAsync(0); // baseline check starts, awaiting getFile()
    resolvers[0]?.({ lastModified: 100, text: async () => 'v1' });
    await vi.advanceTimersByTimeAsync(0); // baseline recorded (lastModified: 100)

    await vi.advanceTimersByTimeAsync(1000); // next check starts, awaiting getFile() again
    stop(); // the user switched documents while this check was in flight
    resolvers[1]?.({ lastModified: 200, text: async () => 'v2' }); // "changed" per lastModified
    await vi.advanceTimersByTimeAsync(0);

    expect(onChanged).not.toHaveBeenCalled();
  });
});
