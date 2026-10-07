// F27 × F30/F32 (ADR-0005's annotation-export section) — the static,
// JS-free equivalent of the live viewer's comment popover, shared by HTML
// export (`../export/html/`, on a throwaway clone) and print export
// (`../export/print/`, on the live DOM, cleaned up via
// `removeExportAnnotations` after printing). Highlights/underlines need no
// extra work here: their `<mark>` styling already carries over because the
// marks (`src/components/annotations/marks.ts`) are already present in
// whatever DOM is being exported — only comments need a visible marker and
// list, since their content normally only surfaces in a hover/click popover.
import { t } from '../i18n';
import type { ResolvedAnnotation } from '../viewer/annotations/reanchor';

export const EXPORT_ANNOTATION_MARKER_CLASS = 'markora-export-annotation-marker';
export const EXPORT_ANNOTATIONS_SECTION_CLASS = 'markora-export-annotations';

/**
 * Inserts a numbered `[n]` marker after each comment annotation's mark(s)
 * and appends a numbered comment list at the end of `root`, numbered by
 * document order. `resolved` must already exclude orphaned annotations —
 * this function doesn't filter status, only annotation type.
 */
export function renderAnnotationsForExport(
  root: HTMLElement,
  resolved: ResolvedAnnotation[],
): void {
  const comments = resolved
    .filter((r) => r.annotation.type === 'comment' && r.annotation.commentText)
    .sort((a, b) => a.start - b.start);
  if (comments.length === 0) return;

  comments.forEach(({ annotation }, index) => {
    // A plain attribute-equality filter rather than an escaped attribute
    // selector (`CSS.escape` isn't implemented in every DOM environment
    // this runs in) — annotation ids are `crypto.randomUUID()` values
    // anyway, never untrusted/selector-breaking text.
    const marks = Array.from(root.querySelectorAll<HTMLElement>('[data-annotation-id]')).filter(
      (el) => el.dataset.annotationId === annotation.id,
    );
    const lastMark = marks[marks.length - 1];
    if (!lastMark) return;
    const marker = document.createElement('sup');
    marker.className = EXPORT_ANNOTATION_MARKER_CLASS;
    marker.textContent = `[${index + 1}]`;
    lastMark.after(marker);
  });

  const section = document.createElement('section');
  section.className = EXPORT_ANNOTATIONS_SECTION_CLASS;
  const heading = document.createElement('h2');
  heading.textContent = t('export.annotations.heading');
  const list = document.createElement('ol');
  for (const { annotation } of comments) {
    const item = document.createElement('li');
    // `commentText` is user-authored, potentially pasted HTML-like text —
    // `.textContent` only, same rule as the live annotations panel
    // (security-privacy.md §1, src/components/annotations/index.ts).
    item.textContent = annotation.commentText ?? '';
    item.dir = 'auto';
    list.appendChild(item);
  }
  section.append(heading, list);
  root.appendChild(section);
}

/** Undoes {@link renderAnnotationsForExport} — used by print export to restore the live DOM after `window.print()` finishes. */
export function removeExportAnnotations(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll(`.${EXPORT_ANNOTATION_MARKER_CLASS}`)))
    el.remove();
  for (const el of Array.from(root.querySelectorAll(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)))
    el.remove();
}
