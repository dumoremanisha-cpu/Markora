// Document identity + content fingerprint (ADR-0003 "Document identity" and
// "Anchor data stored per annotation" sections).
import { fnv1aHex } from '../../utils/hash';

/**
 * Derives the stable per-document key ADR-0003 calls for: local files use
 * the resolved file path/handle name as-is (already what
 * `src/viewer/index.ts` uses as its `sourceLabel` for recents/auto-refresh);
 * remote URLs are normalized to scheme+host+path, with the query string
 * stripped (not meaningfully part of identity for re-anchoring purposes).
 * Never a content hash — that would break identity on every edit.
 */
export function computeDocumentId(sourceLabel: string): string {
  if (/^https?:\/\//i.test(sourceLabel)) {
    try {
      const url = new URL(sourceLabel);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return sourceLabel;
    }
  }
  return sourceLabel;
}

/** A lightweight hash of the full rendered plain-text content — the "content fingerprint at annotation time" re-anchoring confidence signal (ADR-0003), never the lookup key. */
export function computeContentFingerprint(plainText: string): string {
  return fnv1aHex(plainText);
}

/** ~32 chars of context on each side of a selection, per ADR-0003's anchor-data table. */
export const ANNOTATION_CONTEXT_LENGTH = 32;
