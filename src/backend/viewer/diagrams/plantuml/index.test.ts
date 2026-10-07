import { beforeEach, describe, expect, it, vi } from 'vitest';

function placeholder(source: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'markora-diagram markora-diagram--plantuml';
  el.dataset.diagramKind = 'plantuml';
  const pre = document.createElement('pre');
  pre.className = 'markora-diagram__source';
  pre.hidden = true;
  pre.textContent = source;
  el.appendChild(pre);
  document.body.appendChild(el);
  return el;
}

describe('renderPlantumlIn (F14, ADR-0002 PlantUML section)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('makes zero network requests and shows a disabled notice when disabled (the default)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { renderPlantumlIn } = await import('./index');
    const el = placeholder('@startuml\nA -> B\n@enduml');
    await renderPlantumlIn(document.body, {
      enabled: false,
      serverUrl: 'https://plantuml.example',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(el.dataset.rendered).toBe('true');
    expect(el.querySelector('.markora-notice--warning')).not.toBeNull();
  });

  it('does nothing (and makes no request) when there are no diagram placeholders', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { renderPlantumlIn } = await import('./index');
    await renderPlantumlIn(document.createElement('div'), {
      enabled: true,
      serverUrl: 'https://plantuml.example',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches the encoded diagram source from the configured server and renders the returned SVG', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      }),
    );
    const { renderPlantumlIn } = await import('./index');
    const el = placeholder('@startuml\nA -> B\n@enduml');
    await renderPlantumlIn(document.body, {
      enabled: true,
      serverUrl: 'https://plantuml.example/plantuml',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toMatch(/^https:\/\/plantuml\.example\/plantuml\/svg\/[0-9A-Za-z_-]+$/);
    expect(el.dataset.rendered).toBe('true');
    expect(el.querySelector('.markora-diagram-chrome')).not.toBeNull();
    expect(el.querySelector('svg rect')).not.toBeNull();
  });

  it('strips a trailing slash on the configured server URL rather than double-slashing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { status: 200 }),
      );
    const { renderPlantumlIn } = await import('./index');
    placeholder('@startuml\nA -> B\n@enduml');
    await renderPlantumlIn(document.body, {
      enabled: true,
      serverUrl: 'https://plantuml.example/plantuml/',
    });
    const requestedUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(requestedUrl).not.toContain('//svg/');
  });

  it('sanitizes the rendered SVG before insertion (strips a malicious <script>)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
        { status: 200 },
      ),
    );
    const { renderPlantumlIn } = await import('./index');
    const el = placeholder('@startuml\nA -> B\n@enduml');
    await renderPlantumlIn(document.body, {
      enabled: true,
      serverUrl: 'https://plantuml.example',
    });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('rect')).not.toBeNull();
  });

  it('shows an unavailable notice, without breaking the rest of the document, when the server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 502 }));
    const { renderPlantumlIn } = await import('./index');
    const el = placeholder('@startuml\nA -> B\n@enduml');
    await expect(
      renderPlantumlIn(document.body, { enabled: true, serverUrl: 'https://plantuml.example' }),
    ).resolves.toBeUndefined();
    expect(el.querySelector('.markora-notice--error')).not.toBeNull();
    expect(el.dataset.rendered).toBe('true');
  });

  it('shows an unavailable notice when the network request itself throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const { renderPlantumlIn } = await import('./index');
    const el = placeholder('@startuml\nA -> B\n@enduml');
    await renderPlantumlIn(document.body, { enabled: true, serverUrl: 'https://plantuml.example' });
    expect(el.querySelector('.markora-notice--error')).not.toBeNull();
  });

  it('is idempotent — a second call skips already-rendered placeholders', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { status: 200 }),
      );
    const { renderPlantumlIn } = await import('./index');
    placeholder('@startuml\nA -> B\n@enduml');
    const opts = { enabled: true, serverUrl: 'https://plantuml.example' };
    await renderPlantumlIn(document.body, opts);
    await renderPlantumlIn(document.body, opts);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
