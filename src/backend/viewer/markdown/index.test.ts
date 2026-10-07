import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

describe('renderMarkdown', () => {
  it('renders headings with a Unicode-safe anchor id', () => {
    const { html, malformed } = renderMarkdown('# Hello');
    expect(html).toContain('<h1 id="heading-hello" dir="auto">Hello</h1>');
    expect(malformed).toBe(false);
  });

  it('renders paragraphs', () => {
    const { html } = renderMarkdown('Just a paragraph.');
    expect(html).toContain('<p dir="auto">Just a paragraph.</p>');
  });

  it('renders basic GFM: bold, lists, and links', () => {
    const { html } = renderMarkdown('**bold**\n\n- one\n- two\n\n[link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li dir="auto">one</li>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('never crashes on malformed/edge-case input', () => {
    const inputs = ['', '```\nunterminated fence', '[link](', '<div><span>', '# '.repeat(10_000)];
    for (const input of inputs) {
      expect(() => renderMarkdown(input)).not.toThrow();
    }
  });

  it('renders footnotes, task lists, and definition lists', () => {
    const { html } = renderMarkdown(
      'Text with a footnote.[^1]\n\n[^1]: The note.\n\n' +
        '- [ ] todo\n- [x] done\n\n' +
        'Term\n: Definition',
    );
    expect(html).toContain('footnote');
    expect(html).toContain('task-list-item-checkbox');
    expect(html).toContain('checked');
    expect(html).toContain('<dl>');
    expect(html).toContain('<dt dir="auto">Term</dt>');
  });

  it('wraps tables for sticky headers + horizontal scroll (F26)', () => {
    const { html } = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('markora-table-wrap');
    expect(html).toContain('<table>');
  });

  it('renders a fenced code block with a language label and copy button (F10)', () => {
    const { html } = renderMarkdown('```javascript\nconst x = 1;\n```');
    expect(html).toContain('markora-code-block__copy-btn');
    expect(html).toContain('JavaScript');
    expect(html).toContain('hljs-keyword');
  });

  it('adds a line-numbers gutter only when codeLineNumbers is set', () => {
    const plain = renderMarkdown('```js\na\nb\n```').html;
    expect(plain).not.toContain('markora-code-block__gutter');

    const numbered = renderMarkdown('```js\na\nb\n```', { codeLineNumbers: true }).html;
    expect(numbered).toContain('markora-code-block__gutter');
    expect(numbered).toContain('<span>1</span>');
    expect(numbered).toContain('<span>2</span>');
  });

  describe('per-feature Markdown toggles (F69)', () => {
    const cases: Array<{ feature: string; source: string; marker: string }> = [
      { feature: 'tables', source: '| a |\n| - |\n| 1 |', marker: '<table>' },
      { feature: 'footnotes', source: 'Note.[^1]\n\n[^1]: x', marker: 'footnote' },
      { feature: 'taskLists', source: '- [ ] item', marker: 'task-list-item-checkbox' },
      { feature: 'definitionLists', source: 'Term\n: Def', marker: '<dl>' },
      { feature: 'containers', source: ':::info\nx\n:::', marker: 'markora-container' },
      { feature: 'frontMatter', source: '---\ntitle: x\n---\nBody', marker: 'markora-frontmatter' },
    ];

    it.each(cases)('$feature: on by default, off when disabled', ({ feature, source, marker }) => {
      const on = renderMarkdown(source);
      expect(on.html).toContain(marker);
      const off = renderMarkdown(source, { features: { [feature]: false } });
      expect(off.html).not.toContain(marker);
    });

    it('typographer converts straight quotes to curly quotes only when enabled', () => {
      const off = renderMarkdown('"quoted"');
      expect(off.html).toContain('"quoted"');
      const on = renderMarkdown('"quoted"', { features: { typographer: true } });
      expect(on.html).toContain('“quoted”');
    });

    it('lineBreaks converts a single newline to <br> only when enabled', () => {
      const off = renderMarkdown('line one\nline two');
      expect(off.html).not.toContain('<br>');
      const on = renderMarkdown('line one\nline two', { features: { lineBreaks: true } });
      expect(on.html).toContain('<br>');
    });
  });

  describe('MDX handling (F09, ADR-0008)', () => {
    it('renders the readable content of a component-heavy MDX document', () => {
      const source =
        'import Chart from \'./chart\'\n\n# Title\n\n<Card title="x">Body text.</Card>\n\n<Callout />';
      const { html } = renderMarkdown(source, { isMdx: true });
      expect(html).toContain('<h1 id="heading-title" dir="auto">Title</h1>');
      expect(html).toContain('Body text.');
      expect(html).toContain('markora-mdx-chip');
      expect(html).not.toContain('import');
    });

    it('does not run the MDX transform on an ordinary .md document', () => {
      const { html } = renderMarkdown('<Card>Text</Card>');
      // Without isMdx, capitalized tags are not a recognized construct —
      // DOMPurify strips the unknown element, keeping inner text.
      expect(html).toContain('Text');
    });
  });

  describe('security (Phase 2-A §7)', () => {
    it('renders a malicious inline SVG inert', () => {
      const source =
        '<svg onload="alert(1)"><script>alert(2)</script><foreignObject><body onload="alert(3)"></body></foreignObject></svg>';
      const { html } = renderMarkdown(source);
      expect(html).not.toContain('onload');
      expect(html).not.toContain('<script');
    });

    it("blocks a javascript: URL on a link (markdown-it's own validateLink rejects it before a link token is even created; the literal text is inert)", () => {
      const { html } = renderMarkdown('[click](javascript:alert(1))');
      expect(html).not.toContain('href="javascript:');
      expect(html).not.toContain('<a ');
    });

    it("blocks a javascript: URL that DOES reach the sanitizer (inline HTML, bypassing markdown-it's link parser)", () => {
      const { html } = renderMarkdown('<a href="javascript:alert(1)">click</a>');
      expect(html).not.toContain('javascript:');
    });

    it('renders dangerouslySetInnerHTML with an embedded onerror image inert end-to-end', () => {
      const source = '<div dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />';
      const { html } = renderMarkdown(source, { isMdx: true });
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('<script');
    });

    it('never lets an MDX component attribute reach the output', () => {
      const source = '<Card onClick={fetch("https://attacker.example")}>Text</Card>';
      const { html } = renderMarkdown(source, { isMdx: true });
      expect(html).not.toContain('onClick');
      expect(html).not.toContain('attacker.example');
      expect(html).toContain('Text');
    });
  });
});
