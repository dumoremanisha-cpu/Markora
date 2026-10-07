// The re-anchoring algorithm, implemented exactly per
// docs/adr/0003-annotation-identity-and-reanchoring.md's "Re-anchoring
// algorithm on document (re)load" section. Pure logic — no DOM — so it's
// fully unit-testable against the fixture cases ADR-0003/Phase 5 §8 call for.
import type { Annotation } from '../../storage/schema';
import { textSimilarity } from './similarity';

export interface ReanchorActive {
  status: 'active';
  start: number;
  end: number;
}
export interface ReanchorOrphaned {
  status: 'orphaned';
}
export type ReanchorResult = ReanchorActive | ReanchorOrphaned;

// A candidate must clear this similarity score (averaged prefix+suffix) to
// be considered a confident match at all.
const SIMILARITY_THRESHOLD = 0.6;
// If the best and second-best candidates are within this margin of each
// other, treat them as "near-equal confidence" — ambiguous, don't guess
// (ADR-0003: "do not guess").
const AMBIGUITY_MARGIN = 0.05;

function findAllOccurrences(haystack: string, needle: string): number[] {
  if (needle.length === 0) return [];
  const positions: number[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    positions.push(idx);
    from = idx + 1;
  }
  return positions;
}

/**
 * Re-anchors a single annotation against the current document state. Steps,
 * per ADR-0003:
 * 1. Fingerprint match → fast path, anchor directly by the stored offset.
 * 2. Otherwise search for `exactText`: exactly one occurrence → unambiguous;
 *    zero → orphaned; multiple → disambiguate via prefix/suffix similarity,
 *    orphaning on a low-confidence or ambiguous (near-tied) result.
 */
export function reanchorAnnotation(
  annotation: Annotation,
  currentPlainText: string,
  currentFingerprint: string,
): ReanchorResult {
  const length = annotation.exactText.length;

  if (annotation.contentFingerprint === currentFingerprint) {
    return {
      status: 'active',
      start: annotation.charOffsetAtCreation,
      end: annotation.charOffsetAtCreation + length,
    };
  }

  const occurrences = findAllOccurrences(currentPlainText, annotation.exactText);
  if (occurrences.length === 0) return { status: 'orphaned' };
  if (occurrences.length === 1) {
    const start = occurrences[0]!;
    return { status: 'active', start, end: start + length };
  }

  const scored = occurrences
    .map((start) => {
      const prefix = currentPlainText.slice(Math.max(0, start - annotation.prefix.length), start);
      const suffix = currentPlainText.slice(
        start + length,
        start + length + annotation.suffix.length,
      );
      const score =
        (textSimilarity(prefix, annotation.prefix) + textSimilarity(suffix, annotation.suffix)) / 2;
      return { start, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const runnerUp = scored[1];

  if (best.score < SIMILARITY_THRESHOLD) return { status: 'orphaned' };
  if (runnerUp && runnerUp.score >= best.score - AMBIGUITY_MARGIN) return { status: 'orphaned' };
  return { status: 'active', start: best.start, end: best.start + length };
}

export interface ResolvedAnnotation {
  annotation: Annotation;
  start: number;
  end: number;
}

export interface ReanchorAllResult {
  active: ResolvedAnnotation[];
  orphaned: Annotation[];
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Re-anchors every annotation for the currently-open document, chunked so no
 * single synchronous task exceeds budget **P9**
 * (`docs/specs/06-testing-quality-gate.md` §1a: 50 annotations against a
 * 5 MB document, re-anchored in <500ms total, no single task >50ms) — each
 * annotation's own search is O(document length), so batching + yielding
 * between batches keeps any one task bounded regardless of how many
 * annotations a document has.
 */
export async function reanchorAll(
  annotations: Annotation[],
  currentPlainText: string,
  currentFingerprint: string,
  batchSize = 8,
): Promise<ReanchorAllResult> {
  const active: ResolvedAnnotation[] = [];
  const orphaned: Annotation[] = [];

  for (let i = 0; i < annotations.length; i += batchSize) {
    const batch = annotations.slice(i, i + batchSize);
    for (const annotation of batch) {
      const result = reanchorAnnotation(annotation, currentPlainText, currentFingerprint);
      if (result.status === 'active') {
        active.push({ annotation, start: result.start, end: result.end });
      } else {
        orphaned.push(annotation);
      }
    }
    if (i + batchSize < annotations.length) await yieldToBrowser();
  }

  return { active, orphaned };
}
