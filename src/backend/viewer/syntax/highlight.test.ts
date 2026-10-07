import { describe, expect, it } from 'vitest';
import { highlightCode, languageLabel } from './highlight';

describe('highlightCode', () => {
  it('highlights a known language', () => {
    const { html, languageKey } = highlightCode('const x = 1;', 'javascript');
    expect(languageKey).toBe('javascript');
    expect(html).toContain('hljs-keyword');
  });

  it('recognizes common aliases', () => {
    const { languageKey } = highlightCode('const x = 1;', 'js');
    expect(languageKey).toBe('js');
  });

  it('falls back to escaped plain text for an unknown language', () => {
    const { html, languageKey } = highlightCode('<b>not html-declared</b>', 'not-a-real-language');
    expect(languageKey).toBeNull();
    expect(html).toContain('&lt;b&gt;');
  });

  it('falls back to escaped plain text when no language is declared', () => {
    const { html, languageKey } = highlightCode('plain text', undefined);
    expect(languageKey).toBeNull();
    expect(html).toBe('plain text');
  });

  it('never throws on malformed/adversarial input', () => {
    const adversarial = (' ' + String.fromCharCode(0xffff)).repeat(1000);
    expect(() => highlightCode(adversarial, 'javascript')).not.toThrow();
  });
});

describe('languageLabel', () => {
  it('maps known ids to display names', () => {
    expect(languageLabel('js')).toBe('JavaScript');
    expect(languageLabel('py')).toBe('Python');
  });

  it('falls back to an uppercased id for an unmapped language', () => {
    expect(languageLabel('lua')).toBe('LUA');
  });

  it('returns an empty string for null', () => {
    expect(languageLabel(null)).toBe('');
  });
});
