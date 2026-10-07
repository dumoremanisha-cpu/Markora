import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRenderResult {
  svg: string;
  bindFunctions?: () => void;
}

const state: {
  renderImpl: (id: string, text: string) => Promise<FakeRenderResult>;
  initializeCalls: Array<Record<string, unknown>>;
} = {
  renderImpl: (id, text) =>
    Promise.resolve({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"><text>${text}</text></svg>`,
    }),
  initializeCalls: [],
};

vi.mock('mermaid', () => ({
  default: {
    initialize: (cfg: Record<string, unknown>) => state.initializeCalls.push(cfg),
    render: (id: string, text: string) => state.renderImpl(id, text),
  },
}));

function placeholder(source: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'markora-diagram markora-diagram--mermaid';
  el.dataset.diagramKind = 'mermaid';
  const pre = document.createElement('pre');
  pre.className = 'markora-diagram__source';
  pre.hidden = true;
  pre.textContent = source;
  el.appendChild(pre);
  document.body.appendChild(el);
  return el;
}

describe('renderDiagramsIn (F11, ADR-0002 Mermaid section)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    state.initializeCalls = [];
    state.renderImpl = (id, text) =>
      Promise.resolve({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"><text>${text}</text></svg>`,
      });
  });

  it('hydrates a placeholder with the shared diagram chrome around the rendered SVG', async () => {
    const { renderDiagramsIn } = await import('./index');
    const el = placeholder('graph TD\nA-->B');
    await renderDiagramsIn(document.body, 'light');
    expect(el.dataset.rendered).toBe('true');
    expect(el.querySelector('.markora-diagram-chrome')).not.toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('sanitizes the rendered SVG before insertion (strips a malicious <script>)', async () => {
    const { renderDiagramsIn } = await import('./index');
    state.renderImpl = (id) =>
      Promise.resolve({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"><script>alert(1)</script><rect/></svg>`,
      });
    const el = placeholder('graph TD');
    await renderDiagramsIn(document.body, 'light');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('rect')).not.toBeNull();
  });

  it('shows the standard inline-error notice when Mermaid rejects the source, without breaking the rest of the document', async () => {
    const { renderDiagramsIn } = await import('./index');
    state.renderImpl = () => Promise.reject(new Error('parse error'));
    const el = placeholder('not a real diagram');
    await expect(renderDiagramsIn(document.body, 'light')).resolves.toBeUndefined();
    expect(el.querySelector('.markora-notice--error')).not.toBeNull();
    expect(el.dataset.rendered).toBe('true');
  });

  it('is idempotent — a second call skips already-rendered placeholders', async () => {
    const { renderDiagramsIn } = await import('./index');
    const el = placeholder('graph TD');
    await renderDiagramsIn(document.body, 'light');
    const html = el.innerHTML;
    await renderDiagramsIn(document.body, 'light');
    expect(el.innerHTML).toBe(html);
  });

  it('does nothing when there are no diagram placeholders', async () => {
    const { renderDiagramsIn } = await import('./index');
    await expect(renderDiagramsIn(document.createElement('div'), 'light')).resolves.toBeUndefined();
  });

  it('never invokes bindFunctions from a render result (strict mode: no diagram-sourced interactivity)', async () => {
    const { renderDiagramsIn } = await import('./index');
    const bindFunctions = vi.fn();
    state.renderImpl = (id) =>
      Promise.resolve({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"/>`,
        bindFunctions,
      });
    placeholder('graph TD');
    await renderDiagramsIn(document.body, 'light');
    expect(bindFunctions).not.toHaveBeenCalled();
  });
});

describe('resyncMermaidTheme', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    state.initializeCalls = [];
    state.renderImpl = (id, text) =>
      Promise.resolve({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"><text>${text}</text></svg>`,
      });
    vi.useFakeTimers();
  });

  it('debounces and re-renders already-rendered diagrams with the new theme, without touching the source', async () => {
    const { renderDiagramsIn, resyncMermaidTheme } = await import('./index');
    const el = placeholder('graph TD\nA-->B');
    await renderDiagramsIn(document.body, 'light');

    resyncMermaidTheme(document.body, 'dark');
    await vi.advanceTimersByTimeAsync(300);

    const lastInit = state.initializeCalls[state.initializeCalls.length - 1];
    expect(lastInit).toMatchObject({ theme: 'dark' });
    expect(el.querySelector('svg')).not.toBeNull();

    vi.useRealTimers();
  });

  it('coalesces rapid theme toggles into a single re-render', async () => {
    const { renderDiagramsIn, resyncMermaidTheme } = await import('./index');
    await renderDiagramsIn(document.body, 'light');
    placeholder('graph TD');
    await renderDiagramsIn(document.body, 'light');

    const renderSpy = vi.fn(state.renderImpl);
    state.renderImpl = renderSpy;

    resyncMermaidTheme(document.body, 'dark');
    resyncMermaidTheme(document.body, 'light');
    resyncMermaidTheme(document.body, 'dark');
    await vi.advanceTimersByTimeAsync(300);

    // One re-render pass across however many diagrams are on the page, not
    // one per resyncMermaidTheme call.
    expect(renderSpy.mock.calls.length).toBeGreaterThan(0);
    const lastInit = state.initializeCalls[state.initializeCalls.length - 1];
    expect(lastInit).toMatchObject({ theme: 'dark' });

    vi.useRealTimers();
  });
});
