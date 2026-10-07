// Shared locale/direction bootstrap for the three extension pages (viewer,
// popup, settings) — resolves + activates the stored language setting,
// applies chrome direction, and keeps both in sync with settings changes
// made anywhere (ADR-0007 §4). One place for this sequencing so all three
// entry points behave identically instead of re-deriving it.
import { setLocale } from '../i18n';
import { getSettings, onSettingsChanged } from '../storage';
import type { Settings } from '../storage';
import { reapplyDirection } from './direction';

/**
 * Resolves and activates the current locale and applies chrome direction,
 * then keeps both in sync with settings changes made anywhere: direction
 * re-applies live on every change (cheap, idempotent — same pattern as
 * `applyLiveSettings`), and a genuine language change reloads the catalog
 * and invokes `onLocaleChanged` once the new catalog is active — F37/F81
 * (`01-functional-requirements.md` §26/§28) require language switches to
 * apply live, not just at next load. `onLocaleChanged` is where each page
 * re-renders its own already-built chrome text; popup/settings pass a full
 * rebuild, the viewer passes a targeted per-component refresh (its loaded
 * document must survive the change, so it can't just tear everything down).
 */
export async function initI18nRuntime(onLocaleChanged?: () => void): Promise<Settings> {
  const settings = await getSettings();
  let lastLanguageSetting = settings.language;
  await setLocale(settings.language);
  reapplyDirection(settings);

  onSettingsChanged((next) => {
    reapplyDirection(next);
    if (next.language !== lastLanguageSetting) {
      lastLanguageSetting = next.language;
      void setLocale(next.language).then(() => {
        reapplyDirection(next);
        onLocaleChanged?.();
      });
    }
  });

  return settings;
}
