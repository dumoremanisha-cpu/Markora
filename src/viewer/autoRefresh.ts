// Auto-refresh (F23, F74) — polls the currently open local document for
// external changes. Two access flows per ADR-0001: Flow A (`file://`
// navigation) re-fetches and diffs content (no reliable Last-Modified via
// fetch); Flow B (FSAA handle) polls the reliable `lastModified` timestamp.
// Runs from the viewer page itself, never the background service worker
// (MV3 service-worker lifetime makes a background timer unreliable).
export type RefreshSource =
  { kind: 'fileUrl'; url: string } | { kind: 'fileHandle'; handle: FileSystemFileHandle };

export interface AutoRefreshOptions {
  intervalMs: number;
  /**
   * `lastModified` is only ever passed for the `fileHandle` flow — a real
   * `File.lastModified` already fetched here to detect the change in the
   * first place. `fileUrl` polling never has a reliable one (see the module
   * comment above), so it's omitted there rather than guessed.
   */
  onChanged: (text: string, lastModified?: number) => void;
  onError?: (err: unknown) => void;
}

/** Non-cryptographic — only used to notice a content change, never for integrity. */
function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
}

async function readFileUrlSignature(
  url: string,
): Promise<{ text: string; signature: string } | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  return { text, signature: `${text.length}:${simpleHash(text)}` };
}

/** Starts polling `source` and returns a stop function. Pauses while `document.hidden` (F74) and re-checks immediately on refocus rather than waiting out the remaining interval. */
export function startAutoRefresh(source: RefreshSource, options: AutoRefreshOptions): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSignature: string | number | undefined;

  async function checkOnce(): Promise<void> {
    try {
      if (source.kind === 'fileUrl') {
        const result = await readFileUrlSignature(source.url);
        // `stop()` (a new document loading elsewhere) can land while the
        // `await` above was in flight — this poller's `tick()`/`.then()`
        // guard against *scheduling another check*, but without this too,
        // a check already past its own `await` would still fire `onChanged`
        // for a document that's no longer the open one, splicing its text
        // into whatever the user has since navigated to (caught live: this
        // is exactly what corrupted a just-created annotation onto the
        // wrong document during rapid back/forward navigation).
        if (stopped) return;
        if (!result) return;
        if (lastSignature === undefined) {
          lastSignature = result.signature;
          return;
        }
        if (result.signature !== lastSignature) {
          lastSignature = result.signature;
          options.onChanged(result.text);
        }
      } else {
        const file = await source.handle.getFile();
        if (stopped) return;
        if (lastSignature === undefined) {
          lastSignature = file.lastModified;
          return;
        }
        if (file.lastModified !== lastSignature) {
          lastSignature = file.lastModified;
          const text = await file.text();
          if (stopped) return;
          options.onChanged(text, file.lastModified);
        }
      }
    } catch (err) {
      options.onError?.(err);
    }
  }

  function tick(): void {
    if (stopped || document.hidden) return;
    void checkOnce().then(() => {
      if (stopped) return;
      timer = setTimeout(tick, options.intervalMs);
    });
  }

  function onVisibilityChange(): void {
    clearTimeout(timer);
    if (!document.hidden) tick();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  tick();

  return function stop(): void {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
