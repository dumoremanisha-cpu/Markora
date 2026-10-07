import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../storage';
import { buildTypographyCssVars } from './typography';

describe('buildTypographyCssVars (F35/F81 live-apply)', () => {
  it('maps every typography setting to a CSS custom property', () => {
    const vars = buildTypographyCssVars(DEFAULT_SETTINGS);
    expect(vars['--markora-content-font-size']).toBe('16px');
    expect(vars['--markora-content-line-height']).toBe('1.6');
    expect(vars['--markora-content-width']).toBe('820px');
    expect(vars['--markora-heading-scale']).toBe('1');
    expect(vars['--markora-toc-width']).toBe('240px');
    expect(vars['--markora-content-font-family']).toContain('system-ui');
    expect(vars['--markora-code-font-family']).toContain('monospace');
  });

  it('reflects a non-default font size/width immediately', () => {
    const vars = buildTypographyCssVars({ ...DEFAULT_SETTINGS, fontSize: 20, contentWidth: 1000 });
    expect(vars['--markora-content-font-size']).toBe('20px');
    expect(vars['--markora-content-width']).toBe('1000px');
  });
});
