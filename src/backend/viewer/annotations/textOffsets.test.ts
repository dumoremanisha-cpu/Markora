import { describe, expect, it } from 'vitest';
import { getPlainText, plainTextOffsetsToRange, rangeToPlainTextOffsets } from './textOffsets';

function buildRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('rangeToPlainTextOffsets / plainTextOffsetsToRange round-trip', () => {
  it('maps a selection within a single text node', () => {
    const root = buildRoot('<p>The quick brown fox jumps over the lazy dog</p>');
    const textNode = root.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 19); // "quick brown fox"

    const { start, end } = rangeToPlainTextOffsets(root, range);
    expect(getPlainText(root).slice(start, end)).toBe('quick brown fox');

    const rebuilt = plainTextOffsetsToRange(root, start, end);
    expect(rebuilt?.toString()).toBe('quick brown fox');
  });

  it('maps a selection spanning multiple inline elements (e.g. across a <strong>)', () => {
    const root = buildRoot('<p>The <strong>quick brown</strong> fox jumps</p>');
    const plain = getPlainText(root);
    expect(plain).toBe('The quick brown fox jumps');

    const start = plain.indexOf('quick');
    const end = plain.indexOf('jumps') + 'jumps'.length;
    const range = plainTextOffsetsToRange(root, start, end);
    expect(range?.toString()).toBe('quick brown fox jumps');
  });

  it('returns null for offsets beyond the current content', () => {
    const root = buildRoot('<p>short</p>');
    expect(plainTextOffsetsToRange(root, 100, 200)).toBeNull();
  });
});
