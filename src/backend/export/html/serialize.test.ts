import { describe, expect, it } from 'vitest';
import { buildExportDocument } from './serialize';

describe('buildExportDocument', () => {
  it('embeds the theme, content-width-mode and typography custom properties on <html>', () => {
    const html = buildExportDocument({
      title: 'My Doc',
      bodyHtml: '<main>hi</main>',
      css: '.x { color: red; }',
      theme: 'dark',
      rootStyle: '--markora-content-font-size: 18px;',
      contentWidthMode: 'full',
      noStickyTables: true,
    });

    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-content-width-mode="full"');
    expect(html).toContain('class="markora-no-sticky-tables"');
    expect(html).toContain('--markora-content-font-size: 18px;');
    expect(html).toContain('<style>.x { color: red; }</style>');
    expect(html).toContain('<main>hi</main>');
  });

  it('omits the sticky-tables class when not requested', () => {
    const html = buildExportDocument({
      title: 'Doc',
      bodyHtml: '<main></main>',
      css: '',
      theme: 'light',
      rootStyle: '',
      contentWidthMode: 'centered',
      noStickyTables: false,
    });
    expect(html).not.toContain('markora-no-sticky-tables');
  });

  it('HTML-escapes the title and attribute values', () => {
    const html = buildExportDocument({
      title: '<script>alert(1)</script>',
      bodyHtml: '<main></main>',
      css: '',
      theme: 'light',
      rootStyle: '',
      contentWidthMode: 'centered',
      noStickyTables: false,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a double quote inside the copied root style attribute', () => {
    const html = buildExportDocument({
      title: 'Doc',
      bodyHtml: '<main></main>',
      css: '',
      theme: 'light',
      rootStyle: '--x: "y";',
      contentWidthMode: 'centered',
      noStickyTables: false,
    });
    // The attribute value itself must not contain an unescaped ".
    const match = html.match(/style="([^]*?)"/);
    expect(match?.[1]).not.toContain('"');
  });
});
