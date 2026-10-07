// Small edit-distance similarity function for ADR-0003's re-anchoring
// disambiguation step ("prefix/suffix similarity... allow small edit-distance
// tolerance"). A local utility, not a dependency (ADR-0003 Consequences) —
// operates only on the ~32-char prefix/suffix context strings, so an O(n*m)
// Levenshtein table is cheap regardless of overall document size.
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array<number>(n + 1);
  let currRow = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1]! + 1, // insertion
        prevRow[j]! + 1, // deletion
        prevRow[j - 1]! + cost, // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[n]!;
}

/** Normalized similarity in [0, 1] — 1 means identical, 0 means completely different (relative to the longer string's length). */
export function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}
