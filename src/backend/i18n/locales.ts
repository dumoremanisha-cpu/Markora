// Locale metadata for the 19-language baseline (ADR-0007 §3,
// docs/specs/05-ux-i18n-accessibility.md §5). Kept dependency-free and
// side-effect-free so `resolveLocale` stays a plain, independently unit-
// testable function — no chrome.* or navigator reads happen in here.
export type LocaleTag =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt-BR'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'ja'
  | 'ko'
  | 'vi'
  | 'id'
  | 'ar'
  | 'fa'
  | 'ur'
  | 'he';

export const AVAILABLE_LOCALES: readonly LocaleTag[] = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt-BR',
  'nl',
  'pl',
  'ru',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'vi',
  'id',
  'ar',
  'fa',
  'ur',
  'he',
];

/** RTL scripts (ADR-0007 §4 / 05-ux-i18n-accessibility.md §6). */
export const RTL_LOCALES: ReadonlySet<LocaleTag> = new Set(['ar', 'fa', 'ur', 'he']);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale as LocaleTag);
}

/**
 * ADR-0007 §3: base-tag truncation alone gives the wrong Chinese variant
 * (`zh-HK` truncated to `zh` would otherwise resolve no better than `zh-CN`
 * would), so Chinese needs an explicit alias table instead. Keys are
 * lowercase BCP-47 tags.
 */
const CHINESE_ALIASES: Record<string, LocaleTag> = {
  zh: 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-hans': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-hant': 'zh-Hant',
  'zh-mo': 'zh-Hant',
};

/**
 * ADR-0007 §3's resolve() algorithm. Pure: `uiLanguage`/`navigatorLanguages`
 * are parameters rather than live `chrome.i18n`/`navigator` reads so this
 * stays unit-testable against arbitrary inputs. `resolveActiveLocale` in
 * `./index.ts` supplies the real browser values at call sites.
 */
export function resolveLocale(
  setting: string,
  uiLanguage?: string,
  navigatorLanguages: readonly string[] = [],
): LocaleTag {
  const candidates = setting === 'auto' ? [uiLanguage, ...navigatorLanguages] : [setting];
  for (const raw of candidates) {
    if (!raw) continue;
    const lower = raw.trim().toLowerCase();
    if (!lower) continue;

    const exact = AVAILABLE_LOCALES.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;

    const alias = CHINESE_ALIASES[lower];
    if (alias) return alias;

    const base = lower.split('-')[0];
    // Chinese is handled above via the explicit alias map; a generic
    // base-tag match here would pick an arbitrary (wrong) variant.
    if (base === 'zh') continue;
    const baseMatch = AVAILABLE_LOCALES.find(
      (l) => l.toLowerCase() === base || l.toLowerCase().startsWith(`${base}-`),
    );
    if (baseMatch) return baseMatch;
  }
  return 'en';
}
