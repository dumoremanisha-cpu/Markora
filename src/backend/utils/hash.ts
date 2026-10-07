// Fast, non-cryptographic string hash (FNV-1a, 32-bit), hex-encoded. Used for
// two Phase 5 purposes only, neither security-sensitive: sharding annotation
// storage keys per document identity (ADR-0004: `markora.annotations.<hash>`)
// and computing a document's "content fingerprint at annotation time"
// re-anchoring signal (ADR-0003) — never as a document's primary identity
// key and never for anything that needs collision-resistance guarantees.
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
