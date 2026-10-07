// Pure storage-quota threshold logic (ADR-0004). Kept dependency-free of
// chrome.storage so the threshold math is unit-testable without a browser
// context.
export const QUOTA_WARNING_RATIO = 0.8;

/**
 * True once usage crosses the warning threshold (default 80% of quota) —
 * the trigger for prompting the user to opt into the `unlimitedStorage`
 * runtime permission request (never requested speculatively or silently).
 */
export function shouldPromptUnlimitedStorage(
  bytesInUse: number,
  quotaBytes: number,
  warningRatio: number = QUOTA_WARNING_RATIO,
): boolean {
  if (quotaBytes <= 0) return false;
  return bytesInUse / quotaBytes >= warningRatio;
}

export function usageRatio(bytesInUse: number, quotaBytes: number): number {
  if (quotaBytes <= 0) return 0;
  return bytesInUse / quotaBytes;
}
