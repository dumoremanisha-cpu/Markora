import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('mermaid fence special-case (F11)', () => {
  it('renders a ```mermaid fence as a diagram placeholder instead of a highlighted code block', () => {
    const { html } = renderMarkdown('```mermaid\ngraph TD\nA --> B\n```');
    expect(html).toContain('markora-diagram--mermaid');
    expect(html).not.toContain('markora-code-block');
    expect(html).toContain('graph TD');
  });

  it('is case-insensitive on the fence language', () => {
    const { html } = renderMarkdown('```Mermaid\ngraph TD\n```');
    expect(html).toContain('markora-diagram--mermaid');
  });

  it('other languages still render as highlighted code blocks', () => {
    const { html } = renderMarkdown('```javascript\nconst x = 1;\n```');
    expect(html).toContain('markora-code-block');
    expect(html).not.toContain('markora-diagram');
  });

  it('escapes diagram source so it cannot break out of the placeholder markup', () => {
    const { html } = renderMarkdown('```mermaid\n<img src=x onerror=alert(1)>\n```');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('falls back to a highlighted code block when the mermaidDiagrams toggle is off', () => {
    const { html } = renderMarkdown('```mermaid\ngraph TD\n```', {
      features: { mermaidDiagrams: false },
    });
    expect(html).toContain('markora-code-block');
    expect(html).not.toContain('markora-diagram');
  });
});

describe('graphviz fence special-case (F13)', () => {
  it('renders a ```dot fence as a diagram placeholder instead of a highlighted code block', () => {
    const { html } = renderMarkdown('```dot\ndigraph G { a -> b }\n```');
    expect(html).toContain('markora-diagram--graphviz');
    expect(html).not.toContain('markora-code-block');
    expect(html).toContain('digraph G');
  });

  it('also recognizes the ```graphviz language alias', () => {
    const { html } = renderMarkdown('```graphviz\ndigraph G { a -> b }\n```');
    expect(html).toContain('markora-diagram--graphviz');
  });

  it('is case-insensitive on the fence language', () => {
    const { html } = renderMarkdown('```DOT\ndigraph G { a -> b }\n```');
    expect(html).toContain('markora-diagram--graphviz');
  });

  it('falls back to a highlighted code block when the graphvizDiagrams toggle is off', () => {
    const { html } = renderMarkdown('```dot\ndigraph G { a -> b }\n```', {
      features: { graphvizDiagrams: false },
    });
    expect(html).toContain('markora-code-block');
    expect(html).not.toContain('markora-diagram');
  });
});

describe('plantuml fence special-case (F14)', () => {
  it('renders a ```plantuml fence as a diagram placeholder, regardless of the network opt-in', () => {
    const { html } = renderMarkdown('```plantuml\n@startuml\nBob -> Alice\n@enduml\n```');
    expect(html).toContain('markora-diagram--plantuml');
    expect(html).not.toContain('markora-code-block');
    expect(html).toContain('Bob -&gt; Alice');
  });

  it('also recognizes the ```puml language alias', () => {
    const { html } = renderMarkdown('```puml\n@startuml\nBob -> Alice\n@enduml\n```');
    expect(html).toContain('markora-diagram--plantuml');
  });
});
