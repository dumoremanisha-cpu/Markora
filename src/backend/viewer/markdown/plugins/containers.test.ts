import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('custom containers (F67)', () => {
  it('renders info/warning/caution/danger as styled boxes', () => {
    const { html: info } = renderMarkdown(':::info\nSome info.\n:::');
    expect(info).toContain('markora-container--info');
    expect(info).toContain('Some info.');

    const { html: warning } = renderMarkdown(':::warning\nBe careful.\n:::');
    expect(warning).toContain('markora-container--warning');

    const { html: caution } = renderMarkdown(':::caution\nBe careful.\n:::');
    expect(caution).toContain('markora-container--warning');

    const { html: danger } = renderMarkdown(':::danger\nDo not do this.\n:::');
    expect(danger).toContain('markora-container--danger');
  });

  it('renders details as a native collapsible element', () => {
    const { html } = renderMarkdown(':::details\nHidden content.\n:::');
    expect(html).toContain('<details');
    expect(html).toContain('<summary>');
    expect(html).toContain('Hidden content.');
  });

  it('supports a custom title after the container type', () => {
    const { html } = renderMarkdown(':::details Click to expand\nHidden content.\n:::');
    expect(html).toContain('<summary>Click to expand</summary>');
  });

  it('renders spoiler as a collapsible element', () => {
    const { html } = renderMarkdown(':::spoiler\nSecret.\n:::');
    expect(html).toContain('<details');
    expect(html).toContain('markora-container--spoiler');
  });

  it('escapes HTML in a custom title', () => {
    const { html } = renderMarkdown(':::details <script>alert(1)</script>\ncontent\n:::');
    expect(html).not.toContain('<script>');
  });

  it('does not treat malformed/unclosed container syntax as a crash', () => {
    expect(() => renderMarkdown(':::info\nNever closed')).not.toThrow();
  });

  it('can be disabled via the containers toggle', () => {
    const { html } = renderMarkdown(':::info\nSome info.\n:::', {
      features: { containers: false },
    });
    expect(html).not.toContain('markora-container');
  });
});
