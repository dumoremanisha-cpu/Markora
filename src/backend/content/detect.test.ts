import { describe, expect, it } from 'vitest';
import {
  isMatchedFileUrl,
  isMatchedRemoteUrl,
  looksLikeOnDemandCandidate,
  looksLikeRawTextDocument,
} from './detect';

describe('isMatchedFileUrl (ADR-0001 Flow A)', () => {
  const cases: Array<[string, boolean]> = [
    ['file:///C:/docs/readme.md', true],
    ['file:///home/user/notes.markdown', true],
    ['file:///home/user/notes.mdown', true],
    ['file:///home/user/notes.mkd', true],
    ['file:///home/user/notes.mdx', true],
    ['file:///home/user/notes.MD', true],
    ['file:///home/user/notes.txt', false],
    ['file:///home/user/index.html', false],
    ['file:///home/user/readme.md.html', false],
  ];

  it.each(cases)('%s -> %s', (url, expected) => {
    expect(isMatchedFileUrl(new URL(url))).toBe(expected);
  });
});

describe('isMatchedRemoteUrl (ADR-0001 §2)', () => {
  const cases: Array<[string, boolean]> = [
    // Suffix glob
    ['https://example.com/docs/readme.md', true],
    ['https://example.com/docs/readme.markdown', true],
    ['https://example.com/docs/readme.mdown', true],
    ['https://example.com/docs/readme.mkd', true],
    ['https://example.com/docs/readme.mdx', true],
    // llms.txt exact filename only
    ['https://example.com/llms.txt', true],
    ['https://example.com/deep/path/llms.txt', true],
    ['https://example.com/other.txt', false],
    ['https://example.com/llms.txt.bak', false],
    // Curated raw-Git hosts
    ['https://raw.githubusercontent.com/user/repo/main/README', true],
    ['https://someuser.gitlab.io/project/', true],
    ['https://gitlab.com/user/repo/-/raw/main/README', true],
    ['https://bitbucket.org/user/repo/raw/main/README', true],
    // URL-shape-only must-not-match cases
    ['https://github.com/user/repo', false],
    ['https://app.gitbook.com/some/page', false],
    ['https://readthedocs.org/projects/example/', false],
    ['https://example.com/notes.txt', false],
    ['https://example.com/', false],
  ];

  it.each(cases)('%s -> %s', (url, expected) => {
    expect(isMatchedRemoteUrl(new URL(url))).toBe(expected);
  });

  it('a github.com blob URL still matches the suffix rule by URL shape alone', () => {
    // Expected: F05's actual guarantee comes from looksLikeRawTextDocument()
    // below, not from this predicate — a blob URL genuinely ends in .md.
    expect(isMatchedRemoteUrl(new URL('https://github.com/user/repo/blob/main/README.md'))).toBe(
      true,
    );
  });
});

describe('looksLikeRawTextDocument (F05 second gate)', () => {
  it('matches a text/plain response rendered as a single <pre>', () => {
    expect(
      looksLikeRawTextDocument({
        contentType: 'text/plain',
        body: { children: [{ tagName: 'PRE' }] },
      }),
    ).toBe(true);
  });

  it('rejects a text/html GitHub blob page even though its URL ends in .md', () => {
    expect(
      looksLikeRawTextDocument({
        contentType: 'text/html',
        body: { children: [{ tagName: 'DIV' }, { tagName: 'HEADER' }, { tagName: 'MAIN' }] },
      }),
    ).toBe(false);
  });

  it('rejects a text/html document even if it happens to contain a single <pre>', () => {
    expect(
      looksLikeRawTextDocument({
        contentType: 'text/html',
        body: { children: [{ tagName: 'PRE' }] },
      }),
    ).toBe(false);
  });

  it('accepts an unlabeled body-only <pre> when contentType is empty (some local file responses)', () => {
    expect(
      looksLikeRawTextDocument({
        contentType: '',
        body: { children: [{ tagName: 'PRE' }] },
      }),
    ).toBe(true);
  });
});

describe('looksLikeOnDemandCandidate (Phase 2-B task 11 — F04 fallback gate)', () => {
  it('accepts text/plain regardless of body shape', () => {
    expect(looksLikeOnDemandCandidate({ contentType: 'text/plain', body: { children: [] } })).toBe(
      true,
    );
  });

  it('accepts text/markdown regardless of body shape', () => {
    expect(
      looksLikeOnDemandCandidate({ contentType: 'text/markdown', body: { children: [] } }),
    ).toBe(true);
  });

  it('accepts a structural single-<pre> body with an unrelated content type', () => {
    expect(
      looksLikeOnDemandCandidate({
        contentType: 'application/octet-stream',
        body: { children: [{ tagName: 'PRE' }] },
      }),
    ).toBe(true);
  });

  it('rejects a real rendered HTML page (the exact case F04 must never touch)', () => {
    expect(
      looksLikeOnDemandCandidate({
        contentType: 'text/html',
        body: { children: [{ tagName: 'DIV' }, { tagName: 'HEADER' }] },
      }),
    ).toBe(false);
  });

  it('rejects a non-plain content type with more than a single <pre> in the body', () => {
    expect(
      looksLikeOnDemandCandidate({
        contentType: 'application/json',
        body: { children: [{ tagName: 'PRE' }, { tagName: 'DIV' }] },
      }),
    ).toBe(false);
  });

  it('rejects when there is no body at all', () => {
    expect(looksLikeOnDemandCandidate({ contentType: 'application/json', body: null })).toBe(false);
  });
});
