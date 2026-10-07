import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../backend/storage/schema';
import { parseImportedSettings, serializeSettings } from './importExport';

describe('serializeSettings / parseImportedSettings round-trip', () => {
  it('export then re-import produces identical settings', () => {
    const exported = serializeSettings(DEFAULT_SETTINGS);
    const { settings } = parseImportedSettings(exported);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts a partial export, carrying over only the fields present', () => {
    const { settings } = parseImportedSettings(JSON.stringify({ fontSize: 20, theme: 'dark' }));
    expect(settings).toEqual({ fontSize: 20, theme: 'dark' });
  });
});

describe('parseImportedSettings rejects malformed/crafted input', () => {
  it('rejects invalid JSON', () => {
    expect(parseImportedSettings('not json').settings).toBeNull();
  });

  it('rejects a JSON array at the top level', () => {
    expect(parseImportedSettings('[1,2,3]').settings).toBeNull();
  });

  it('rejects a JSON primitive at the top level', () => {
    expect(parseImportedSettings('"hello"').settings).toBeNull();
  });

  it('drops unrecognized top-level keys, including __proto__/constructor', () => {
    const { settings } = parseImportedSettings(
      JSON.stringify({ fontSize: 18, __proto__: { polluted: true }, constructor: { evil: 1 } }),
    );
    expect(settings).toEqual({ fontSize: 18 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a field whose value has the wrong primitive type', () => {
    const { settings } = parseImportedSettings(JSON.stringify({ fontSize: 'not-a-number' }));
    expect(settings).toBeNull();
  });

  it('drops an enum field whose value is not one of the allowed options', () => {
    const { settings } = parseImportedSettings(JSON.stringify({ theme: 'rainbow' }));
    expect(settings).toBeNull();
  });

  it('drops a nested object field with an unexpected shape', () => {
    const { settings } = parseImportedSettings(
      JSON.stringify({ markdown: { tables: 'yes-please' } }),
    );
    expect(settings).toBeNull();
  });

  it('accepts a well-shaped nested object field', () => {
    const { settings } = parseImportedSettings(
      JSON.stringify({ markdown: { ...DEFAULT_SETTINGS.markdown, tables: false } }),
    );
    expect(settings).toEqual({ markdown: { ...DEFAULT_SETTINGS.markdown, tables: false } });
  });

  it('drops an array field whose elements have the wrong type', () => {
    const { settings } = parseImportedSettings(JSON.stringify({ folderExclusions: [1, 2, 3] }));
    expect(settings).toBeNull();
  });

  it('returns null when every top-level key is unrecognized', () => {
    const { settings } = parseImportedSettings(JSON.stringify({ notARealSetting: true }));
    expect(settings).toBeNull();
  });
});
