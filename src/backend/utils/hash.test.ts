import { describe, expect, it } from 'vitest';
import { fnv1aHex } from './hash';

describe('fnv1aHex', () => {
  it('is deterministic', () => {
    expect(fnv1aHex('hello world')).toBe(fnv1aHex('hello world'));
  });

  it('produces different hashes for different inputs', () => {
    expect(fnv1aHex('hello world')).not.toBe(fnv1aHex('hello world!'));
    expect(fnv1aHex('/docs/a.md')).not.toBe(fnv1aHex('/docs/b.md'));
  });

  it('handles the empty string', () => {
    expect(fnv1aHex('')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('always returns an 8-hex-digit string', () => {
    for (const input of ['x', 'a much longer string of arbitrary content', '🎉 unicode 你好']) {
      expect(fnv1aHex(input)).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
