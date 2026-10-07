import { describe, expect, it } from 'vitest';
import { buildEmbeddedToc } from './toc';

describe('buildEmbeddedToc', () => {
  it('returns null when the document has no id-bearing headings', () => {
    const root = document.createElement('main');
    root.innerHTML = '<p>no headings</p>';
    expect(buildEmbeddedToc(root)).toBeNull();
  });

  it('builds a nested list of links matching the heading hierarchy', () => {
    const root = document.createElement('main');
    root.innerHTML = '<h1 id="a">Alpha</h1><h2 id="b">Beta</h2><p>text</p><h1 id="c">Gamma</h1>';

    const toc = buildEmbeddedToc(root)!;
    expect(toc.className).toBe('markora-export-toc');
    const topList = toc.querySelector('ol')!;
    const topItems = Array.from(topList.children);
    expect(topItems.map((li) => li.querySelector('a')!.textContent)).toEqual(['Alpha', 'Gamma']);
    // topItems[0].querySelector('ol') is unambiguous: Alpha's <li> has
    // exactly one descendant <ol> (its nested list), so there's no need
    // for a combinator chain here — which would be ambiguous anyway, since
    // an unscoped `element.querySelector('ol > li > a')` also matches
    // Alpha's own <a> (its own <li>'s parent is the outer <ol>).
    const nestedLink = topItems[0]!.querySelector('ol')!.querySelector('li > a')!;
    expect(nestedLink.textContent).toBe('Beta');
    expect(nestedLink.getAttribute('href')).toBe('#b');
  });
});
