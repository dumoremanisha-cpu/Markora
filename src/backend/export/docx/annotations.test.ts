import { describe, expect, it } from 'vitest';
import { resolveAnnotationsForDocx, splitRunForAnnotations } from './annotations';
import type { Annotation } from '../../storage/schema';

function makeAnnotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    documentId: 'doc',
    exactText: 'world',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: 0,
    contentFingerprint: 'irrelevant',
    type: 'highlight',
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
    ...overrides,
  };
}

describe('resolveAnnotationsForDocx', () => {
  it('resolves an annotation whose exactText appears exactly once', () => {
    const annotation = makeAnnotation({ exactText: 'world' });
    const resolved = resolveAnnotationsForDocx([annotation], 'hello world');
    expect(resolved).toEqual([{ annotation, start: 6, end: 11 }]);
  });

  it('drops an annotation whose exactText cannot be found (orphaned) — never exported', () => {
    const annotation = makeAnnotation({ exactText: 'missing' });
    const resolved = resolveAnnotationsForDocx([annotation], 'hello world');
    expect(resolved).toEqual([]);
  });

  it('sorts resolved annotations by start offset', () => {
    const second = makeAnnotation({ id: 'a2', exactText: 'world' });
    const first = makeAnnotation({ id: 'a1', exactText: 'hello' });
    const resolved = resolveAnnotationsForDocx([second, first], 'hello world');
    expect(resolved.map((r) => r.annotation.id)).toEqual(['a1', 'a2']);
  });
});

describe('splitRunForAnnotations', () => {
  it('returns one unsplit segment when nothing overlaps', () => {
    const segments = splitRunForAnnotations(0, 5, []);
    expect(segments).toEqual([
      {
        start: 0,
        end: 5,
        highlight: false,
        underline: false,
        commentsStartingHere: [],
        commentsEndingHere: [],
      },
    ]);
  });

  it('marks a fully-covering highlight annotation on the whole segment', () => {
    const annotation = makeAnnotation({ type: 'highlight' });
    const segments = splitRunForAnnotations(0, 5, [{ annotation, start: 0, end: 5 }]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 0, end: 5, highlight: true, underline: false });
  });

  it('splits a run at a partial-overlap boundary', () => {
    const annotation = makeAnnotation({ type: 'highlight' });
    // Run covers [0,10); annotation covers [3,7) — expect three segments.
    const segments = splitRunForAnnotations(0, 10, [{ annotation, start: 3, end: 7 }]);
    expect(segments.map((s) => [s.start, s.end, s.highlight])).toEqual([
      [0, 3, false],
      [3, 7, true],
      [7, 10, false],
    ]);
  });

  it('places a comment start/end marker at the exact boundary', () => {
    const annotation = makeAnnotation({ type: 'comment', commentText: 'note' });
    const segments = splitRunForAnnotations(0, 10, [{ annotation, start: 2, end: 8 }]);
    const startSegment = segments.find((s) => s.commentsStartingHere.length > 0);
    const endSegment = segments.find((s) => s.commentsEndingHere.length > 0);
    expect(startSegment?.start).toBe(2);
    expect(endSegment?.end).toBe(8);
  });

  it('handles overlapping highlight and underline annotations on the same text independently', () => {
    const highlight = makeAnnotation({ id: 'h', type: 'highlight' });
    const underline = makeAnnotation({ id: 'u', type: 'underline' });
    const segments = splitRunForAnnotations(0, 5, [
      { annotation: highlight, start: 0, end: 5 },
      { annotation: underline, start: 0, end: 5 },
    ]);
    expect(segments).toEqual([
      {
        start: 0,
        end: 5,
        highlight: true,
        underline: true,
        commentsStartingHere: [],
        commentsEndingHere: [],
      },
    ]);
  });
});
