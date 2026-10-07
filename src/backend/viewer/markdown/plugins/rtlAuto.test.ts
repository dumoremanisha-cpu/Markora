import { describe, expect, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { registerRtlAuto } from './rtlAuto';

function render(source: string): string {
  const md = new MarkdownIt();
  registerRtlAuto(md);
  return md.render(source);
}

describe('registerRtlAuto', () => {
  it('adds dir="auto" to paragraphs, headings, list items, and blockquotes', () => {
    const html = render('# Heading\n\nA paragraph.\n\n- item\n\n> quote');
    expect(html).toContain('<h1 dir="auto">');
    expect(html).toContain('<p dir="auto">');
    expect(html).toContain('<li dir="auto">');
    expect(html).toContain('<blockquote dir="auto">');
  });

  it('adds dir="auto" to table cells', () => {
    const html = render('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<th dir="auto">');
    expect(html).toContain('<td dir="auto">');
  });

  it('never applies dir="auto" to fenced or indented code blocks', () => {
    const html = render('```\nsome code\n```\n\n    indented code');
    expect(html).not.toMatch(/<(pre|code)[^>]*dir="auto"/);
  });
});
