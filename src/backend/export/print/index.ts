// F32 / ADR-0005 — print/PDF export. No PDF-rendering library: relies
// entirely on the browser's native print-to-PDF (`03-architecture.md` §1),
// styled by the dedicated `src/frontend/styles/print.css` (loaded only for print
// media, so it never affects the on-screen app). Unlike HTML export, this
// operates on the live DOM rather than a throwaway clone — printing prints
// the real page — so anything it adds (annotation markers/endnotes) is
// removed again once printing finishes.
import { renderAnnotationsForExport, removeExportAnnotations } from '../annotations';
import type { ResolvedAnnotation } from '../../viewer/annotations/reanchor';

/** `window.print()` does not wait for lazy-loaded images (§24) — walk the DOM and make sure every image has actually finished loading first. */
async function forceLoadLazyImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      img.loading = 'eager';
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

export interface PrintRequest {
  contentEl: HTMLElement;
  includeAnnotations: boolean;
  activeAnnotations: ResolvedAnnotation[];
}

export async function printDocument(request: PrintRequest): Promise<void> {
  if (request.includeAnnotations) {
    renderAnnotationsForExport(request.contentEl, request.activeAnnotations);
  }
  await forceLoadLazyImages(request.contentEl);

  const cleanup = (): void => {
    removeExportAnnotations(request.contentEl);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
