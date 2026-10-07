import { afterEach, describe, expect, it, vi } from 'vitest';
import { printDocument } from './index';
import { EXPORT_ANNOTATIONS_SECTION_CLASS } from '../annotations';
import type { Annotation } from '../../storage/schema';
import type { ResolvedAnnotation } from '../../viewer/annotations/reanchor';

function resolvedComment(id: string, text: string): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    documentId: 'doc',
    exactText: 'hi',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: 0,
    contentFingerprint: 'fp',
    type: 'comment',
    commentText: text,
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
  };
  return { annotation, start: 0, end: 2 };
}

describe('printDocument', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls window.print() after force-loading images and injecting annotation endnotes', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const contentEl = document.createElement('main');
    contentEl.innerHTML = '<mark data-annotation-id="c1">hi</mark>';

    await printDocument({
      contentEl,
      includeAnnotations: true,
      activeAnnotations: [resolvedComment('c1', 'A comment')],
    });

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(contentEl.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).not.toBeNull();
  });

  it('removes the injected annotation endnotes once printing finishes', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const contentEl = document.createElement('main');
    contentEl.innerHTML = '<mark data-annotation-id="c1">hi</mark>';

    await printDocument({
      contentEl,
      includeAnnotations: true,
      activeAnnotations: [resolvedComment('c1', 'A comment')],
    });

    window.dispatchEvent(new Event('afterprint'));

    expect(contentEl.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).toBeNull();
  });

  it('does not inject annotation endnotes when includeAnnotations is false', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const contentEl = document.createElement('main');
    contentEl.innerHTML = '<mark data-annotation-id="c1">hi</mark>';

    await printDocument({
      contentEl,
      includeAnnotations: false,
      activeAnnotations: [resolvedComment('c1', 'A comment')],
    });

    expect(contentEl.querySelector(`.${EXPORT_ANNOTATIONS_SECTION_CLASS}`)).toBeNull();
  });

  it('waits for an incomplete image to finish loading before printing', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const contentEl = document.createElement('main');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false, configurable: true });
    contentEl.appendChild(img);

    const promise = printDocument({ contentEl, includeAnnotations: false, activeAnnotations: [] });
    expect(printSpy).not.toHaveBeenCalled();

    img.dispatchEvent(new Event('load'));
    await promise;

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
