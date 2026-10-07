import { describe, expect, it } from 'vitest';
import { textSimilarity } from './similarity';

describe('textSimilarity', () => {
  it('is 1 for identical strings', () => {
    expect(textSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('is 1 for two empty strings', () => {
    expect(textSimilarity('', '')).toBe(1);
  });

  it('is 0 for completely different same-length strings', () => {
    expect(textSimilarity('aaaa', 'bbbb')).toBe(0);
  });

  it('is high for a near-identical string with one edit', () => {
    expect(textSimilarity('the quick brown fox', 'the quick brown foxx')).toBeGreaterThan(0.9);
  });

  it('is lower the more the strings diverge', () => {
    const closer = textSimilarity('the quick brown fox', 'the quick brown fax');
    const farther = textSimilarity('the quick brown fox', 'completely different text');
    expect(closer).toBeGreaterThan(farther);
  });
});
