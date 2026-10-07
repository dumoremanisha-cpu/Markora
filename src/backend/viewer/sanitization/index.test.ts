import { describe, expect, it } from 'vitest';
import { sanitizeDiagramSvg, sanitizeHtml, sanitizeMathHtml } from './index';

describe('sanitizeHtml (security-privacy.md §1, §3)', () => {
  it('strips <script> tags', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
  });

  it('strips inline event-handler attributes', () => {
    const out = sanitizeHtml('<img src="x.png" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('blocks javascript: URLs in links', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
  });

  it('blocks javascript: URLs in images', () => {
    const out = sanitizeHtml('<img src="javascript:alert(1)">');
    expect(out).not.toContain('javascript:');
  });

  it('allows http(s), mailto, and relative links through', () => {
    const out = sanitizeHtml(
      '<a href="https://example.com">a</a><a href="mailto:x@example.com">b</a><a href="./relative.md">c</a>',
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="mailto:x@example.com"');
    expect(out).toContain('href="./relative.md"');
  });

  it('strips <style> tags and style attributes', () => {
    const out = sanitizeHtml('<style>body{display:none}</style><p style="color:red">hi</p>');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('style=');
  });
});

describe('sanitizeDiagramSvg (ADR-0002 Mermaid/Graphviz post-render pass)', () => {
  it('strips <script> tags embedded in a malicious diagram SVG', () => {
    const out = sanitizeDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
  });

  it('strips <foreignObject> (SVG script/HTML-injection vector)', () => {
    const out = sanitizeDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><script>alert(1)</script></foreignObject></svg>',
    );
    expect(out).not.toContain('foreignObject');
    expect(out).not.toContain('<script');
  });

  it('strips inline event-handler attributes', () => {
    const out = sanitizeDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>',
    );
    expect(out).not.toContain('onclick');
  });

  it('blocks javascript: URLs', () => {
    const out = sanitizeDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    );
    expect(out).not.toContain('javascript:');
  });

  it('preserves <style> blocks and style attributes needed for diagram theming', () => {
    const out = sanitizeDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.node{fill:#fff}</style><rect style="fill:red"/></svg>',
    );
    expect(out).toContain('<style');
    expect(out).toContain('style=');
  });
});

describe('sanitizeMathHtml (ADR-0002 KaTeX post-render pass)', () => {
  it('strips <script> tags', () => {
    const out = sanitizeMathHtml('<span class="katex">x</span><script>alert(1)</script>');
    expect(out).not.toContain('<script');
  });

  it('strips inline event-handler attributes', () => {
    const out = sanitizeMathHtml('<span onclick="alert(1)">x</span>');
    expect(out).not.toContain('onclick');
  });

  it('preserves the inline style attributes KaTeX uses for glyph positioning', () => {
    const out = sanitizeMathHtml('<span style="top:-3.32em;margin-right:0.05em;">x</span>');
    expect(out).toContain('style=');
  });
});
