import { describe, expect, it } from 'vitest';
import { buildExportClone } from './domSnapshot';
import type { Annotation } from '../../storage/schema';
import type { ResolvedAnnotation } from '../../viewer/annotations/reanchor';

function resolvedHighlight(id: string): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    documentId: 'doc',
    exactText: 'hi',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: 0,
    contentFingerprint: 'fp',
    type: 'highlight',
    createdAt: 0,
    updatedAt: 0,
    status: 'active',
  };
  return { annotation, start: 0, end: 2 };
}

function contentWithDiagramChrome(): HTMLElement {
  const contentEl = document.createElement('main');
  contentEl.innerHTML =
    '<div class="markora-diagram markora-diagram--mermaid" data-rendered="true">' +
    '<div class="markora-diagram-chrome">' +
    '<div class="markora-diagram-chrome__toolbar"><button>zoom</button></div>' +
    '<div class="markora-diagram-chrome__inline-slot">' +
    '<div class="markora-diagram-chrome__stage">' +
    '<div class="markora-diagram-chrome__pan-zoom">' +
    '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>' +
    '</div></div></div>' +
    '<div class="markora-diagram-chrome__fullscreen" hidden></div>' +
    '</div></div>';
  return contentEl;
}

describe('buildExportClone', () => {
  it('replaces interactive diagram chrome with the bare SVG', () => {
    const clone = buildExportClone(contentWithDiagramChrome(), {
      includeAnnotations: true,
      activeAnnotations: [],
      embeddedToc: null,
    });

    expect(clone.querySelector('.markora-diagram-chrome')).toBeNull();
    expect(clone.querySelector('.markora-diagram-chrome__toolbar')).toBeNull();
    expect(clone.querySelector('svg')).not.toBeNull();
  });

  it('replaces a "Block remote images" placeholder with a plain link (export must not depend on JS to reveal it)', () => {
    const contentEl = document.createElement('main');
    contentEl.innerHTML =
      '<p>before <span class="markora-image-wrap markora-image-wrap--blocked" ' +
      'data-blocked-src="https://example.com/photo.png" data-blocked-alt="a photo">' +
      '<button type="button" class="markora-image-placeholder markora-image-placeholder--clickable">Click to load image: a photo</button>' +
      '</span> after</p>';

    const clone = buildExportClone(contentEl, {
      includeAnnotations: true,
      activeAnnotations: [],
      embeddedToc: null,
    });

    expect(clone.querySelector('.markora-image-wrap--blocked')).toBeNull();
    expect(clone.querySelector('button')).toBeNull();
    const link = clone.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/photo.png');
    expect(link?.textContent).toBe('a photo');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not mutate the live contentEl passed in', () => {
    const live = contentWithDiagramChrome();
    buildExportClone(live, { includeAnnotations: true, activeAnnotations: [], embeddedToc: null });
    expect(live.querySelector('.markora-diagram-chrome')).not.toBeNull();
  });

  it('strips annotation marks entirely when includeAnnotations is false', () => {
    const contentEl = document.createElement('main');
    contentEl.innerHTML =
      '<p>before <mark class="markora-annotation markora-annotation--highlight" ' +
      'data-annotation-id="h1">hi</mark> after</p>';

    const clone = buildExportClone(contentEl, {
      includeAnnotations: false,
      activeAnnotations: [resolvedHighlight('h1')],
      embeddedToc: null,
    });

    expect(clone.querySelector('.markora-annotation')).toBeNull();
    expect(clone.textContent).toBe('before hi after');
  });

  it('keeps annotation marks when includeAnnotations is true', () => {
    const contentEl = document.createElement('main');
    contentEl.innerHTML =
      '<p><mark class="markora-annotation markora-annotation--highlight" ' +
      'data-annotation-id="h1">hi</mark></p>';

    const clone = buildExportClone(contentEl, {
      includeAnnotations: true,
      activeAnnotations: [resolvedHighlight('h1')],
      embeddedToc: null,
    });

    expect(clone.querySelector('.markora-annotation')).not.toBeNull();
  });

  it('prepends the embedded TOC when provided', () => {
    const contentEl = document.createElement('main');
    contentEl.innerHTML = '<h1 id="a">A</h1><p>text</p>';
    const toc = document.createElement('nav');
    toc.className = 'markora-export-toc';

    const clone = buildExportClone(contentEl, {
      includeAnnotations: true,
      activeAnnotations: [],
      embeddedToc: toc,
    });

    expect(clone.firstElementChild?.className).toBe('markora-export-toc');
  });
});
