import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('mermaid container delimiter (F79)', () => {
  it('renders :::mermaid ... ::: as a diagram placeholder, identical to the fence form', () => {
    const { html } = renderMarkdown(':::mermaid\ngraph TD\nA --> B\n:::');
    expect(html).toContain('markora-diagram--mermaid');
    expect(html).toContain('graph TD');
    expect(html).toContain('A --&gt; B');
  });

  it('treats the content as literal text, not nested Markdown', () => {
    const { html } = renderMarkdown(':::mermaid\nA[Label with |pipe|] --> B\n:::');
    expect(html).toContain('Label with |pipe|');
    expect(html).not.toContain('<table');
  });

  it('does not crash on unclosed :::mermaid blocks', () => {
    expect(() => renderMarkdown(':::mermaid\ngraph TD\nA --> B')).not.toThrow();
  });

  it('does not intercept other named containers', () => {
    const { html } = renderMarkdown(':::info\nSome info.\n:::');
    expect(html).toContain('markora-container--info');
    expect(html).not.toContain('markora-diagram');
  });

  it('can be disabled via the mermaidDiagrams toggle, falling back to plain text', () => {
    const { html } = renderMarkdown(':::mermaid\ngraph TD\nA --> B\n:::', {
      features: { mermaidDiagrams: false },
    });
    expect(html).not.toContain('markora-diagram');
  });
});
