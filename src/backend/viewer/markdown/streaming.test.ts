import { describe, expect, it } from 'vitest';
import { renderMarkdown, renderMarkdownStreaming } from './index';

async function collectStreamed(
  source: string,
  options: Parameters<typeof renderMarkdownStreaming>[1] = {},
): Promise<{ html: string; malformed: boolean }> {
  const chunks: string[] = [];
  const { malformed } = await renderMarkdownStreaming(source, options, (chunk) =>
    chunks.push(chunk),
  );
  return { html: chunks.join(''), malformed };
}

describe('renderMarkdownStreaming', () => {
  it('produces the same HTML as the synchronous renderMarkdown for a small document', async () => {
    const source = '# Hello\n\nA paragraph with a [link](https://example.com).';
    const sync = renderMarkdown(source);
    const streamed = await collectStreamed(source);
    expect(streamed.html).toBe(sync.html);
    expect(streamed.malformed).toBe(sync.malformed);
  });

  it('keeps heading-anchor numbering identical across many chunks (dedup spans chunk boundaries)', async () => {
    const count = 400;
    const source = Array.from({ length: count }, () => '# Same\n\nBody.').join('\n\n');
    const sync = renderMarkdown(source);
    const chunks: string[] = [];
    await renderMarkdownStreaming(source, {}, (c) => chunks.push(c));
    expect(chunks.length).toBeGreaterThan(1);
    const streamedHtml = chunks.join('');
    expect(streamedHtml).toBe(sync.html);
    expect(streamedHtml).toContain('id="heading-same"');
    expect(streamedHtml).toContain(`id="heading-same-${count - 1}"`);
  });

  it('renders footnotes identically when chunked', async () => {
    const source = 'Note.[^1]\n\n[^1]: The footnote body.';
    const sync = renderMarkdown(source);
    const streamed = await collectStreamed(source);
    expect(streamed.html).toBe(sync.html);
  });

  it('renders a front-matter card as its own chunk, before the body', async () => {
    const source = '---\ntitle: Doc\n---\n\n# Heading';
    const chunks: string[] = [];
    await renderMarkdownStreaming(source, {}, (c) => chunks.push(c));
    expect(chunks[0]).toContain('markora-frontmatter');
    expect(chunks.at(-1)).toContain('<h1');
  });

  it('falls back to an escaped fenced block when the MDX transform throws, same as renderMarkdown', async () => {
    const source = '<Card>Text</Card>';
    const sync = renderMarkdown(source, { isMdx: true });
    const streamed = await collectStreamed(source, { isMdx: true });
    expect(streamed.html).toBe(sync.html);
  });

  it('yields multiple chunks for a document larger than one chunk batch', async () => {
    const source = Array.from({ length: 200 }, (_, i) => `## Heading ${i}\n\nBody ${i}.`).join(
      '\n\n',
    );
    const chunks: string[] = [];
    await renderMarkdownStreaming(source, {}, (c) => chunks.push(c));
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('never throws on malformed/edge-case input', async () => {
    const inputs = ['', '```\nunterminated fence', '[link](', '<div><span>'];
    for (const input of inputs) {
      await expect(collectStreamed(input)).resolves.not.toThrow();
    }
  });
});
