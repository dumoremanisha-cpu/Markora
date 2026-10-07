import { describe, expect, it } from 'vitest';
import {
  EXPORT_ANNOTATION_MARKER_CLASS,
  EXPORT_ANNOTATIONS_SECTION_CLASS,
  removeExportAnnotations,
  renderAnnotationsForExport,
} from './annotations';
import type { Annotation } from '../storage/schema';
import type { ResolvedAnnotation } from '../viewer/annotations/reanchor';

function comment(id: string, text: string, start: number): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    documentId: 'doc',
    exactText: 'quoted text',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: start,
    contentFingerprint: 'fp',
    type: 'comment',
    commentText: text,
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
  };
  return { annotation, start, end: start + annotation.exactText.length };
}

function highlight(id: string, start: number): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    documentId: 'doc',
    exactText: 'quoted text',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: start,
    contentFingerprint: 'fp',
    type: 'highlight',
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
  };
  return { annotation, start, end: start + annotation.exactText.length };
}

describe('renderAnnotationsForExport', () => {
  it('does nothing for a document with no comment annotations', () => {
    const root = document.createElement('div');
    root.innerHTML = '<mark class="markora-annotation" data-annotation-id="h1">hi</mark>';
    renderAnnotationsForExport(root, [highlight('h1', 0)]);
    expect(root.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).toBeNull();
  });

  it('inserts a numbered marker after each comment mark, numbered by document order', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<mark data-annotation-id="c2">second</mark>' + '<mark data-annotation-id="c1">first</mark>';
    // c1 starts before c2 in the document, even though c2's mark appears first in this fixture's markup.
    renderAnnotationsForExport(root, [
      comment('c2', 'Second comment', 10),
      comment('c1', 'First comment', 0),
    ]);

    const markers = root.querySelectorAll(`.${EXPORT_ANNOTATION_MARKER_CLASS}`);
    expect(markers).toHaveLength(2);
    // c1 (start 0) is numbered [1] even though its mark is the second element in the markup.
    const c1Mark = root.querySelector('[data-annotation-id="c1"]')!;
    expect(c1Mark.nextElementSibling?.textContent).toBe('[1]');
    const c2Mark = root.querySelector('[data-annotation-id="c2"]')!;
    expect(c2Mark.nextElementSibling?.textContent).toBe('[2]');
  });

  it('appends a comment list in document order with the exact comment text', () => {
    const root = document.createElement('div');
    root.innerHTML = '<mark data-annotation-id="c1">a</mark><mark data-annotation-id="c2">b</mark>';
    renderAnnotationsForExport(root, [comment('c1', 'First', 0), comment('c2', 'Second', 20)]);

    const items = Array.from(root.querySelectorAll(`.${EXPORT_ANNOTATIONS_SECTION_CLASS} li`));
    expect(items.map((li) => li.textContent)).toEqual(['First', 'Second']);
  });

  it('never interprets comment text as markup (textContent only)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<mark data-annotation-id="c1">a</mark>';
    renderAnnotationsForExport(root, [comment('c1', '<img src=x onerror=alert(1)>', 0)]);

    const item = root.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS} li`)!;
    expect(item.querySelector('img')).toBeNull();
    expect(item.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('skips a comment annotation whose mark is not present in root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>plain text, no mark</p>';
    expect(() => renderAnnotationsForExport(root, [comment('missing', 'text', 0)])).not.toThrow();
    // The comment still appears in the endnote list even if its anchor mark is gone.
    expect(root.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).not.toBeNull();
  });
});

describe('removeExportAnnotations', () => {
  it('removes both the inline markers and the footer section', () => {
    const root = document.createElement('div');
    root.innerHTML = '<mark data-annotation-id="c1">a</mark>';
    renderAnnotationsForExport(root, [comment('c1', 'text', 0)]);
    expect(root.querySelector(`.${EXPORT_ANNOTATION_MARKER_CLASS}`)).not.toBeNull();

    removeExportAnnotations(root);

    expect(root.querySelector(`.${EXPORT_ANNOTATION_MARKER_CLASS}`)).toBeNull();
    expect(root.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).toBeNull();
  });
});
