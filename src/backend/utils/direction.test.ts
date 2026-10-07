import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('../i18n', () => ({
  getActiveLocale: vi.fn(() => 'en'),
  isRtlLocale: (locale: string) => locale === 'ar' || locale === 'he',
}));

import { getActiveLocale } from '../i18n';
import { resolveChromeDirection } from './direction';

describe('resolveChromeDirection', () => {
  afterEach(() => {
    vi.mocked(getActiveLocale).mockReturnValue('en');
  });

  it('follows the active locale when the override is "auto"', () => {
    expect(resolveChromeDirection({ textDirectionOverride: 'auto' })).toBe('ltr');
    vi.mocked(getActiveLocale).mockReturnValue('ar');
    expect(resolveChromeDirection({ textDirectionOverride: 'auto' })).toBe('rtl');
  });

  it('an explicit override wins regardless of the active locale', () => {
    vi.mocked(getActiveLocale).mockReturnValue('ar');
    expect(resolveChromeDirection({ textDirectionOverride: 'ltr' })).toBe('ltr');
    vi.mocked(getActiveLocale).mockReturnValue('en');
    expect(resolveChromeDirection({ textDirectionOverride: 'rtl' })).toBe('rtl');
  });
});
