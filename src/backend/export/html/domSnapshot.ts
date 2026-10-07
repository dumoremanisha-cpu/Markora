// F30 / ADR-0005 — turns the live, already-rendered, already-sanitized
// content element into a standalone export clone: interactive diagram
// chrome (F11 §4) is flattened down to its plain SVG (the exported file has
// no JS to drive zoom/pan/download buttons), and annotations are either
// rendered statically (marker + endnote list) or stripped entirely,
// per the "Include annotations in exports" setting.
import { renderAnnotationsForExport } from '../annotations';
import type { ResolvedAnnotation } from '../../viewer/annotations/reanchor';

function flattenDiagramChrome(root: HTMLElement): void {
  for (const chrome of Array.from(root.querySelectorAll<HTMLElement>('.markora-diagram-chrome'))) {
    const svg = chrome.querySelector('.markora-diagram-chrome__pan-zoom > svg');
    if (svg) chrome.replaceWith(svg.cloneNode(true) as Element);
    else chrome.remove();
  }
}

/**
 * security-privacy.md §1 point 4: "export falls back to linking rather
 * than embedding" for a "Block remote images" placeholder. The live
 * viewer's click-to-load button (src/viewer/images/enhance.ts) needs JS
 * that a standalone export must not depend on
 * (06-testing-quality-gate.md §3's export area: "requires no JavaScript
 * to display content") — a plain link the reader can open themselves is
 * the one thing that still works with zero script.
 */
function flattenBlockedImages(root: HTMLElement): void {
  for (const wrap of Array.from(
    root.querySelectorAll<HTMLElement>('.markora-image-wrap--blocked'),
  )) {
    const href = wrap.dataset.blockedSrc;
    if (!href) {
      wrap.remove();
      continue;
    }
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = wrap.dataset.blockedAlt || href;
    wrap.replaceWith(link);
  }
}

/** Unwraps every annotation `<mark>`, restoring its text to the surrounding node — same technique as `src/components/annotations/marks.ts`'s own unwrap pass, reimplemented here (not imported) since this operates on a disposable export clone rather than the live document it's built for. */
function stripAnnotationMarks(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll('.markora-annotation'))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  root.normalize();
}

export interface BuildExportCloneOptions {
  includeAnnotations: boolean;
  activeAnnotations: ResolvedAnnotation[];
  embeddedToc: HTMLElement | null;
}

export function buildExportClone(
  contentEl: HTMLElement,
  options: BuildExportCloneOptions,
): HTMLElement {
  const clone = contentEl.cloneNode(true) as HTMLElement;
  flattenDiagramChrome(clone);
  flattenBlockedImages(clone);

  if (options.includeAnnotations) {
    renderAnnotationsForExport(clone, options.activeAnnotations);
  } else {
    stripAnnotationMarks(clone);
  }

  if (options.embeddedToc) clone.insertBefore(options.embeddedToc, clone.firstChild);

  return clone;
}
