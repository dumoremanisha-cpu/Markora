// Detection predicate (ADR-0001 §2). Kept separate from index.ts so it is
// unit-testable without a DOM/extension context. Chrome's manifest match
// pattern globs pathname+search combined (Spike 4 finding) — this predicate
// re-checks location.pathname alone, which is the fix that finding requires.

const MARKDOWN_SUFFIXES = ['.md', '.markdown', '.mdown', '.mkd', '.mdx'];

const CURATED_RAW_HOSTS: Array<(url: URL) => boolean> = [
  (url) => url.hostname === 'raw.githubusercontent.com',
  (url) => url.hostname.endsWith('.gitlab.io'),
  (url) => url.hostname === 'gitlab.com' && url.pathname.includes('/-/raw/'),
  (url) => url.hostname === 'bitbucket.org' && url.pathname.includes('/raw/'),
];

function hasMarkdownSuffix(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return MARKDOWN_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isLlmsTxt(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === 'llms.txt' || lower === '/llms.txt' || lower.endsWith('/llms.txt');
}

/** Flow A: does this file:// URL qualify for auto-render? */
export function isMatchedFileUrl(url: URL): boolean {
  if (url.protocol !== 'file:') return false;
  return hasMarkdownSuffix(url.pathname);
}

/**
 * Remote auto-render (Flow, ADR-0001 §2): suffix glob, llms.txt exact
 * filename, or a curated raw-content host. Deliberately excludes GitHub
 * blob/repo pages, GitBook, and Read the Docs (F05) — those are simply
 * absent from every check below, never explicitly special-cased.
 */
export function isMatchedRemoteUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (hasMarkdownSuffix(url.pathname)) return true;
  if (isLlmsTxt(url.pathname)) return true;
  return CURATED_RAW_HOSTS.some((check) => check(url));
}

/**
 * URL suffix matching alone is not enough to guarantee F05 (never hijack
 * GitHub blob/GitBook/RTD pages): a GitHub blob URL like
 * `github.com/u/r/blob/main/README.md` genuinely ends in `.md` and would
 * pass isMatchedRemoteUrl. What actually distinguishes a raw-content
 * response from a rendered app page is *how Chrome rendered it* — per
 * ADR-0006 §2, a raw-text response (Content-Type `text/plain` or similar)
 * is shown as a single `<pre>` with no app chrome around it; a blob/GitBook/
 * RTD page is a full `text/html` document. This is the required second
 * gate before any handoff is created.
 */
export function looksLikeRawTextDocument(doc: {
  contentType: string;
  body: { children: ArrayLike<{ tagName: string }> } | null;
}): boolean {
  // An explicit text/html (or xhtml) content type is a real rendered page —
  // reject outright, regardless of what its body happens to contain.
  if (doc.contentType === 'text/html' || doc.contentType === 'application/xhtml+xml') {
    return false;
  }
  if (doc.contentType) return true;
  // No content type available (some local file:// responses) — fall back
  // to the structural heuristic: a raw-text render is nothing but <pre>.
  if (!doc.body) return false;
  const children = Array.from(doc.body.children).filter(
    (el) => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE',
  );
  return children.length === 1 && children[0]?.tagName === 'PRE';
}

/**
 * Gate for the popup's "Render this page as Markdown" on-demand action
 * (F04 fallback, Phase 2-B task 11). Deliberately narrower than
 * {@link looksLikeRawTextDocument}: that predicate is only ever reached
 * *after* a URL already matched a known Markdown pattern, so it can afford
 * to accept any non-HTML content type. This one runs on an arbitrary tab the
 * user chose to click the action on, so it accepts only what the task
 * description names explicitly — `text/plain`/`text/markdown`, or a
 * structural single-`<pre>` body — and never renders the visible text of an
 * HTML page as Markdown.
 */
export function looksLikeOnDemandCandidate(doc: {
  contentType: string;
  body: { children: ArrayLike<{ tagName: string }> } | null;
}): boolean {
  if (doc.contentType === 'text/plain' || doc.contentType === 'text/markdown') return true;
  if (!doc.body) return false;
  const children = Array.from(doc.body.children).filter(
    (el) => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE',
  );
  return children.length === 1 && children[0]?.tagName === 'PRE';
}
