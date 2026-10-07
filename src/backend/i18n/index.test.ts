import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('resolves a known key', () => {
    expect(t('app.name')).toBe('Markora');
  });

  it('interpolates named placeholders as escaped text, not HTML', () => {
    expect(t('common.itemsCount', { count: 3 })).toBe('3 items');
    expect(t('common.itemsCount', { count: '<b>3</b>' })).toBe('<b>3</b> items');
  });

  it('falls back to the last dotted segment for a missing key, never the raw key or empty string', () => {
    const result = t('totally.missing.key');
    expect(result).toBe('key');
    expect(result).not.toBe('');
  });
});
