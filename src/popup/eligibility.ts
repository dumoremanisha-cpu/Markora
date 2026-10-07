// Pure eligibility check for the "Render this page as Markdown" popup
// action (F04 fallback, Phase 2-B task 11). Kept separate from index.ts's
// page-bootstrap code so it's unit-testable without a DOM/extension
// context, matching this codebase's convention (src/content/detect.ts).
export function isEligibleForRenderAsMarkdown(
  url: string | undefined,
  ownExtensionOrigin: string,
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return false;
    return !url.startsWith(ownExtensionOrigin);
  } catch {
    return false;
  }
}
