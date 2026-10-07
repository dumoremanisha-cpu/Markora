import { describe, expect, it } from 'vitest';
import { slugifyHeading } from './anchors';
import { renderMarkdown } from '../index';

describe('slugifyHeading', () => {
  it('lowercases and hyphenates ASCII text', () => {
    expect(slugifyHeading('Hello World')).toBe('hello-world');
  });

  it('keeps non-English Unicode letters', () => {
    expect(slugifyHeading('日本語の見出し')).toBe('日本語の見出し');
    expect(slugifyHeading('Über uns')).toBe('über-uns');
    expect(slugifyHeading('Заголовок')).toBe('заголовок');
  });

  it('strips punctuation, symbols, and emoji', () => {
    expect(slugifyHeading('Hello, World! 🎉')).toBe('hello-world');
    expect(slugifyHeading('**Bold** Heading')).toBe('bold-heading');
  });

  it('collapses repeated whitespace/hyphens', () => {
    expect(slugifyHeading('a   b---c')).toBe('a-b-c');
  });
});

describe('heading anchors + deep-linking (F60)', () => {
  it('assigns unique ids to duplicate headings', () => {
    const { html } = renderMarkdown('# Same\n\n# Same');
    expect(html).toContain('id="heading-same"');
    expect(html).toContain('id="heading-same-1"');
  });

  it('produces a working anchor for a non-English heading', () => {
    const { html } = renderMarkdown('# 日本語');
    expect(html).toContain('id="heading-日本語"');
  });

  it('prefixes ids so a slug can never collide with a document/window global (DOM-clobbering hardening)', () => {
    // "title", "location", and "forms" all resolve as real `document.*`
    // properties — DOMPurify's SANITIZE_DOM strips an id/name attribute
    // whose *value* collides with one, so a bare slug would silently lose
    // its id. The `heading-` prefix sidesteps the whole collision class.
    const { html } = renderMarkdown('# Title\n\n# Location\n\n# Forms');
    expect(html).toContain('id="heading-title"');
    expect(html).toContain('id="heading-location"');
    expect(html).toContain('id="heading-forms"');
  });
});
