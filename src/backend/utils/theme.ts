// Shared theme application logic (F34), used by both the viewer and the
// popup. Reads/writes through the storage wrapper only — no direct
// chrome.storage calls here (code-conventions.md §2).
import { getSettings, onSettingsChanged, setSettings } from '../storage';
import type { ThemeSetting } from '../storage';

function resolveDataTheme(theme: ThemeSetting): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

const appliedListeners = new Set<(mode: 'light' | 'dark') => void>();

function apply(theme: ThemeSetting): void {
  const mode = resolveDataTheme(theme);
  document.documentElement.dataset.theme = mode;
  for (const listener of appliedListeners) listener(mode);
}

/** Popup Quick Controls' "High-Contrast Readability" (`new_ui/extension_popup.png`) — orthogonal to light/dark theme, so it's its own DOM attribute rather than a third `data-theme` value. */
function applyHighContrast(enabled: boolean): void {
  document.documentElement.dataset.highContrast = enabled ? 'true' : 'false';
}

/**
 * Notifies `callback` with the *resolved* light/dark mode every time it's
 * (re)applied — covers both an explicit theme setting change and the OS
 * preference changing while the setting is "system" (Mermaid re-render on
 * theme change, F11, needs the resolved mode either way).
 */
export function onThemeApplied(callback: (mode: 'light' | 'dark') => void): () => void {
  appliedListeners.add(callback);
  return () => appliedListeners.delete(callback);
}

/** Currently-applied resolved theme, read from the DOM attribute `initTheme`/`apply` keep in sync. */
export function getAppliedTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Applies the persisted theme immediately and keeps it in sync with storage + OS changes. */
export async function initTheme(): Promise<void> {
  const settings = await getSettings();
  apply(settings.theme);
  applyHighContrast(settings.highContrastReadability);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', async () => {
    const current = await getSettings();
    if (current.theme === 'system') apply('system');
  });

  onSettingsChanged((settings) => {
    apply(settings.theme);
    applyHighContrast(settings.highContrastReadability);
  });
}

export async function setTheme(theme: ThemeSetting): Promise<void> {
  await setSettings({ theme });
  apply(theme);
}

export async function setHighContrastReadability(enabled: boolean): Promise<void> {
  await setSettings({ highContrastReadability: enabled });
  applyHighContrast(enabled);
}
