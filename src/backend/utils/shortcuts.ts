// F39 in-page keyboard shortcut matching/formatting. Pure functions only —
// no DOM listeners here — so shortcut parsing is unit-testable without a
// browser context and reusable by both the viewer's live listeners and the
// Settings → Shortcuts recorder UI.

/** Canonical combo string, e.g. "Ctrl+Shift+L". Modifier order is fixed; the key is the last segment. */
export function formatShortcut(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  key: string;
}): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) parts.push(key);
  return parts.join('+');
}

/** True when a live keydown event matches a stored combo string. Treats Ctrl and Cmd (metaKey) as the same modifier — cross-platform combos are stored once. */
export function matchesShortcut(
  event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; key: string },
  combo: string,
): boolean {
  return formatShortcut(event) === combo;
}

/** A combo is "complete" (recordable/storable) once it carries at least one non-modifier key. */
export function isCompleteShortcut(combo: string): boolean {
  const segments = combo.split('+');
  const last = segments[segments.length - 1];
  return !!last && !['Ctrl', 'Alt', 'Shift'].includes(last);
}
