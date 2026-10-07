import { describe, expect, it } from 'vitest';
import { resolveEffectiveHighlightTheme } from './themes';

describe('resolveEffectiveHighlightTheme', () => {
  it('pairs the untouched shipped default (github) with a dark app theme', () => {
    expect(resolveEffectiveHighlightTheme('github', 'dark')).toBe('github-dark');
  });

  it('leaves the default as-is in a light app theme', () => {
    expect(resolveEffectiveHighlightTheme('github', 'light')).toBe('github');
  });

  it('never overrides an explicitly chosen non-default theme', () => {
    expect(resolveEffectiveHighlightTheme('monokai', 'dark')).toBe('monokai');
    expect(resolveEffectiveHighlightTheme('vs', 'dark')).toBe('vs');
    expect(resolveEffectiveHighlightTheme('github-dark', 'light')).toBe('github-dark');
  });
});
