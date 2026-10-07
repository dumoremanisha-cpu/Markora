// Mermaid adapter (F11, F79; ADR-0002 Mermaid section). Hydrates the
// `.markora-diagram--mermaid` placeholders emitted by
// ../markdown/plugins/fence.ts and ../markdown/plugins/mermaidContainer.ts
// once they're in the live DOM (mermaid.render() needs a real document, so
// this can't run during markdown-it's synchronous parse pass). Direct-DOM
// rendering with securityLevel: 'strict' per ADR-0002 (rejected 'sandbox'
// iframe mode — it would break the required fullscreen/zoom/pan/download
// chrome). Deliberately never calls the `bindFunctions` a render result can
// return: that's Mermaid's mechanism for wiring node click-interactions
// from diagram source, and strict mode's whole point is that diagram
// source must never run script (security-privacy.md §9) — even inert-
// looking click bindings are propagated diagram content, so it's dropped
// unconditionally rather than trusted.
import { t } from '../../i18n';
import { sanitizeDiagramSvg, withSanitizerUnlockedForThirdParty } from '../sanitization';
import { createDiagramChrome } from '../../../frontend/components/diagramChrome';
import type { DiagramChromeController } from '../../../frontend/components/diagramChrome';

interface MermaidLike {
  initialize(config: Record<string, unknown>): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function mermaidThemeName(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? 'dark' : 'default';
}

/**
 * Mermaid's default label renderer puts label *text* inside
 * `<foreignObject><div>...</div></foreignObject>` (it needs real HTML for
 * text wrapping). `sanitizeDiagramSvg` forbids `<foreignObject>` outright
 * (ADR-0002 — it's an SVG/HTML-injection vector, and that restriction isn't
 * negotiable per renderer). Sanitizing first and only then discovering every
 * node rendered as a solid, unlabeled shape isn't a color/theme bug — the
 * text was stripped along with the tag carrying it. Setting `htmlLabels`
 * false makes Mermaid emit plain SVG `<text>` for labels instead, so
 * there's nothing for the sanitizer to strip and no security trade-off
 * either way. Root-level, not nested under `flowchart:` — mermaid.d.ts
 * (`config.type.d.ts`) documents `flowchart.htmlLabels` as deprecated in
 * favor of this root key, and in v11.17 it's more than deprecated: node
 * labels specifically (`labelHelper`, used by every non-edge label) only
 * ever reads the root key, so the nested one silently did nothing at all.
 */
const HTML_LABELS_CONFIG = { htmlLabels: false };

let mermaidPromise: Promise<MermaidLike> | null = null;
let currentThemeMode: 'light' | 'dark' = 'light';

function loadMermaid(): Promise<MermaidLike> {
  mermaidPromise ??= import('mermaid').then((mod) => {
    const mermaid =
      (mod as unknown as { default?: MermaidLike }).default ?? (mod as unknown as MermaidLike);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: mermaidThemeName(currentThemeMode),
      ...HTML_LABELS_CONFIG,
    });
    return mermaid;
  });
  return mermaidPromise;
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
const registry = new WeakMap<HTMLElement, { source: string; chrome: DiagramChromeController }>();

async function renderOne(
  container: HTMLElement,
  mermaid: MermaidLike,
  source: string,
): Promise<void> {
  renderCounter += 1;
  try {
    const { svg } = await withSanitizerUnlockedForThirdParty(() =>
      mermaid.render(`markora-mermaid-${renderCounter}`, source),
    );
    const svgEl = parseSvg(sanitizeDiagramSvg(svg));
    const chrome = createDiagramChrome(svgEl, { downloadBaseName: `diagram-${renderCounter}` });
    container.replaceChildren(chrome.el);
    registry.set(container, { source, chrome });
  } catch {
    container.innerHTML = buildErrorNotice();
    container.classList.add('markora-diagram--error');
  }
  container.dataset.rendered = 'true';
}

/**
 * Finds every not-yet-rendered `.markora-diagram--mermaid` placeholder
 * under `root` and hydrates it: renders via Mermaid, sanitizes the output
 * SVG, and wraps it in the shared diagram chrome. Idempotent (already-
 * rendered placeholders are skipped) and never throws — an invalid diagram
 * shows the standard inline-error notice without affecting the rest of the
 * document. Mermaid's JS is only loaded the first time a document actually
 * contains a diagram (task 7: deferred, not on the critical path otherwise).
 * `themeMode` primes the very first Mermaid initialization (later theme
 * changes go through {@link resyncMermaidTheme} instead) — passed in rather
 * than read from module state so the caller doesn't need a separate,
 * ordering-sensitive "prime the theme before first render" step.
 */
export async function renderDiagramsIn(
  root: ParentNode,
  themeMode: 'light' | 'dark',
): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('.markora-diagram--mermaid:not([data-rendered])'),
  );
  if (placeholders.length === 0) return;

  currentThemeMode = themeMode;
  let mermaid: MermaidLike;
  try {
    mermaid = await loadMermaid();
  } catch {
    for (const el of placeholders) {
      el.innerHTML = buildErrorNotice();
      el.dataset.rendered = 'true';
    }
    return;
  }
  // loadMermaid()'s own initialize() call only ever runs once (the promise
  // is memoized) — re-applying the theme here too keeps a *newly loaded*
  // document's diagrams correct even if the theme changed since the first
  // document's diagrams were rendered.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: mermaidThemeName(themeMode),
    ...HTML_LABELS_CONFIG,
  });

  for (const el of placeholders) {
    const source = el.querySelector('.markora-diagram__source')?.textContent ?? '';
    await renderOne(el, mermaid, source);
  }
}

let resyncTimer: number | undefined;
const RESYNC_DEBOUNCE_MS = 250;

async function reRenderAllForTheme(root: ParentNode, mode: 'light' | 'dark'): Promise<void> {
  // Nothing has rendered (and so never loaded Mermaid) yet — the next
  // renderDiagramsIn call already picks up currentThemeMode, set below.
  if (!mermaidPromise) return;
  const mermaid = await mermaidPromise;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: mermaidThemeName(mode),
    ...HTML_LABELS_CONFIG,
  });

  const containers = Array.from(
    root.querySelectorAll<HTMLElement>('.markora-diagram--mermaid[data-rendered="true"]'),
  );
  for (const container of containers) {
    const entry = registry.get(container);
    if (!entry) continue;
    renderCounter += 1;
    try {
      const { svg } = await withSanitizerUnlockedForThirdParty(() =>
        mermaid.render(`markora-mermaid-${renderCounter}`, entry.source),
      );
      entry.chrome.setContent(parseSvg(sanitizeDiagramSvg(svg)));
    } catch {
      // A previously-valid diagram failing to re-render on a theme change
      // (the source itself hasn't changed) is treated as a transient miss —
      // keep the last good rendering on screen instead of flashing an error.
    }
  }
}

/**
 * Re-renders (not just re-colors — Mermaid bakes its theme into the
 * generated SVG at render time) every already-rendered diagram under `root`
 * to match `mode`, debounced against rapid theme toggles (ADR-0002).
 */
export function resyncMermaidTheme(root: ParentNode, mode: 'light' | 'dark'): void {
  currentThemeMode = mode;
  window.clearTimeout(resyncTimer);
  resyncTimer = window.setTimeout(() => void reRenderAllForTheme(root, mode), RESYNC_DEBOUNCE_MS);
}
