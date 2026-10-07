// Maps between a DOM Range/Selection and character offsets into a rendered
// element's plain-text content (`root.textContent`) — the coordinate space
// ADR-0003's anchor data (charOffsetAtCreation, prefix/suffix) is stored in.
// Deliberately not DOM-Range/offset-path anchoring (ADR-0003 "Alternatives
// considered": the rendered DOM is regenerated on every reload, so offset
// paths into it don't survive that the way a plain-text character offset
// does).

/** The plain-text content a document's annotations are anchored against. */
export function getPlainText(root: HTMLElement): string {
  return root.textContent ?? '';
}

/** Maps a DOM Range within `root` to [start, end) character offsets in `root.textContent`. */
export function rangeToPlainTextOffsets(
  root: HTMLElement,
  range: Range,
): { start: number; end: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let start = -1;
  let end = -1;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (start === -1 && node === range.startContainer) start = offset + range.startOffset;
    if (node === range.endContainer) end = offset + range.endOffset;
    offset += length;
    if (start !== -1 && end !== -1) break;
  }
  if (start === -1) start = 0;
  if (end === -1) end = start;
  return { start, end };
}

export interface HeadingAnchor {
  id: string;
  text: string;
}

/**
 * Finds the heading whose section an annotation at `charOffset` falls under
 * — the last `h1`-`h6` (with an id — see `plugins/anchors.ts`) at or before
 * that offset in `root`'s plain text. Powers the annotations panel's
 * `new_ui/annotations.png`-style "anchor: #section" line. Returns null for
 * an annotation before the document's first heading (nothing to anchor to).
 */
export function findNearestHeadingAnchor(
  root: HTMLElement,
  charOffset: number,
): HeadingAnchor | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
  let offset = 0;
  let nearest: HeadingAnchor | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    if (/^H[1-6]$/.test(el.tagName) && el.id) {
      if (offset > charOffset) break;
      nearest = { id: el.id, text: el.textContent?.trim() ?? '' };
    }
  }
  return nearest;
}

/** Reverse mapping: builds a Range spanning [start, end) of `root.textContent`, or null if the offsets fall outside the current content (e.g. a stale/orphaned annotation). */
export function plainTextOffsetsToRange(
  root: HTMLElement,
  start: number,
  end: number,
): Range | null {
  if (start < 0 || end < start) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const length = text.length;
    if (startNode === null && start >= offset && start <= offset + length) {
      startNode = text;
      startNodeOffset = start - offset;
    }
    if (end >= offset && end <= offset + length) {
      endNode = text;
      endNodeOffset = end - offset;
    }
    offset += length;
    if (startNode && endNode) break;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}
