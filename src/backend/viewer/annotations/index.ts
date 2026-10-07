// Orchestrates the annotation data model + re-anchoring engine against
// storage for the currently-open document. No DOM here — `src/viewer/index.ts`
// wires this to the rendered content element and to
// `src/components/annotations/`'s UI.
import {
  addAnnotation,
  deleteAnnotation,
  getAnnotationsForDocument,
  updateAnnotation,
} from '../../storage';
import type { Annotation, AnnotationType } from '../../storage/schema';
import { ANNOTATION_CONTEXT_LENGTH, computeContentFingerprint } from './model';
import { reanchorAll } from './reanchor';
import type { ReanchorAllResult } from './reanchor';

export { computeDocumentId, computeContentFingerprint } from './model';
export type { ReanchorAllResult, ResolvedAnnotation } from './reanchor';
export { reanchorAll, reanchorAnnotation } from './reanchor';

export interface CreateAnnotationInput {
  documentId: string;
  plainText: string;
  start: number;
  end: number;
  exactText: string;
  type: AnnotationType;
  commentText?: string;
}

function buildAnnotation(input: CreateAnnotationInput): Annotation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    documentId: input.documentId,
    exactText: input.exactText,
    prefix: input.plainText.slice(
      Math.max(0, input.start - ANNOTATION_CONTEXT_LENGTH),
      input.start,
    ),
    suffix: input.plainText.slice(input.end, input.end + ANNOTATION_CONTEXT_LENGTH),
    charOffsetAtCreation: input.start,
    contentFingerprint: computeContentFingerprint(input.plainText),
    type: input.type,
    commentText: input.type === 'comment' ? input.commentText : undefined,
    createdAt: now,
    updatedAt: now,
    status: 'active',
  };
}

/** Creates and persists a new annotation from a resolved selection (plain-text offsets already computed by the caller — see `src/viewer/annotations/textOffsets.ts`). */
export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation[]> {
  return addAnnotation(input.documentId, buildAnnotation(input));
}

export async function removeAnnotation(documentId: string, id: string): Promise<Annotation[]> {
  return deleteAnnotation(documentId, id);
}

export async function editAnnotationComment(
  documentId: string,
  id: string,
  commentText: string,
): Promise<Annotation[]> {
  return updateAnnotation(documentId, id, { commentText });
}

/** Loads every stored annotation for a document and re-anchors them against its current rendered content, chunked per budget P9 (see `reanchor.ts`). */
export async function loadAndReanchor(
  documentId: string,
  currentPlainText: string,
): Promise<ReanchorAllResult> {
  const stored = await getAnnotationsForDocument(documentId);
  if (stored.length === 0) return { active: [], orphaned: [] };
  const fingerprint = computeContentFingerprint(currentPlainText);
  return reanchorAll(stored, currentPlainText, fingerprint);
}

export interface ExportableAnnotation {
  start: number;
  end: number;
  type: AnnotationType;
  commentText?: string;
}

/**
 * Resolved, export-ready annotation ranges — active only (ADR-0003: orphaned
 * annotations are never exported). This phase defines and populates the
 * shape; Phases 7-A/7-B's export modules are the consumers, gated by the
 * `includeAnnotationsInExports` setting (default on).
 */
export function toExportableAnnotations(result: ReanchorAllResult): ExportableAnnotation[] {
  return result.active.map(({ annotation, start, end }) => ({
    start,
    end,
    type: annotation.type,
    commentText: annotation.commentText,
  }));
}
