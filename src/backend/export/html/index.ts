// F30 / ADR-0005 — HTML export orchestrator: reuses the already-rendered,
// already-sanitized viewer DOM (parse -> sanitize -> enhance already ran;
// this only serializes the result) rather than re-parsing the document.
// Staged (P12, docs/specs/06-testing-quality-gate.md §1a): each stage below
// is its own microtask/await boundary and reports through the shared toast
// component (code-conventions.md §5) rather than a bespoke progress UI, so
// the main thread stays responsive through image embedding on a large
// document with many images.
import { t, getActiveLocale, getActiveDirection } from '../../i18n';
import { showToast } from '../../../frontend/components/notifications';
import { getAppliedTheme } from '../../utils/theme';
import type { ResolvedAnnotation } from '../../viewer/annotations/reanchor';
import { buildExportClone } from './domSnapshot';
import { buildEmbeddedToc } from './toc';
import { embedImages } from './imageEmbed';
import { collectUsedCss } from './cssTreeShake';
import { buildExportDocument } from './serialize';

export interface HtmlExportRequest {
  contentEl: HTMLElement;
  sourceLabel: string;
  includeAnnotations: boolean;
  activeAnnotations: ResolvedAnnotation[];
  embedToc: boolean;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Deferred revoke: revoking synchronously can cancel the download before
  // the browser has actually started reading the blob in some builds (same
  // reasoning as src/components/diagramChrome/index.ts's triggerDownload).
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filenameFor(sourceLabel: string): string {
  const base = sourceLabel.split(/[\\/]/).pop() ?? 'document';
  const stem = base.replace(/\.[^./]+$/, '');
  return `${stem || 'document'}.html`;
}

export async function exportHtml(request: HtmlExportRequest): Promise<void> {
  try {
    showToast(t('export.html.progress.preparing'), 'info');
    const clone = buildExportClone(request.contentEl, {
      includeAnnotations: request.includeAnnotations,
      activeAnnotations: request.activeAnnotations,
      embeddedToc: request.embedToc ? buildEmbeddedToc(request.contentEl) : null,
    });

    showToast(t('export.html.progress.images'), 'info');
    await embedImages(clone);

    const css = collectUsedCss(clone);
    const rootEl = document.documentElement;
    const html = buildExportDocument({
      title: request.sourceLabel,
      bodyHtml: clone.outerHTML,
      css,
      theme: getAppliedTheme(),
      rootStyle: rootEl.getAttribute('style') ?? '',
      contentWidthMode: rootEl.dataset.contentWidthMode === 'full' ? 'full' : 'centered',
      noStickyTables: rootEl.classList.contains('markora-no-sticky-tables'),
      lang: getActiveLocale(),
      dir: getActiveDirection(),
    });

    triggerDownload(new Blob([html], { type: 'text/html' }), filenameFor(request.sourceLabel));
    showToast(t('export.html.success'), 'success');
  } catch {
    showToast(t('export.html.error'), 'error');
  }
}
