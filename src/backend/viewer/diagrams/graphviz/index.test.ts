import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  layoutImpl: (dotSource: string, outputFormat?: string, layoutEngine?: string) => string;
  loadCalls: number;
} = {
  layoutImpl: (dotSource) =>
    `<svg xmlns="http://www.w3.org/2000/svg"><text>${dotSource}</text></svg>`,
  loadCalls: 0,
};

vi.mock('@hpcc-js/wasm-graphviz', () => ({
  Graphviz: {
    load: () => {
      state.loadCalls += 1;
      return Promise.resolve({
        layout: (dotSource: string, outputFormat?: string, layoutEngine?: string) =>
          state.layoutImpl(dotSource, outputFormat, layoutEngine),
      });
    },
  },
}));

function placeholder(source: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'markora-diagram markora-diagram--graphviz';
  el.dataset.diagramKind = 'graphviz';
  const pre = document.createElement('pre');
  pre.className = 'markora-diagram__source';
  pre.hidden = true;
  pre.textContent = source;
  el.appendChild(pre);
  document.body.appendChild(el);
  return el;
}

describe('renderGraphvizIn (F13, ADR-0002 Graphviz section)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    state.loadCalls = 0;
    state.layoutImpl = (dotSource) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><text>${dotSource}</text></svg>`;
    vi.resetModules();
  });

  it('hydrates a placeholder with the shared diagram chrome around the rendered SVG', async () => {
    const { renderGraphvizIn } = await import('./index');
    const el = placeholder('digraph G { a -> b }');
    await renderGraphvizIn(document.body);
    expect(el.dataset.rendered).toBe('true');
    expect(el.querySelector('.markora-diagram-chrome')).not.toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('sanitizes the rendered SVG before insertion (strips a malicious <script>)', async () => {
    const { renderGraphvizIn } = await import('./index');
    state.layoutImpl = () =>
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>';
    const el = placeholder('digraph G { a -> b }');
    await renderGraphvizIn(document.body);
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('rect')).not.toBeNull();
  });

  it('shows the standard inline-error notice when Graphviz rejects the source, without breaking the rest of the document', async () => {
    const { renderGraphvizIn } = await import('./index');
    state.layoutImpl = () => {
      throw new Error('syntax error in line 1');
    };
    const el = placeholder('not valid dot {{{');
    await expect(renderGraphvizIn(document.body)).resolves.toBeUndefined();
    expect(el.querySelector('.markora-notice--error')).not.toBeNull();
    expect(el.dataset.rendered).toBe('true');
  });

  it('is idempotent — a second call skips already-rendered placeholders', async () => {
    const { renderGraphvizIn } = await import('./index');
    const el = placeholder('digraph G { a -> b }');
    await renderGraphvizIn(document.body);
    const html = el.innerHTML;
    await renderGraphvizIn(document.body);
    expect(el.innerHTML).toBe(html);
  });

  it('does nothing when there are no diagram placeholders (loads no WASM module)', async () => {
    const { renderGraphvizIn } = await import('./index');
    await expect(renderGraphvizIn(document.createElement('div'))).resolves.toBeUndefined();
    expect(state.loadCalls).toBe(0);
  });

  it('uses the dot layout engine and svg output format', async () => {
    const { renderGraphvizIn } = await import('./index');
    const layoutSpy = vi.fn(state.layoutImpl);
    state.layoutImpl = layoutSpy;
    placeholder('digraph G { a -> b }');
    await renderGraphvizIn(document.body);
    expect(layoutSpy).toHaveBeenCalledWith('digraph G { a -> b }', 'svg', 'dot');
  });
});
