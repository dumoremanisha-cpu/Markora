// F30 / ADR-0005 — embeds an exported document's `<img>` sources as base64
// `data:` URLs so the exported file is fully offline/portable. An image
// already sanctioned by the URL-scheme allowlist (security-privacy.md §3)
// is fetched client-side only — this never sends anything the open document
// didn't already reference, and nothing leaves the browser except the
// fetch of that same image the live viewer would have made anyway.
export const MAX_EMBED_BYTES = 5 * 1024 * 1024; // ~5 MB per image, per spec §24.

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Mutates every `<img src>` under `root` in place: fetches it, and if it's
 * under {@link MAX_EMBED_BYTES}, replaces `src` with a base64 `data:` URL.
 * Already-`data:` images are left untouched (nothing to embed). Anything
 * that fails to fetch, or exceeds the cap, is left pointing at its original
 * source — the documented link-out fallback, not a silent failure.
 * Identical sources are only fetched once.
 */
export async function embedImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  const cache = new Map<string, Promise<string | null>>();

  async function resolve(src: string): Promise<string | null> {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size > MAX_EMBED_BYTES) return null;
      return await blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      let pending = cache.get(src);
      if (!pending) {
        pending = resolve(src);
        cache.set(src, pending);
      }
      const dataUrl = await pending;
      if (dataUrl) img.setAttribute('src', dataUrl);
    }),
  );
}
