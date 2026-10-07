// Graphviz adapter (F13; ADR-0002 Graphviz section). Hydrates the
// `.markora-diagram--graphviz` placeholders emitted by
// ../../markdown/plugins/fence.ts once they're in the live DOM. Renders
// fully offline via a bundled WASM build (@hpcc-js/wasm-graphviz) — that
// package embeds its compiled .wasm binary as base64 inside its own JS
// bundle (confirmed by inspecting node_modules/@hpcc-js/wasm-graphviz/dist/
// index.js: it decodes via `atob` + `WebAssembly.instantiate`, no separate
// .wasm asset and no CDN fetch), so importing it here never reaches the
// network — Vite bundles it as an ordinary (if large) JS chunk, matching
// ADR-0002's "must ship inside the extension package" requirement without
// needing a `web_accessible_resources` entry for a `.wasm` file.
import { t } from '../../../i18n';
import { sanitizeDiagramSvg } from '../../sanitization';
import { createDiagramChrome } from '../../../../frontend/components/diagramChrome';
import type { DiagramChromeController } from '../../../../frontend/components/diagramChrome';

interface GraphvizLike {
  layout(dotSource: string, outputFormat?: string, layoutEngine?: string): string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

let graphvizPromise: Promise<GraphvizLike> | null = null;

function loadGraphviz(): Promise<GraphvizLike> {
  graphvizPromise ??= import('@hpcc-js/wasm-graphviz').then((mod) => mod.Graphviz.load());
  return graphvizPromise;
}

function parseSvg(svgMarkup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svgEl = doc.documentElement;
  if (svgEl.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('markora: invalid diagram SVG after sanitization');
  }
  return document.importNode(svgEl, true) as unknown as SVGSVGElement;
}

function buildErrorNotice(): string {
  return (
    `<div class="markora-notice markora-notice--error markora-diagram__error">` +
    `${escapeHtml(t('viewer.diagram.invalid'))}</div>`
  );
}

let renderCounter = 0;
const registry = new WeakMap<HTMLElement, DiagramChromeController>();

function renderOne(container: HTMLElement, graphviz: GraphvizLike, source: string): void {
  renderCounter += 1;
  try {
    const svg = graphviz.layout(source, 'svg', 'dot');
    const svgEl = parseSvg(sanitizeDiagramSvg(svg));
    const chrome = createDiagramChrome(svgEl, { downloadBaseName: `diagram-${renderCounter}` });
    container.replaceChildren(chrome.el);
    registry.set(container, chrome);
  } catch {
    // Invalid DOT source (or a WASM-layer parse failure) — the standard
    // inline-error notice, never a broken/blank document (task 5).
    container.innerHTML = buildErrorNotice();
    container.classList.add('markora-diagram--error');
  }
  container.dataset.rendered = 'true';
}

/**
 * Finds every not-yet-rendered `.markora-diagram--graphviz` placeholder
 * under `root` and hydrates it: lays out via the WASM Graphviz build,
 * sanitizes the resulting SVG, and wraps it in the same shared diagram
 * chrome (fullscreen/zoom/pan/download) Mermaid uses (Phase 3-A) — never a
 * parallel chrome implementation. Idempotent and never throws — an invalid
 * DOT source shows the standard inline-error notice without affecting the
 * rest of the document. The WASM module is only loaded the first time a
 * document actually contains a Graphviz diagram.
 */
export async function renderGraphvizIn(root: ParentNode): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('.markora-diagram--graphviz:not([data-rendered])'),
  );
  if (placeholders.length === 0) return;

  let graphviz: GraphvizLike;
  try {
    graphviz = await loadGraphviz();
  } catch {
    for (const el of placeholders) {
      el.innerHTML = buildErrorNotice();
      el.dataset.rendered = 'true';
    }
    return;
  }

  for (const el of placeholders) {
    const source = el.querySelector('.markora-diagram__source')?.textContent ?? '';
    renderOne(el, graphviz, source);
  }
}
