// Settings import/export (F42). Export is a plain JSON serialization of the
// current Settings object; import must never trust an arbitrary file's
// shape (security-privacy.md's general sanitize-everything posture, Phase
// 10 §7): a malformed or crafted export must not corrupt storage or inject
// unexpected values. Validation walks DEFAULT_SETTINGS as the template of
// allowed keys/shapes — only keys the template defines are ever copied out
// of the parsed input, so unknown keys (including `__proto__`/`constructor`)
// are structurally ignored rather than merged.
import { DEFAULT_SETTINGS } from '../backend/storage/schema';
import type { Settings } from '../backend/storage/schema';

export const SETTINGS_EXPORT_FILENAME = 'markora-settings.json';

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural (not deep-equality) shape check: same primitive type, same array element type, same nested-object key set — recursively. Never inspects the input's own extra keys, only the template's. */
function matchesShape(template: unknown, value: unknown): boolean {
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return false;
    const elementTemplate = template[0];
    if (elementTemplate === undefined) return true;
    return value.every((item) => matchesShape(elementTemplate, item));
  }
  if (isPlainObject(template)) {
    if (!isPlainObject(value)) return false;
    return Object.keys(template).every((key) => matchesShape(template[key], value[key]));
  }
  return typeof value === typeof template;
}

const ENUM_FIELDS: Partial<Record<keyof Settings, readonly string[]>> = {
  theme: ['light', 'dark', 'system'],
  textDirectionOverride: ['auto', 'ltr', 'rtl'],
  contentWidthMode: ['centered', 'full'],
  alertTitleMode: ['localized', 'literal'],
  fileTypeFilter: ['markdownOnly', 'allSupportedText'],
};

export interface ImportSettingsResult {
  /** `null` when the file couldn't be parsed as a valid settings export at all. */
  settings: Partial<Settings> | null;
}

/**
 * Parses and validates an imported settings JSON file. Returns a
 * `Partial<Settings>` containing only the recognized, well-shaped fields —
 * safe to hand directly to `setSettings()`, which merges it over the
 * existing (defaulted) settings. Returns `{ settings: null }` for anything
 * that isn't a JSON object at all; a partial/older export (missing newer
 * fields) is still accepted — missing fields simply keep their current
 * values, the same forward-compatible behavior `getSettings()` already
 * gives a pre-migration stored record.
 */
export function parseImportedSettings(raw: string): ImportSettingsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { settings: null };
  }
  if (!isPlainObject(parsed)) return { settings: null };

  const result: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (!(key in parsed)) continue;
    const value = parsed[key];
    if (!matchesShape(DEFAULT_SETTINGS[key], value)) continue;
    const allowedEnum = ENUM_FIELDS[key];
    if (allowedEnum && typeof value === 'string' && !allowedEnum.includes(value)) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return { settings: Object.keys(result).length > 0 ? result : null };
}
