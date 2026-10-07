// PlantUML adapter (F14; ADR-0002 PlantUML section) — the one opt-in,
// disclosed, off-by-default network-rendering path in the product
// (security-privacy.md §6). This module is the *only* place that ever makes
// a network request for diagram rendering: no other renderer (Mermaid,
// Graphviz, KaTeX) touches the network at all. Hydrates the
// `.markora-diagram--plantuml` placeholders ../../markdown/plugins/fence.ts
// emits for every ```plantuml```/```puml``` fence, regardless of whether
// rendering is enabled — the disabled state is itself a rendered inline
// message, not a fallback to plain code (see fence.ts's comment).
import { t } from '../../../i18n';
import { sanitizeDiagramSvg } from '../../sanitization';
import { createDiagramChrome } from '../../../../frontend/components/diagramChrome';
import { encodePlantumlSource } from './encode';

export interface PlantumlRenderOptions {
  enabled: boolean;
  serverUrl: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function parseSvg(svgMarkup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svgEl = doc.documentElement;
  if (svgEl.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('markora: invalid diagram SVG after sanitization');
  }
  return document.importNode(svgEl, true) as unknown as SVGSVGElement;
}

function buildNotice(kind: 'warning' | 'error', message: string): string {
  return (
    `<div class="markora-notice markora-notice--${kind} markora-diagram__error">` +
    `${escapeHtml(message)}</div>`
  );
}

function buildDisabledNotice(): string {
  return buildNotice('warning', t('viewer.diagram.plantumlDisabled'));
}

function buildUnavailableNotice(): string {
  return buildNotice('error', t('viewer.diagram.plantumlUnavailable'));
}

let renderCounter = 0;

/**
 * Renders one PlantUML diagram by asking the configured server for its SVG.
 * The request body carries nothing — the diagram source is the only input,
 * folded into the URL path via {@link encodePlantumlSource} — and no other
 * header/cookie/document data is attached beyond what the browser's default
 * `fetch` call always sends for same-shape cross-origin GETs.
 */
async function fetchPlantumlSvg(serverUrl: string, source: string): Promise<string> {
  const encoded = await encodePlantumlSource(source);
  const base = serverUrl.replace(/\/+$/, '');
  const response = await fetch(`${base}/svg/${encoded}`);
  if (!response.ok) {
    throw new Error(`markora: PlantUML server responded ${response.status}`);
  }
  return response.text();
}

async function renderOne(container: HTMLElement, source: string, serverUrl: string): Promise<void> {
  renderCounter += 1;
  try {
    const svg = await fetchPlantumlSvg(serverUrl, source);
    const svgEl = parseSvg(sanitizeDiagramSvg(svg));
    const chrome = createDiagramChrome(svgEl, { downloadBaseName: `diagram-${renderCounter}` });
    container.replaceChildren(chrome.el);
  } catch {
    // Covers both an unreachable/erroring server and a malformed SVG
    // response — either way the rest of the document keeps rendering
    // normally (task 8).
    container.innerHTML = buildUnavailableNotice();
    container.classList.add('markora-diagram--error');
  }
  container.dataset.rendered = 'true';
}

/**
 * Finds every not-yet-rendered `.markora-diagram--plantuml` placeholder
 * under `root` and hydrates it. When `options.enabled` is false (the
 * default) this makes **zero** network requests, for any number of
 * placeholders — each just gets the disabled-state notice. Only when
 * explicitly enabled does it fetch each diagram's SVG from
 * `options.serverUrl`, sanitize it through the same DOMPurify pass every
 * other renderer uses, and wrap it in the shared diagram chrome.
 */
export async function renderPlantumlIn(
  root: ParentNode,
  options: PlantumlRenderOptions,
): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('.markora-diagram--plantuml:not([data-rendered])'),
  );
  if (placeholders.length === 0) return;

  if (!options.enabled) {
    for (const el of placeholders) {
      el.innerHTML = buildDisabledNotice();
      el.dataset.rendered = 'true';
    }
    return;
  }

  for (const el of placeholders) {
    const source = el.querySelector('.markora-diagram__source')?.textContent ?? '';
    await renderOne(el, source, options.serverUrl);
  }
}
