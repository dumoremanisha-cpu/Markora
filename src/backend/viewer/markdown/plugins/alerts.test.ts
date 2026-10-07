import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../index';

describe('GitHub-style alerts (F44)', () => {
  const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;

  it.each(types)('renders the %s alert type as a styled callout', (type) => {
    const { html } = renderMarkdown(`> [!${type}]\n> Body text.`);
    expect(html).toContain(`markora-alert--${type.toLowerCase()}`);
    expect(html).toContain('Body text.');
    expect(html).not.toContain(`[!${type}]`);
  });

  it('localizes the title by default', () => {
    const { html } = renderMarkdown('> [!NOTE]\n> Body text.');
    expect(html).toContain('Note');
    expect(html).not.toContain('>NOTE<');
  });

  it('shows the literal keyword when alertTitleMode is "literal"', () => {
    const { html } = renderMarkdown('> [!NOTE]\n> Body text.', { alertTitleMode: 'literal' });
    expect(html).toContain('NOTE');
  });

  it('leaves an ordinary blockquote untouched', () => {
    const { html } = renderMarkdown('> Just a quote.');
    expect(html).toContain('<blockquote dir="auto">');
    expect(html).not.toContain('markora-alert');
  });

  it('is distinct from, but coexists with, custom containers', () => {
    const { html } = renderMarkdown(
      '> [!WARNING]\n> Alert body.\n\n:::warning\nContainer body.\n:::',
    );
    expect(html).toContain('markora-alert--warning');
    expect(html).toContain('markora-container--warning');
  });
});
