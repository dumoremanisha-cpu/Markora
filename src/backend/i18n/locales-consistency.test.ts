// Build-time consistency check (ADR-0007 §1): every _locales/en/messages.json
// key must have a matching, identically-worded entry in the runtime English
// catalog, so the two systems can never drift into saying different things
// about the product.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Maps a _locales/en/messages.json key to its runtime-catalog equivalent.
const MANIFEST_TO_RUNTIME_KEY: Record<string, string> = {
  extensionName: 'app.name',
  extensionDescription: 'app.description',
  commandToggleTheme: 'shortcuts.toggleTheme',
};

describe('_locales/en/messages.json <-> runtime English catalog', () => {
  const manifestMessages = JSON.parse(
    readFileSync(resolve(__dirname, '../../../_locales/en/messages.json'), 'utf-8'),
  ) as Record<string, { message: string }>;

  it('has a runtime-catalog mapping for every manifest key', () => {
    for (const key of Object.keys(manifestMessages)) {
      expect(MANIFEST_TO_RUNTIME_KEY, `unmapped _locales key: ${key}`).toHaveProperty(key);
    }
  });

  it('the two catalogs never say different things about the same string', () => {
    for (const [manifestKey, runtimeKey] of Object.entries(MANIFEST_TO_RUNTIME_KEY)) {
      expect((en as Record<string, string>)[runtimeKey]).toBe(
        manifestMessages[manifestKey]?.message,
      );
    }
  });
});
