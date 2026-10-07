import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locales';

describe('resolveLocale', () => {
  it('resolves an exact tag when the setting is not "auto"', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
  });

  it('falls back to English for an unrecognized explicit setting', () => {
    expect(resolveLocale('xx')).toBe('en');
  });

  it('resolves "auto" from an exact chrome.i18n.getUILanguage() match', () => {
    expect(resolveLocale('auto', 'de')).toBe('de');
  });

  it('resolves "auto" via base-tag truncation for a regional variant', () => {
    expect(resolveLocale('auto', 'fr-CA')).toBe('fr');
    expect(resolveLocale('auto', 'de-AT')).toBe('de');
  });

  it('resolves a Portuguese regional tag to the shipped pt-BR catalog', () => {
    expect(resolveLocale('auto', 'pt-PT')).toBe('pt-BR');
    expect(resolveLocale('auto', 'pt')).toBe('pt-BR');
  });

  it('maps Chinese variants via the explicit alias table, not base-tag truncation', () => {
    expect(resolveLocale('auto', 'zh')).toBe('zh-Hans');
    expect(resolveLocale('auto', 'zh-CN')).toBe('zh-Hans');
    expect(resolveLocale('auto', 'zh-Hans')).toBe('zh-Hans');
    expect(resolveLocale('auto', 'zh-TW')).toBe('zh-Hant');
    expect(resolveLocale('auto', 'zh-HK')).toBe('zh-Hant');
    expect(resolveLocale('auto', 'zh-Hant')).toBe('zh-Hant');
  });

  it('is case-insensitive on both the primary tag and region subtag', () => {
    expect(resolveLocale('auto', 'ZH-tw')).toBe('zh-Hant');
    expect(resolveLocale('auto', 'FR')).toBe('fr');
  });

  it('falls through to navigator.languages when getUILanguage has no match', () => {
    expect(resolveLocale('auto', 'xx-XX', ['und', 'ja-JP'])).toBe('ja');
  });

  it('falls back to English when nothing in the candidate list matches', () => {
    expect(resolveLocale('auto', 'xx-XX', ['yy-YY', 'zz'])).toBe('en');
  });

  it('falls back to English when "auto" has no browser inputs at all', () => {
    expect(resolveLocale('auto')).toBe('en');
  });
});
