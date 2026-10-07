// Key-coverage report (Phase 8 task 1/9): every shipped locale catalog must
// have exactly the same key set as the canonical English catalog (ADR-0007
// §2 — "English catalog is the canonical key list"). A missing key silently
// falls back to English at runtime (by design), so this test is what
// actually catches a locale falling behind as new keys are added.
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import itLocale from './locales/it.json';
import ptBR from './locales/pt-BR.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ru from './locales/ru.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import vi from './locales/vi.json';
import id from './locales/id.json';
import ar from './locales/ar.json';
import fa from './locales/fa.json';
import ur from './locales/ur.json';
import he from './locales/he.json';

const LOCALES: Record<string, Record<string, string>> = {
  es,
  fr,
  de,
  it: itLocale,
  'pt-BR': ptBR,
  nl,
  pl,
  ru,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ja,
  ko,
  vi,
  id,
  ar,
  fa,
  ur,
  he,
};

const englishKeys = Object.keys(en).sort();

describe('locale catalog key coverage', () => {
  it('the English catalog has no duplicate-looking empty/blank values', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.json["${key}"] is blank`).not.toBe('');
    }
  });

  for (const [tag, catalog] of Object.entries(LOCALES)) {
    it(`${tag}.json has every key the English catalog has, and no extra ones`, () => {
      const keys = Object.keys(catalog).sort();
      const missing = englishKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !englishKeys.includes(k));
      expect(missing, `${tag}.json is missing keys`).toEqual([]);
      expect(extra, `${tag}.json has keys not in en.json`).toEqual([]);
    });

    it(`${tag}.json has no blank values`, () => {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.trim(), `${tag}.json["${key}"] is blank`).not.toBe('');
      }
    });

    it(`${tag}.json preserves every {placeholder} the English string declares`, () => {
      for (const [key, enValue] of Object.entries(en)) {
        const enPlaceholders = [...enValue.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        if (enPlaceholders.length === 0) continue;
        const localizedValue = catalog[key] ?? '';
        const localizedPlaceholders = [...localizedValue.matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort();
        expect(localizedPlaceholders, `${tag}.json["${key}"] placeholder mismatch`).toEqual(
          enPlaceholders,
        );
      }
    });
  }
});
