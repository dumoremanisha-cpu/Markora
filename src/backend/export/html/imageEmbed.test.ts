import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedImages, MAX_EMBED_BYTES } from './imageEmbed';

describe('embedImages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces an image src with a base64 data URL when the fetch succeeds and is under the cap', async () => {
    // A plain Uint8Array body with an explicit content-type header, not a
    // `Blob` — a `Blob` built against jsdom's global `Blob` class isn't
    // recognized by Node's (undici) `Response` constructor as a body of
    // that type across the two realms, and silently stringifies instead.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const root = document.createElement('div');
    root.innerHTML = '<img src="https://example.com/a.png" />';

    await embedImages(root);

    expect(root.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('leaves the original src untouched (link-out fallback) when the image exceeds the cap', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(MAX_EMBED_BYTES + 1), { status: 200 }),
    );
    const root = document.createElement('div');
    root.innerHTML = '<img src="https://example.com/big.png" />';

    await embedImages(root);

    expect(root.querySelector('img')!.getAttribute('src')).toBe('https://example.com/big.png');
  });

  it('leaves the original src untouched when the fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));
    const root = document.createElement('div');
    root.innerHTML = '<img src="https://example.com/missing.png" />';

    await embedImages(root);

    expect(root.querySelector('img')!.getAttribute('src')).toBe('https://example.com/missing.png');
  });

  it('leaves the original src untouched when the fetch throws (e.g. CORS/network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const root = document.createElement('div');
    root.innerHTML = '<img src="https://example.com/blocked.png" />';

    await embedImages(root);

    expect(root.querySelector('img')!.getAttribute('src')).toBe('https://example.com/blocked.png');
  });

  it('does not fetch an already-embedded data: URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const root = document.createElement('div');
    root.innerHTML = '<img src="data:image/png;base64,AAAA" />';

    await embedImages(root);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('only fetches an identical source once for multiple images', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const root = document.createElement('div');
    root.innerHTML =
      '<img src="https://example.com/a.png" /><img src="https://example.com/a.png" />';

    await embedImages(root);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const imgs = root.querySelectorAll('img');
    expect(imgs[0]!.getAttribute('src')).toMatch(/^data:/);
    expect(imgs[1]!.getAttribute('src')).toMatch(/^data:/);
  });
});
