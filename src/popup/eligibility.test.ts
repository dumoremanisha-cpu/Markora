import { describe, expect, it } from 'vitest';
import { isEligibleForRenderAsMarkdown } from './eligibility';

const OWN_ORIGIN = 'chrome-extension://abcdefghijklmnop/';

describe('isEligibleForRenderAsMarkdown (F04 fallback, Phase 2-B task 11)', () => {
  it('allows an https page', () => {
    expect(isEligibleForRenderAsMarkdown('https://example.com/notes', OWN_ORIGIN)).toBe(true);
  });

  it('allows an http page', () => {
    expect(isEligibleForRenderAsMarkdown('http://example.com/notes', OWN_ORIGIN)).toBe(true);
  });

  it('allows a file:// page', () => {
    expect(isEligibleForRenderAsMarkdown('file:///C:/notes.txt', OWN_ORIGIN)).toBe(true);
  });

  it('rejects the extension’s own pages (the viewer, popup, settings)', () => {
    expect(isEligibleForRenderAsMarkdown(OWN_ORIGIN + 'src/viewer/index.html', OWN_ORIGIN)).toBe(
      false,
    );
  });

  it('rejects chrome:// pages', () => {
    expect(isEligibleForRenderAsMarkdown('chrome://extensions', OWN_ORIGIN)).toBe(false);
  });

  it('rejects an undefined URL (no active tab info)', () => {
    expect(isEligibleForRenderAsMarkdown(undefined, OWN_ORIGIN)).toBe(false);
  });

  it('rejects an unparseable URL', () => {
    expect(isEligibleForRenderAsMarkdown('not a url', OWN_ORIGIN)).toBe(false);
  });
});
