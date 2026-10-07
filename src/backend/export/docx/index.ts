// F31 / ADR-0005 — DOCX export orchestrator. Reuses Phase 7-A's toolbar
// export-menu/toast-progress pattern (../html/index.ts) — staged toasts
// through the one shared notification component, not a bespoke progress UI
// or an indefinite spinner. The four stages shown here consolidate the
// plan's five conceptual stages (parsing -> conversion -> image processing
// -> file generation -> download) into what this implementation actually
// has as separate awaited steps: `astMapper.ts` resolves images and math
// *as part of* walking the token stream (one pass, not two), so "conversion"
// and "image processing" are one real stage here, not two — still real,
// sequential, work-boundary-aligned progress, never a fake intermediate step.
import { Document, Packer } from 'docx';
import { t } from '../../i18n';
import { showToast } from '../../../frontend/components/notifications';
import { parseMarkdownTokens } from '../../viewer/markdown';
import type { MarkdownFeatureToggles } from '../../storage/schema';
import { getAnnotationsForDocument } from '../../storage';
import { mapTokensToDocx } from './astMapper';
import { rasterizeLatexToPng } from './mathRaster';

export interface DocxExportRequest {
  source: string;
  isMdx: boolean;
  markdownFeatures: MarkdownFeatureToggles;
  sourceLabel: string;
  documentId: string;
  includeAnnotations: boolean;
  blockRemoteImages: boolean;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filenameFor(sourceLabel: string): string {
  const base = sourceLabel.split(/[\\/]/).pop() ?? 'document';
  const stem = base.replace(/\.[^./]+$/, '');
  return `${stem || 'document'}.docx`;
}

export async function exportDocx(request: DocxExportRequest): Promise<void> {
  try {
    showToast(t('export.docx.progress.parsing'), 'info');
    const { tokens } = parseMarkdownTokens(request.source, {
      isMdx: request.isMdx,
      features: request.markdownFeatures,
      blockRemoteImages: request.blockRemoteImages,
    });

    const annotations = request.includeAnnotations
      ? await getAnnotationsForDocument(request.documentId)
      : [];

    showToast(t('export.docx.progress.converting'), 'info');
    const mapped = await mapTokensToDocx({
      tokens,
      lineBreaks: request.markdownFeatures.lineBreaks,
      annotations,
      includeAnnotations: request.includeAnnotations,
      rasterizeMath: rasterizeLatexToPng,
    });

    showToast(t('export.docx.progress.generating'), 'info');
    const doc = new Document({
      sections: [{ children: mapped.children }],
      footnotes: mapped.footnotes,
      endnotes: mapped.endnotes,
      comments: { children: mapped.comments },
      numbering: mapped.numbering,
    });

    showToast(t('export.docx.progress.downloading'), 'info');
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, filenameFor(request.sourceLabel));
    showToast(t('export.docx.success'), 'success');
  } catch {
    showToast(t('export.docx.error'), 'error');
  }
}
