import { describe, expect, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { buildTokenPlainText } from './tokenPlainText';

const md = new MarkdownIt();

describe('buildTokenPlainText', () => {
  it('concatenates paragraph text', () => {
    const tokens = md.parse('Hello world.', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('Hello world.');
  });

  it('ignores markup wrapping (bold/italic contribute no characters of their own)', () => {
    const tokens = md.parse('**bold** and *italic*', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('bold and italic');
  });

  it('includes inline code content', () => {
    const tokens = md.parse('Use `code` here.', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('Use code here.');
  });

  it('softbreak contributes a newline when lineBreaks is off, nothing when on', () => {
    const tokens = md.parse('line one\nline two', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('line one\nline two');
    expect(buildTokenPlainText(tokens, { lineBreaks: true })).toBe('line oneline two');
  });

  it('concatenates across multiple paragraphs with no separator', () => {
    const tokens = md.parse('First.\n\nSecond.', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('First.Second.');
  });

  it('includes fenced code block content, trailing newline stripped', () => {
    const tokens = md.parse('```\nconsole.log(1)\n```', {});
    expect(buildTokenPlainText(tokens, { lineBreaks: false })).toBe('console.log(1)');
  });
});
