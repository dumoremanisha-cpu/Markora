import { describe, expect, it } from 'vitest';
import { extractFrontMatter, renderFrontMatterCard } from './frontMatter';
import { renderMarkdown } from './index';

describe('extractFrontMatter', () => {
  it('parses a leading YAML block and strips it from the body', () => {
    const source = '---\ntitle: Hello\nauthor: Ada\n---\n\n# Body';
    const { data, body } = extractFrontMatter(source);
    expect(data).toEqual({ title: 'Hello', author: 'Ada' });
    expect(body.trim()).toBe('# Body');
  });

  it('returns null data when there is no front matter', () => {
    const { data, body } = extractFrontMatter('# Just a heading');
    expect(data).toBeNull();
    expect(body).toBe('# Just a heading');
  });

  it('does not crash on malformed YAML and leaves the block intact', () => {
    const source = '---\n: this is not: valid: yaml: at: all:\n---\nBody';
    expect(() => extractFrontMatter(source)).not.toThrow();
  });

  it('rejects YAML aliases (denial-of-service hardening)', () => {
    const source = '---\na: &a [1,2,3]\nb: *a\n---\nBody';
    const { data } = extractFrontMatter(source);
    expect(data).toBeNull();
  });
});

describe('renderFrontMatterCard', () => {
  it('renders values as escaped text, never as HTML', () => {
    const html = renderFrontMatterCard({ title: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('joins array values with commas', () => {
    const html = renderFrontMatterCard({ tags: ['a', 'b', 'c'] });
    expect(html).toContain('a, b, c');
  });
});

describe('renderMarkdown front matter integration (F43)', () => {
  it('shows a front-matter card at the top of the document', () => {
    const { html } = renderMarkdown('---\ntitle: My Doc\n---\n\n# Heading');
    expect(html).toContain('markora-frontmatter');
    expect(html).toContain('My Doc');
    expect(html.indexOf('markora-frontmatter')).toBeLessThan(html.indexOf('<h1'));
  });

  it('renders the delimiters literally when the frontMatter toggle is off', () => {
    const { html } = renderMarkdown('---\ntitle: My Doc\n---\n\n# Heading', {
      features: { frontMatter: false },
    });
    expect(html).not.toContain('markora-frontmatter');
  });
});
