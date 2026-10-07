// Application-chrome text direction (ADR-0007 §4, F81 live-apply scope —
// same category as `applyLiveSettings()`'s content-width/sticky-table
// toggles in `src/viewer/index.ts`: a class/attribute change, never a
// re-render). Applies to `document.documentElement` only — the root every
// extension page's chrome is laid out against. Document CONTENT direction
// is a wholly separate, per-block concern owned by
// `src/viewer/markdown/plugins/rtlAuto.ts`'s `dir="auto"`, independent of
// UI language (an English UI reading an Arabic document, and vice versa,
// must both render correctly).
import { getActiveLocale, isRtlLocale } from '../i18n';
import type { Settings } from '../storage';

export type ResolvedDirection = 'ltr' | 'rtl';

export function resolveChromeDirection(
  settings: Pick<Settings, 'textDirectionOverride'>,
): ResolvedDirection {
  if (settings.textDirectionOverride === 'ltr') return 'ltr';
  if (settings.textDirectionOverride === 'rtl') return 'rtl';
  return isRtlLocale(getActiveLocale()) ? 'rtl' : 'ltr';
}

function apply(settings: Settings): void {
  document.documentElement.dir = resolveChromeDirection(settings);
  document.documentElement.lang = getActiveLocale();
}

/**
 * Applies the chrome-root `dir`/`lang`. Call after the active locale for
 * this bootstrap/change has already been set via `setLocale()` — direction
 * resolution reads `getActiveLocale()`. Named "reapply" rather than "apply"
 * since every call site already has `Settings` in hand (bootstrap's initial
 * read, or a live `onSettingsChanged` callback) — there is no bare "read
 * settings and apply" entry point to keep separate.
 */
export function reapplyDirection(settings: Settings): void {
  apply(settings);
}
