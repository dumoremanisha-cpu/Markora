import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('external links (F25, F72)', () => {
  it('shows the indicator on a plain text link', () => {
    const { html } = renderMarkdown('[example](https://example.com)');
    expect(html).toContain('markora-link-indicator');
  });

  it('sets safe target/rel on every absolute http(s) link, regardless of the indicator toggle', () => {
    const { html } = renderMarkdown('[example](https://example.com)', {
      externalLinkIndicator: false,
    });
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('markora-link-indicator');
  });

  it('does not show the indicator on a link that only wraps an image (F72)', () => {
    const { html } = renderMarkdown('[![alt](https://example.com/img.png)](https://example.com)');
    expect(html).not.toContain('markora-link-indicator');
    expect(html).toContain('target="_blank"');
  });

  it('does not add target/rel to a relative link', () => {
    const { html } = renderMarkdown('[relative](./other.md)');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain('markora-link-indicator');
  });

  it('does not add target/rel to a mailto link', () => {
    const { html } = renderMarkdown('[mail](mailto:a@example.com)');
    expect(html).not.toContain('target="_blank"');
  });
});
