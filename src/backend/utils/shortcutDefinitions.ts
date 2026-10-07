// Single source of truth for which shortcuts exist, shared by the
// shortcut-help modal and the Settings → Shortcuts recorder UI (F39) so the
// two surfaces can't drift.
import type { KeyboardShortcutSettings } from '../storage/schema';

export interface InPageShortcutDefinition {
  id: keyof KeyboardShortcutSettings;
  labelKey: string;
}

export const IN_PAGE_SHORTCUTS: InPageShortcutDefinition[] = [
  { id: 'toggleToc', labelKey: 'shortcuts.toggleToc' },
  { id: 'toggleRawRendered', labelKey: 'shortcuts.toggleRawRendered' },
  { id: 'focusSearch', labelKey: 'shortcuts.focusSearch' },
  { id: 'openPreferences', labelKey: 'shortcuts.openPreferences' },
];

/** Registered via `chrome.commands` (manifest.config.ts) — re-bound at chrome://extensions/shortcuts, not in this product's own UI. Alt+Shift+D, not Ctrl+Shift+D: Chrome reserves the latter for "Bookmark all tabs" and leaves the extension's binding unassigned. */
export const GLOBAL_SHORTCUT = {
  labelKey: 'shortcuts.toggleTheme',
  defaultCombo: 'Alt+Shift+D',
};
