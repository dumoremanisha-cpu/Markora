// Tier-2 math rasterization (mathRaster.ts) draws KaTeX's rendered HTML
// inside an SVG `<foreignObject>` so it can go through `<canvas>` to a PNG —
// but an SVG loaded as a standalone image (`new Image()`, no access to the
// host page's stylesheets) needs every font it uses declared *inside its own
// `<style>`*, as `@font-face` rules with a `src` the image-loading context
// can actually resolve. A `chrome-extension://` URL works for the live
// extension but not for this module's own unit tests; a `data:` URI always
// works, is self-contained, and these ~20 KaTeX font files are only ~260 KB
// total (see the woff2 imports below) — cheap enough to inline once and
// cache in memory for the tab's lifetime.
import katexCssRaw from 'katex/dist/katex.min.css?raw';

const FONT_FILES = {
  'KaTeX_AMS-Regular': () => import('katex/dist/fonts/KaTeX_AMS-Regular.woff2'),
  'KaTeX_Caligraphic-Bold': () => import('katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2'),
  'KaTeX_Caligraphic-Regular': () => import('katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2'),
  'KaTeX_Fraktur-Bold': () => import('katex/dist/fonts/KaTeX_Fraktur-Bold.woff2'),
  'KaTeX_Fraktur-Regular': () => import('katex/dist/fonts/KaTeX_Fraktur-Regular.woff2'),
  'KaTeX_Main-Bold': () => import('katex/dist/fonts/KaTeX_Main-Bold.woff2'),
  'KaTeX_Main-BoldItalic': () => import('katex/dist/fonts/KaTeX_Main-BoldItalic.woff2'),
  'KaTeX_Main-Italic': () => import('katex/dist/fonts/KaTeX_Main-Italic.woff2'),
  'KaTeX_Main-Regular': () => import('katex/dist/fonts/KaTeX_Main-Regular.woff2'),
  'KaTeX_Math-BoldItalic': () => import('katex/dist/fonts/KaTeX_Math-BoldItalic.woff2'),
  'KaTeX_Math-Italic': () => import('katex/dist/fonts/KaTeX_Math-Italic.woff2'),
  'KaTeX_SansSerif-Bold': () => import('katex/dist/fonts/KaTeX_SansSerif-Bold.woff2'),
  'KaTeX_SansSerif-Italic': () => import('katex/dist/fonts/KaTeX_SansSerif-Italic.woff2'),
  'KaTeX_SansSerif-Regular': () => import('katex/dist/fonts/KaTeX_SansSerif-Regular.woff2'),
  'KaTeX_Script-Regular': () => import('katex/dist/fonts/KaTeX_Script-Regular.woff2'),
  'KaTeX_Size1-Regular': () => import('katex/dist/fonts/KaTeX_Size1-Regular.woff2'),
  'KaTeX_Size2-Regular': () => import('katex/dist/fonts/KaTeX_Size2-Regular.woff2'),
  'KaTeX_Size3-Regular': () => import('katex/dist/fonts/KaTeX_Size3-Regular.woff2'),
  'KaTeX_Size4-Regular': () => import('katex/dist/fonts/KaTeX_Size4-Regular.woff2'),
  'KaTeX_Typewriter-Regular': () => import('katex/dist/fonts/KaTeX_Typewriter-Regular.woff2'),
} as const;

type FontKey = keyof typeof FONT_FILES;

/** family/style/weight per file — mirrors katex.min.css's own `@font-face` declarations exactly (verified against the installed katex package's stylesheet). */
const FONT_META: Record<
  FontKey,
  { family: string; style: 'normal' | 'italic'; weight: 400 | 700 }
> = {
  'KaTeX_AMS-Regular': { family: 'KaTeX_AMS', style: 'normal', weight: 400 },
  'KaTeX_Caligraphic-Bold': { family: 'KaTeX_Caligraphic', style: 'normal', weight: 700 },
  'KaTeX_Caligraphic-Regular': { family: 'KaTeX_Caligraphic', style: 'normal', weight: 400 },
  'KaTeX_Fraktur-Bold': { family: 'KaTeX_Fraktur', style: 'normal', weight: 700 },
  'KaTeX_Fraktur-Regular': { family: 'KaTeX_Fraktur', style: 'normal', weight: 400 },
  'KaTeX_Main-Bold': { family: 'KaTeX_Main', style: 'normal', weight: 700 },
  'KaTeX_Main-BoldItalic': { family: 'KaTeX_Main', style: 'italic', weight: 700 },
  'KaTeX_Main-Italic': { family: 'KaTeX_Main', style: 'italic', weight: 400 },
  'KaTeX_Main-Regular': { family: 'KaTeX_Main', style: 'normal', weight: 400 },
  'KaTeX_Math-BoldItalic': { family: 'KaTeX_Math', style: 'italic', weight: 700 },
  'KaTeX_Math-Italic': { family: 'KaTeX_Math', style: 'italic', weight: 400 },
  'KaTeX_SansSerif-Bold': { family: 'KaTeX_SansSerif', style: 'normal', weight: 700 },
  'KaTeX_SansSerif-Italic': { family: 'KaTeX_SansSerif', style: 'italic', weight: 400 },
  'KaTeX_SansSerif-Regular': { family: 'KaTeX_SansSerif', style: 'normal', weight: 400 },
  'KaTeX_Script-Regular': { family: 'KaTeX_Script', style: 'normal', weight: 400 },
  'KaTeX_Size1-Regular': { family: 'KaTeX_Size1', style: 'normal', weight: 400 },
  'KaTeX_Size2-Regular': { family: 'KaTeX_Size2', style: 'normal', weight: 400 },
  'KaTeX_Size3-Regular': { family: 'KaTeX_Size3', style: 'normal', weight: 400 },
  'KaTeX_Size4-Regular': { family: 'KaTeX_Size4', style: 'normal', weight: 400 },
  'KaTeX_Typewriter-Regular': { family: 'KaTeX_Typewriter', style: 'normal', weight: 400 },
};

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function buildFontFaceCss(): Promise<string> {
  const entries = await Promise.all(
    (Object.keys(FONT_FILES) as FontKey[]).map(async (key) => {
      const mod = await FONT_FILES[key]();
      const url = mod.default;
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = bufferToBase64(buffer);
      const meta = FONT_META[key];
      return (
        `@font-face{font-family:"${meta.family}";font-style:${meta.style};` +
        `font-weight:${meta.weight};src:url(data:font/woff2;base64,${base64}) format("woff2");}`
      );
    }),
  );
  return entries.join('\n');
}

let cssPromise: Promise<string> | null = null;

/** The full self-contained KaTeX CSS (structural rules from `katex.min.css` plus this module's own data-URI `@font-face` rules), suitable for embedding inside a standalone SVG `<style>`. Computed once per session. */
export function getSelfContainedKatexCss(): Promise<string> {
  cssPromise ??= buildFontFaceCss().then(
    (fontFaces) => `${fontFaces}\n${katexCssRaw.replace(/@font-face\{[^}]*\}/g, '')}`,
  );
  return cssPromise;
}
