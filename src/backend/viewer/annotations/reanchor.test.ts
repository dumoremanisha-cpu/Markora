import { describe, expect, it } from 'vitest';
import type { Annotation } from '../../storage/schema';
import { computeContentFingerprint } from './model';
import { reanchorAll, reanchorAnnotation } from './reanchor';

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    documentId: 'doc.md',
    exactText: 'quick brown fox',
    prefix: 'The ',
    suffix: ' jumps',
    charOffsetAtCreation: 4,
    contentFingerprint: 'stale-fingerprint',
    type: 'highlight',
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
    ...overrides,
  };
}

describe('reanchorAnnotation', () => {
  it('fast path: an exact fingerprint match anchors directly by the stored offset, no search', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const fingerprint = computeContentFingerprint(text);
    const annotation = makeAnnotation({ contentFingerprint: fingerprint, charOffsetAtCreation: 4 });

    const result = reanchorAnnotation(annotation, text, fingerprint);

    expect(result).toEqual({ status: 'active', start: 4, end: 4 + 'quick brown fox'.length });
  });

  it('single unambiguous match after an edit shifted the content', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    const edited = 'Once upon a time, the quick brown fox jumps over the lazy dog.';
    const annotation = makeAnnotation({ contentFingerprint: computeContentFingerprint(original) });

    const result = reanchorAnnotation(annotation, edited, computeContentFingerprint(edited));

    expect(result.status).toBe('active');
    if (result.status === 'active') {
      expect(edited.slice(result.start, result.end)).toBe('quick brown fox');
    }
  });

  it('disambiguates multiple occurrences via prefix/suffix similarity', () => {
    const original = 'Section A: The quick brown fox jumps here.';
    const edited =
      'Section A: The quick brown fox jumps here. ' +
      'Section B: a quick brown fox jumps elsewhere, unrelated.';
    const annotation = makeAnnotation({
      contentFingerprint: computeContentFingerprint(original),
      prefix: 'A: The ',
      suffix: ' jumps here',
    });

    const result = reanchorAnnotation(annotation, edited, computeContentFingerprint(edited));

    expect(result.status).toBe('active');
    if (result.status === 'active') {
      // Must land on the Section A occurrence (matching prefix/suffix context), not Section B's.
      expect(edited.slice(Math.max(0, result.start - 7), result.start)).toBe('A: The ');
    }
  });

  it('orphans when the exact text no longer appears anywhere (zero matches)', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    const edited = 'This paragraph was rewritten entirely and no longer resembles the original.';
    const annotation = makeAnnotation({ contentFingerprint: computeContentFingerprint(original) });

    const result = reanchorAnnotation(annotation, edited, computeContentFingerprint(edited));

    expect(result).toEqual({ status: 'orphaned' });
  });

  it('orphans on an ambiguous match: multiple occurrences with near-equal, low-confidence context similarity', () => {
    const original = 'xxx quick brown fox yyy';
    // Two occurrences, both with completely different (and equally
    // dissimilar) surrounding context from the original — neither should
    // win confidently.
    const edited =
      'zzzzzzzz quick brown fox wwwwwwww and later again ' +
      'aaaaaaaa quick brown fox bbbbbbbb elsewhere';
    const annotation = makeAnnotation({
      contentFingerprint: computeContentFingerprint(original),
      prefix: 'xxx ',
      suffix: ' yyy',
    });

    const result = reanchorAnnotation(annotation, edited, computeContentFingerprint(edited));

    expect(result).toEqual({ status: 'orphaned' });
  });
});

describe('reanchorAll', () => {
  it('splits annotations into active (with resolved ranges) and orphaned buckets', async () => {
    const text = 'alpha beta gamma delta epsilon';
    const fingerprint = computeContentFingerprint(text);
    const annotations: Annotation[] = [
      makeAnnotation({
        id: 'a',
        exactText: 'beta',
        contentFingerprint: fingerprint,
        charOffsetAtCreation: text.indexOf('beta'),
      }),
      makeAnnotation({ id: 'b', exactText: 'nonexistent-text', contentFingerprint: 'stale' }),
    ];

    const result = await reanchorAll(annotations, text, fingerprint);

    expect(result.active.map((r) => r.annotation.id)).toEqual(['a']);
    expect(result.orphaned.map((a) => a.id)).toEqual(['b']);
  });

  it('meets budget P9: 50 annotations against a ~5MB document re-anchor in under 500ms', async () => {
    // Realistic shape: each annotation's quoted text is unique and appears
    // exactly once (as a real highlight would), spread across a ~5MB
    // document — not the same short phrase repeated thousands of times
    // (that would make every search ambiguous and isn't how real documents
    // or real annotations look).
    const filler =
      'The quick brown fox jumps over the lazy dog while pondering lorem ipsum dolor sit amet, ' +
      'consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna. ';
    const targetLength = 5 * 1024 * 1024;
    const annotationCount = 50;
    const chunkTarget = targetLength / annotationCount;

    let text = '';
    const annotations: Annotation[] = [];
    for (let i = 0; i < annotationCount; i++) {
      while (text.length < (i + 1) * chunkTarget) text += filler;
      const marker = `UNIQUEMARKER${i}XYZ`;
      text += ` ${marker} `;
      annotations.push(
        makeAnnotation({
          id: `perf-${i}`,
          exactText: marker,
          prefix: ' ',
          suffix: ' ',
          contentFingerprint: 'stale-fingerprint-forces-search',
        }),
      );
    }

    const fingerprint = computeContentFingerprint(text);
    const start = performance.now();
    const result = await reanchorAll(annotations, text, fingerprint);
    const elapsed = performance.now() - start;

    expect(result.orphaned.length).toBe(0);
    expect(result.active.length).toBe(50);
    expect(elapsed).toBeLessThan(500);
  });
});
