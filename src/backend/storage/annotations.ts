// Annotation storage-key sharding (ADR-0004): one `chrome.storage.local` key
// per document identity, `markora.annotations.<documentId-hash>`, rather
// than one flat array for every document the user has ever annotated.
import { fnv1aHex } from '../utils/hash';

export const ANNOTATIONS_KEY_PREFIX = 'markora.annotations.';

export function annotationsStorageKey(documentId: string): string {
  return `${ANNOTATIONS_KEY_PREFIX}${fnv1aHex(documentId)}`;
}
