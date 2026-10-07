import { describe, expect, it, vi } from 'vitest';

vi.mock('./mdx', async () => {
  const actual = await vi.importActual<typeof import('./mdx')>('./mdx');
  return {
    ...actual,
    transformMdx: () => {
      throw new Error('simulated transform failure');
    },
  };
});

describe('renderMarkdown MDX failure fallback (ADR-0008 §4)', () => {
  it('renders the raw source as a fenced code block with an inline notice when the transform throws', async () => {
    const { renderMarkdown } = await import('./index');
    const source = '<Card>This would normally be stripped.</Card>';
    const { html, malformed } = renderMarkdown(source, { isMdx: true });
    expect(malformed).toBe(false);
    expect(html).toContain('markora-notice');
    expect(html).toContain('<pre>');
    expect(html).toContain('This would normally be stripped.');
    expect(html).not.toContain('<Card>');
  });
});
