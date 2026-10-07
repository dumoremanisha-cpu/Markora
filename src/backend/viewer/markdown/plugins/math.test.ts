import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('math (F12)', () => {
  it('renders inline $...$ as a math placeholder span', () => {
    const { html } = renderMarkdown('Energy is $E = mc^2$ per Einstein.');
    expect(html).toContain('markora-math');
    expect(html).toContain('data-display="false"');
    expect(html).toContain('E = mc^2');
  });

  it('renders display $$...$$ as a math placeholder block', () => {
    const { html } = renderMarkdown('$$\nx = y + z\n$$');
    expect(html).toContain('markora-math');
    expect(html).toContain('data-display="true"');
    expect(html).toContain('x = y + z');
  });

  it('renders single-line display math ($$...$$ on one line)', () => {
    const { html } = renderMarkdown('$$ a^2 + b^2 = c^2 $$');
    expect(html).toContain('data-display="true"');
    expect(html).toContain('a^2 + b^2 = c^2');
  });

  it('does not treat currency-like text as math', () => {
    const { html } = renderMarkdown('This costs $5 and that costs $10.');
    expect(html).not.toContain('markora-math');
  });

  it('does not treat a $ with trailing/leading space as an opener', () => {
    const { html } = renderMarkdown('A $ b $ c');
    expect(html).not.toContain('markora-math');
  });

  it('escapes HTML in the math source so it cannot break out as markup', () => {
    const { html } = renderMarkdown('$<script>alert(1)</script>$');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not span a raw newline for inline math', () => {
    const { html } = renderMarkdown('$a\nb$');
    expect(html).not.toContain('markora-math');
  });

  it('can be disabled via the math toggle', () => {
    const { html } = renderMarkdown('$E = mc^2$', { features: { math: false } });
    expect(html).not.toContain('markora-math');
  });

  it('does not crash on unclosed math delimiters', () => {
    expect(() => renderMarkdown('$unclosed and $$ also unclosed')).not.toThrow();
  });
});
