import { describe, expect, it } from 'vitest';
import { renderMarkdown, parseMarkdownTokens } from '../index';
import { BLOCKED_SRC_ATTR } from './blockRemoteImages';

describe('registerBlockRemoteImages (via renderMarkdown)', () => {
  it('does nothing when blockRemoteImages is false (default)', () => {
    const { html } = renderMarkdown('![alt text](https://example.com/photo.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/photo.png"');
    expect(html).not.toContain('markora-image-wrap--blocked');
  });

  it('replaces a remote http(s) image with a click-to-load placeholder, never leaking the real src', () => {
    const { html } = renderMarkdown('![alt text](https://example.com/photo.png)', {
      blockRemoteImages: true,
    });
    // No real <img> tag at all — the browser must have nothing to fetch
    // until the user clicks. (Checking specifically for a real `src=`
    // attribute, not just the substring "src=", since
    // `data-blocked-src="..."` legitimately contains "src=" too.)
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/[^-]src="https:\/\/example\.com/);
    expect(html).toContain('markora-image-wrap--blocked');
    expect(html).toContain('data-blocked-src="https://example.com/photo.png"');
    expect(html).toContain('data-blocked-alt="alt text"');
    expect(html).toContain('markora-image-placeholder--clickable');
  });

  it('preserves an image title as data-blocked-title', () => {
    const { html } = renderMarkdown('![alt](https://example.com/a.png "a title")', {
      blockRemoteImages: true,
    });
    expect(html).toContain('data-blocked-title="a title"');
  });

  it('leaves relative, data:, and file: image sources untouched', () => {
    const relative = renderMarkdown('![a](./local.png)', { blockRemoteImages: true }).html;
    expect(relative).toContain('<img');
    expect(relative).not.toContain('markora-image-wrap--blocked');

    const dataUrl = renderMarkdown('![a](data:image/png;base64,AAAA)', {
      blockRemoteImages: true,
    }).html;
    expect(dataUrl).toContain('<img');
    expect(dataUrl).not.toContain('markora-image-wrap--blocked');
  });

  it('escapes HTML-significant characters in the blocked URL/alt so the sanitizer sees well-formed attributes', () => {
    const { html } = renderMarkdown('![" onerror="alert(1)](https://example.com/x.png?a=1&b=2)', {
      blockRemoteImages: true,
    });
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('data-blocked-src="https://example.com/x.png?a=1&amp;b=2"');
  });

  it('marks the underlying token with BLOCKED_SRC_ATTR, not just the rendered HTML (what DOCX export reads)', () => {
    const { tokens } = parseMarkdownTokens('![alt](https://example.com/photo.png)', {
      blockRemoteImages: true,
    });
    const inline = tokens.find((tk) => tk.type === 'inline');
    const imageToken = inline?.children?.find((tk) => tk.type === 'image');
    expect(imageToken?.attrGet(BLOCKED_SRC_ATTR)).toBe('https://example.com/photo.png');
    expect(imageToken?.attrGet('src')).toBe('');
  });
});
