// F31/ADR-0005 §4 task 3, tier 2 — rasterizes a KaTeX rendering to a PNG for
// constructs tier 1 (math.ts) can't map to OMML. Runs entirely in the viewer
// page (a DOM/canvas capability, consistent with code-conventions.md §3's
// "viewer page = the actual application"), never in the background worker.
//
// Technique: render the math with KaTeX, measure it by laying it out
// offscreen in the live document (KaTeX's box model needs a real layout
// pass — there's no way to compute it without one), then draw it through an
// SVG `<foreignObject>` (a self-contained `<style>` with every font/rule it
// needs, from mathFonts.ts — an SVG loaded as a standalone image has no
// access to the host document's stylesheets) into a `<canvas>` at ~2x scale
// for a crisp raster, and read the canvas back out as PNG bytes. Any failure
// at any step returns `null` — the orchestration in math.ts falls back to
// tier 3 (italic source text), never aborts the export.
import { sanitizeMathHtml } from '../../viewer/sanitization';
import { getSelfContainedKatexCss } from './mathFonts';
import type { MathRasterizer, RasterizedMath } from './math';

const RASTER_SCALE = 2;

interface KatexLike {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

let katexPromise: Promise<KatexLike> | null = null;

function loadKatex(): Promise<KatexLike> {
  katexPromise ??= import('katex').then(
    (mod) => (mod as unknown as { default?: KatexLike }).default ?? (mod as unknown as KatexLike),
  );
  return katexPromise;
}

/** Lays `html` out offscreen (not `display:none` — that skips layout entirely) just long enough to measure its natural box. */
function measure(html: string): { width: number; height: number } {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.visibility = 'hidden';
  container.style.whiteSpace = 'nowrap';
  container.innerHTML = html;
  document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  document.body.removeChild(container);
  return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

function buildSvg(html: string, css: string, width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>` +
    `<div class="katex-raster-root" style="display:inline-block;">${html}</div></div>` +
    `</foreignObject></svg>`
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG rasterization image failed to load'));
    img.src = src;
  });
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas.toBlob returned null');
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/** The real, browser-backed {@link MathRasterizer}. Wired into `math.ts`'s `buildMathContent` by `astMapper.ts`; kept as a separate injectable function so `math.ts`'s tier-selection logic stays unit-testable without a real canvas. */
export const rasterizeLatexToPng: MathRasterizer = async (
  latex: string,
  displayMode: boolean,
): Promise<RasterizedMath | null> => {
  try {
    const katex = await loadKatex();
    const rendered = sanitizeMathHtml(
      katex.renderToString(latex, { throwOnError: true, displayMode }),
    );
    const { width, height } = measure(rendered);
    if (width <= 0 || height <= 0) return null;

    const css = await getSelfContainedKatexCss();
    const svg = buildSvg(rendered, css, width, height);
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await loadImage(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = width * RASTER_SCALE;
      canvas.height = height * RASTER_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = await canvasToPngBytes(canvas);
      return { data, widthPx: width, heightPx: height };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return null;
  }
};
