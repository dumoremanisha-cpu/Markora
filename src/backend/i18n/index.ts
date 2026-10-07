// Runtime UI string catalog + t() accessor (ADR-0007). Separate from
// _locales/, which only covers the handful of Chrome-owned manifest strings.
// English is bundled synchronously; the other 18 locales (Phase 8) are
// lazy-loaded on selection so a 19-catalog bundle never ships at startup.
import en from './locales/en.json';
import { AVAILABLE_LOCALES, isRtlLocale, resolveLocale } from './locales';
import type { LocaleTag } from './locales';

export type Catalog = Record<string, string>;

const ENGLISH: Catalog = en;

// One dynamic import per locale so Vite code-splits each catalog into its
// own chunk — selecting "Français" should not pull in the other 17.
const CATALOG_LOADERS: Record<LocaleTag, () => Promise<Catalog>> = {
  en: async () => ENGLISH,
  es: () => import('./locales/es.json').then((m) => m.default as Catalog),
  fr: () => import('./locales/fr.json').then((m) => m.default as Catalog),
  de: () => import('./locales/de.json').then((m) => m.default as Catalog),
  it: () => import('./locales/it.json').then((m) => m.default as Catalog),
  'pt-BR': () => import('./locales/pt-BR.json').then((m) => m.default as Catalog),
  nl: () => import('./locales/nl.json').then((m) => m.default as Catalog),
  pl: () => import('./locales/pl.json').then((m) => m.default as Catalog),
  ru: () => import('./locales/ru.json').then((m) => m.default as Catalog),
  'zh-Hans': () => import('./locales/zh-Hans.json').then((m) => m.default as Catalog),
  'zh-Hant': () => import('./locales/zh-Hant.json').then((m) => m.default as Catalog),
  ja: () => import('./locales/ja.json').then((m) => m.default as Catalog),
  ko: () => import('./locales/ko.json').then((m) => m.default as Catalog),
  vi: () => import('./locales/vi.json').then((m) => m.default as Catalog),
  id: () => import('./locales/id.json').then((m) => m.default as Catalog),
  ar: () => import('./locales/ar.json').then((m) => m.default as Catalog),
  fa: () => import('./locales/fa.json').then((m) => m.default as Catalog),
  ur: () => import('./locales/ur.json').then((m) => m.default as Catalog),
  he: () => import('./locales/he.json').then((m) => m.default as Catalog),
};

let activeLocale: LocaleTag = 'en';
let activeCatalog: Catalog = ENGLISH;

export function getActiveLocale(): LocaleTag {
  return activeLocale;
}

/** The application-chrome text direction for the active locale (ADR-0007 §4) — never the document-content direction, which is per-block (`src/viewer/markdown/plugins/rtlAuto.ts`). */
export function getActiveDirection(): 'ltr' | 'rtl' {
  return isRtlLocale(activeLocale) ? 'rtl' : 'ltr';
}

const changeListeners = new Set<(locale: LocaleTag) => void>();

/** Subscribes to locale changes (ADR-0007 §4's `i18n:changed`). Also dispatched as a `window` CustomEvent of the same name for surfaces that prefer a DOM event over an import. */
export function onLocaleChange(callback: (locale: LocaleTag) => void): () => void {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}

function notifyLocaleChanged(): void {
  for (const listener of changeListeners) listener(activeLocale);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { locale: activeLocale } }));
  }
}

/** Reads the real `chrome.i18n`/`navigator` inputs `resolveLocale` needs for "auto" — guarded for non-extension/test contexts, where both are simply absent. */
export function resolveActiveLocale(setting: string): LocaleTag {
  const uiLanguage =
    typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : undefined;
  const navigatorLanguages =
    typeof navigator !== 'undefined' && navigator.languages ? navigator.languages : [];
  return resolveLocale(setting, uiLanguage, navigatorLanguages);
}

/**
 * Resolves and activates a locale from a stored `Settings.language` value
 * ("auto" or an explicit tag) — every call site (bootstrap, a live settings
 * change) shares this one resolution + load path. No-ops (without
 * dispatching a change) when the resolved locale is already active.
 */
export async function setLocale(setting: string): Promise<void> {
  const resolved = resolveActiveLocale(setting);
  if (resolved === activeLocale) return;
  const loader = CATALOG_LOADERS[resolved] ?? CATALOG_LOADERS.en;
  try {
    activeCatalog = resolved === 'en' ? ENGLISH : await loader();
    activeLocale = resolved;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] failed to load locale catalog "${resolved}"; using English.`, err);
    }
    activeCatalog = ENGLISH;
    activeLocale = 'en';
  }
  notifyLocaleChanged();
}

/**
 * Resolves a catalog key to its localized string, interpolating named
 * placeholders. Falls back to the English catalog, then to the key's last
 * dotted segment (never an empty string, never the raw key in production).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = activeCatalog[key] ?? ENGLISH[key];
  if (template === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing catalog key: "${key}"`);
    }
    const segments = key.split('.');
    return segments[segments.length - 1] ?? key;
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export { AVAILABLE_LOCALES, isRtlLocale, resolveLocale };
export type { LocaleTag };
