import { describe, expect, it } from 'vitest';
import { computeContentFingerprint, computeDocumentId } from './model';

describe('computeDocumentId', () => {
  it('leaves a local file path/handle name untouched', () => {
    expect(computeDocumentId('notes/todo.md')).toBe('notes/todo.md');
    expect(computeDocumentId('C:/Users/me/doc.md')).toBe('C:/Users/me/doc.md');
  });

  it('normalizes a remote URL to scheme+host+path, stripping the query string', () => {
    expect(computeDocumentId('https://example.com/docs/readme.md?ref=abc123')).toBe(
      'https://example.com/docs/readme.md',
    );
  });

  it('is stable regardless of query string content', () => {
    const a = computeDocumentId('https://example.com/readme.md?x=1');
    const b = computeDocumentId('https://example.com/readme.md?x=2');
    expect(a).toBe(b);
  });

  it('distinguishes different paths on the same host', () => {
    expect(computeDocumentId('https://example.com/a.md')).not.toBe(
      computeDocumentId('https://example.com/b.md'),
    );
  });
});

describe('computeContentFingerprint', () => {
  it('is identical for identical content', () => {
    expect(computeContentFingerprint('hello world')).toBe(computeContentFingerprint('hello world'));
  });

  it('changes when content changes', () => {
    expect(computeContentFingerprint('hello world')).not.toBe(
      computeContentFingerprint('hello world!'),
    );
  });
});
