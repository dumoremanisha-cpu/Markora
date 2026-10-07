import { describe, expect, it } from 'vitest';
import { renderMathIn } from './index';

function placeholder(source: string, display = false): HTMLElement {
  const el = document.createElement(display ? 'div' : 'span');
  el.className = 'markora-math';
  el.dataset.display = String(display);
  el.textContent = source;
  document.body.appendChild(el);
  return el;
}

describe('renderMathIn (F12, ADR-0002 KaTeX section)', () => {
  it('renders valid inline LaTeX to KaTeX markup', async () => {
    const el = placeholder('E = mc^2');
    await renderMathIn(document.body);
    expect(el.querySelector('.katex')).not.toBeNull();
    expect(el.dataset.rendered).toBe('true');
  });

  it('renders valid display-mode LaTeX', async () => {
    const el = placeholder('x = y + z', true);
    await renderMathIn(document.body);
    expect(el.querySelector('.katex-display')).not.toBeNull();
  });

  it('shows the standard inline-error notice for invalid LaTeX, not KaTeX raw error markup', async () => {
    const el = placeholder('\\frac{1}');
    await renderMathIn(document.body);
    expect(el.querySelector('.markora-notice--error')).not.toBeNull();
    expect(el.querySelector('.katex-error')).toBeNull();
    expect(el.dataset.rendered).toBe('true');
  });

  it('is idempotent — a second call skips already-rendered placeholders', async () => {
    const el = placeholder('a + b');
    await renderMathIn(document.body);
    const firstHtml = el.innerHTML;
    await renderMathIn(document.body);
    expect(el.innerHTML).toBe(firstHtml);
  });

  it('preserves the inline style KaTeX needs for glyph positioning after sanitization', async () => {
    const el = placeholder('\\sqrt{2}');
    await renderMathIn(document.body);
    expect(el.querySelector('[style]')).not.toBeNull();
  });

  it('does nothing when there are no math placeholders', async () => {
    await expect(renderMathIn(document.createElement('div'))).resolves.toBeUndefined();
  });
});
