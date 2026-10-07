// F30 / ADR-0005 — assembles the final standalone HTML string. The theme/
// typography custom properties (`--markora-*`) the live app applies as
// inline styles on `document.documentElement` (`src/utils/typography.ts`,
// `src/viewer/index.ts`'s `applyLiveSettings`) are copied verbatim onto the
// exported document's own root, rather than re-deriving them, since the
// tree-shaken CSS's rules reference those variables by name and a
// mismatched/missing value would silently fall back to the browser default.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

export interface ExportDocumentOptions {
  title: string;
  bodyHtml: string;
  css: string;
  theme: 'light' | 'dark';
  rootStyle: string;
  contentWidthMode: 'centered' | 'full';
  noStickyTables: boolean;
  /** RTL support (05-ux-i18n-accessibility.md §6) — the UI locale/direction active at export time. Document-content direction is unaffected: it's carried over unchanged from the already-rendered `dir="auto"` blocks inside `bodyHtml`. */
  lang?: string;
  dir?: 'ltr' | 'rtl';
}

export function buildExportDocument(options: ExportDocumentOptions): string {
  const classAttr = options.noStickyTables ? ' class="markora-no-sticky-tables"' : '';
  return (
    '<!doctype html>\n' +
    `<html lang="${escapeAttr(options.lang ?? 'en')}" dir="${escapeAttr(options.dir ?? 'ltr')}" ` +
    `data-theme="${escapeAttr(options.theme)}" ` +
    `data-content-width-mode="${escapeAttr(options.contentWidthMode)}"${classAttr} ` +
    `style="${escapeAttr(options.rootStyle)}">\n` +
    '<head>\n' +
    '<meta charset="UTF-8" />\n' +
    `<title>${escapeHtml(options.title)}</title>\n` +
    `<style>${options.css}</style>\n` +
    '</head>\n' +
    '<body>\n' +
    options.bodyHtml +
    '\n</body>\n</html>\n'
  );
}
