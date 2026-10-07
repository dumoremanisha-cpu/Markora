// F31/ADR-0005 §4 task 4 — image embedding for DOCX. Fetches whatever literal
// `src` the Markdown source wrote (http(s), `data:`, `blob:`, or an absolute
// `file:///` URL the user has granted file-URL access to) — the same literal
// string the live renderer's default `image` rule puts straight into the DOM
// `<img src>` with no relative-path resolution of its own, so this mirrors
// exactly what HTML export's `embedImages` (`../html/imageEmbed.ts`) already
// fetches, keeping the three export formats' image-source behavior
// consistent. Never a general network capability: only URLs the open
// document itself references are ever requested (security-privacy.md §6),
// verified by this phase's Playwright network-request assertion.
import { ImageRun } from 'docx';
import type { IImageOptions } from 'docx';

/** Word renders an embedded image at this literal pixel size (96 DPI) — well beyond a page's printable width makes for an absurd multi-page-wide image, so large photos are scaled down proportionally; anything already smaller is left at its natural size. */
const MAX_WIDTH_PX = 600;

export interface DocxImage {
  imageRun: ImageRun;
  widthPx: number;
  heightPx: number;
}

const NATIVE_TYPES: ReadonlyArray<{ type: 'png' | 'jpg' | 'gif' | 'bmp'; magic: number[] }> = [
  { type: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { type: 'gif', magic: [0x47, 0x49, 0x46] },
  { type: 'bmp', magic: [0x42, 0x4d] },
];

function sniffNativeType(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  for (const { type, magic } of NATIVE_TYPES) {
    if (magic.every((byte, i) => bytes[i] === byte)) return type;
  }
  return null;
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .finally(() => URL.revokeObjectURL(url));
}

async function rasterizeToPng(img: HTMLImageElement): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas.toBlob returned null');
  return new Uint8Array(await blob.arrayBuffer());
}

function scaledDimensions(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= MAX_WIDTH_PX || naturalWidth === 0) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const scale = MAX_WIDTH_PX / naturalWidth;
  return { width: MAX_WIDTH_PX, height: Math.round(naturalHeight * scale) };
}

/** Fetches and decodes `src` for embedding; `null` on any failure (network, decode, unsupported/corrupt data) — the mapper falls back to a plain-text placeholder rather than aborting the export. */
export async function fetchImageForDocx(src: string): Promise<DocxImage | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const nativeType = sniffNativeType(bytes);
    const img = await loadImageElement(blob);
    const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight);
    if (width <= 0 || height <= 0) return null;

    const data = nativeType ? bytes : await rasterizeToPng(img);
    const options: IImageOptions = {
      type: nativeType ?? 'png',
      data,
      transformation: { width, height },
    };
    return { imageRun: new ImageRun(options), widthPx: width, heightPx: height };
  } catch {
    return null;
  }
}
