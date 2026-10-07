import { describe, expect, it } from 'vitest';
import { computeDocumentStats, countWords } from './textStats';

describe('countWords', () => {
  it('counts whitespace-delimited English words', () => {
    expect(countWords('the quick brown fox')).toBe(4);
  });

  it('ignores extra whitespace/newlines', () => {
    expect(countWords('  hello   world  \n\n  again  ')).toBe(3);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts each CJK character as its own word (F71)', () => {
    // Naive whitespace splitting would count this entire run as 1 "word";
    // it must instead count 5 (one per character).
    expect(countWords('你好世界吗')).toBe(5);
  });

  it('counts Japanese hiragana/katakana per character too', () => {
    expect(countWords('こんにちは')).toBe(5);
  });

  it('counts Korean Hangul syllables per character', () => {
    expect(countWords('안녕하세요')).toBe(5);
  });

  it('handles mixed CJK and Latin text without undercounting either run', () => {
    // "hello" (1 word) + "你好" (2 CJK chars) + "world" (1 word) = 4.
    expect(countWords('hello 你好 world')).toBe(4);
  });
});

describe('computeDocumentStats', () => {
  it('computes word count, char count, and a >=1-minute reading time for non-empty text', () => {
    const stats = computeDocumentStats('one two three');
    expect(stats.wordCount).toBe(3);
    expect(stats.charCount).toBe('one two three'.length);
    expect(stats.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('reports a 0-minute reading time for empty text', () => {
    expect(computeDocumentStats('').readingTimeMinutes).toBe(0);
  });
});
