// Curated highlight.js theme selection (F70). Each theme's CSS is its own
// dynamic-import chunk under ./theme-files/ — loaded on demand rather than
// bundling all ~14 stylesheets up front. Settings UI to actually switch
// between them arrives in Phase 2-B; this phase only needs the loading
// mechanism plus applying whatever `Settings.highlightTheme` says at boot.
import type { HighlightThemeKey } from '../../storage/schema';

const LOADERS: Record<HighlightThemeKey, () => Promise<{ default: string }>> = {
  github: () => import('./theme-files/github'),
  'github-dark': () => import('./theme-files/github-dark'),
  monokai: () => import('./theme-files/monokai'),
  'monokai-sublime': () => import('./theme-files/monokai-sublime'),
  nord: () => import('./theme-files/nord'),
  'atom-one-light': () => import('./theme-files/atom-one-light'),
  'atom-one-dark': () => import('./theme-files/atom-one-dark'),
  vs: () => import('./theme-files/vs'),
  vs2015: () => import('./theme-files/vs2015'),
  xcode: () => import('./theme-files/xcode'),
  'a11y-light': () => import('./theme-files/a11y-light'),
  'a11y-dark': () => import('./theme-files/a11y-dark'),
  'tokyo-night-light': () => import('./theme-files/tokyo-night-light'),
  'tokyo-night-dark': () => import('./theme-files/tokyo-night-dark'),
};

export const HIGHLIGHT_THEME_KEYS = Object.keys(LOADERS) as HighlightThemeKey[];

/**
 * `'github'` is `DEFAULT_SETTINGS.highlightTheme` (schema.ts) — a light
 * theme — while `Settings.theme` defaults to `'system'`, so a fresh install
 * whose OS is in dark mode previously rendered every code block with a
 * bright white background against the rest of the now-dark UI. There is no
 * "auto" tri-state for `highlightTheme` (adding one is a settings-schema
 * change, out of scope here), so this can't distinguish "never touched"
 * from "user explicitly re-picked github" — it only pairs the untouched
 * shipped default with the resolved app theme; any other stored value,
 * `'github'` included via Settings, is applied exactly as chosen.
 */
export function resolveEffectiveHighlightTheme(
  key: HighlightThemeKey,
  resolvedAppTheme: 'light' | 'dark',
): HighlightThemeKey {
  if (key === 'github' && resolvedAppTheme === 'dark') return 'github-dark';
  return key;
}

let loaded: HighlightThemeKey | null = null;
const LINK_ELEMENT_ID = 'markora-hljs-theme';

/**
 * Loads and applies a curated highlight.js theme's stylesheet by pointing a
 * single managed `<link>` element at its URL, swapping `href` on every call
 * rather than leaving each theme's own `<link>`/`<style>` tag in the DOM
 * forever. That single-element-swap design is required, not cosmetic: this
 * function is now called every time the resolved theme changes at runtime
 * (live app-theme toggling, and a live `Settings.highlightTheme` change) —
 * not just once at boot — and the previous approach (a side-effect CSS
 * import per theme, cached by the dynamic `import()` after first load) left
 * every previously-loaded theme's stylesheet in the DOM permanently.
 * Switching back to an earlier theme after a later one had also been loaded
 * didn't reliably win the CSS cascade, since the earlier theme's tag stayed
 * in its original (earlier) DOM position — a real, previously-documented
 * bug (`docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md` Phase 3). Swapping one
 * element's `href` guarantees exactly one theme's rules are ever active.
 */
export async function applyHighlightTheme(key: HighlightThemeKey): Promise<void> {
  if (loaded === key) return;
  const loader = LOADERS[key] ?? LOADERS.github;
  const { default: href } = await loader();
  let link = document.getElementById(LINK_ELEMENT_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = LINK_ELEMENT_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
  loaded = key;
}
