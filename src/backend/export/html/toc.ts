// F30's optional embedded-TOC setting — a static `<nav>` built the same way
// as the live sidebar TOC (`src/components/toc/tree.ts`'s heading-nesting
// logic, reused rather than reimplemented), but rendered as plain anchor
// links since the exported file has no JS to drive an IntersectionObserver
// or active-heading highlighting.
import { t } from '../../i18n';
import { buildTocTree } from '../../../frontend/components/toc/tree';
import type { HeadingInfo, TocNode } from '../../../frontend/components/toc/tree';

function readHeadings(root: Element): HeadingInfo[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
  ).map((el) => ({
    id: el.id,
    level: Number(el.tagName.slice(1)),
    text: el.textContent ?? '',
  }));
}

function renderList(nodes: TocNode[]): HTMLOListElement {
  const list = document.createElement('ol');
  for (const node of nodes) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${node.id}`;
    link.textContent = node.text || t('toc.untitledHeading');
    item.appendChild(link);
    if (node.children.length > 0) item.appendChild(renderList(node.children));
    list.appendChild(item);
  }
  return list;
}

/** Returns `null` when the document has no headings — the caller skips embedding an empty TOC rather than exporting an empty nav. */
export function buildEmbeddedToc(root: Element): HTMLElement | null {
  const tree = buildTocTree(readHeadings(root));
  if (tree.length === 0) return null;

  const nav = document.createElement('nav');
  nav.className = 'markora-export-toc';
  const heading = document.createElement('h2');
  heading.textContent = t('toc.title');
  nav.append(heading, renderList(tree));
  return nav;
}
