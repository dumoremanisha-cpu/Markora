// Fenced code blocks (F10): syntax highlighting, per-block language label,
// copy button, optional line numbers, optional line wrap. Overrides the
// `fence` renderer rule entirely (rather than passing markdown-it's
// `highlight` constructor option) so the highlighted code can be wrapped in
// a toolbar + gutter structure markdown-it's own fence renderer has no way
// to produce.
import type { MarkdownIt } from 'markdown-it';
import { t } from '../../../i18n';
import { escapeHtml, highlightCode, languageLabel } from '../../syntax/highlight';
import { buildDiagramPlaceholder } from './diagramPlaceholder';

export interface FenceOptions {
  lineNumbers: boolean;
  lineWrap: boolean;
  /** F11/F79 — when false, ```mermaid``` fences fall back to a plain highlighted code block instead of a diagram placeholder. */
  mermaidDiagrams: boolean;
  /** F13 — when false, ```dot```/```graphviz``` fences fall back to a plain highlighted code block instead of a diagram placeholder. */
  graphvizDiagrams: boolean;
}

function buildGutter(lineCount: number): string {
  let spans = '';
  for (let i = 1; i <= lineCount; i++) spans += `<span>${i}</span>`;
  return `<div class="markora-code-block__gutter" aria-hidden="true">${spans}</div>`;
}

export function registerFence(md: MarkdownIt, options: FenceOptions): void {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    if (!token) return '';
    const info = token.info.trim();
    const lang = info.split(/\s+/)[0] ?? '';
    const code = token.content.replace(/\n$/, '');

    const langLower = lang.toLowerCase();
    if (options.mermaidDiagrams && langLower === 'mermaid') {
      return buildDiagramPlaceholder('mermaid', code);
    }
    if (options.graphvizDiagrams && (langLower === 'dot' || langLower === 'graphviz')) {
      return buildDiagramPlaceholder('graphviz', code);
    }
    // PlantUML fences are always recognized as a diagram placeholder,
    // regardless of the `plantumlEnabled` network opt-in (ADR-0002) — unlike
    // Mermaid/Graphviz, "off" is itself a rendered state (a disclosed inline
    // message telling the reader how to enable it), not a fallback to a
    // plain code block, so there's no parse-time toggle to gate on here.
    if (langLower === 'plantuml' || langLower === 'puml') {
      return buildDiagramPlaceholder('plantuml', code);
    }

    const { html, languageKey } = highlightCode(code, lang || undefined);
    const label = languageKey ? languageLabel(languageKey) : t('viewer.code.plainText');
    const lineCount = code.length === 0 ? 1 : code.split('\n').length;

    const wrapClass = options.lineWrap ? ' markora-code-block--wrap' : '';
    const numbersClass = options.lineNumbers ? ' markora-code-block--numbered' : '';
    const codeClass = languageKey ? `hljs language-${escapeHtml(languageKey)}` : 'hljs';
    const pre = `<pre class="hljs markora-code-block__pre"><code class="${codeClass}">${html}</code></pre>`;
    // The gutter-flex wrapper is only needed when there's a gutter to lay
    // out beside the code — skipping it in the (default) no-line-numbers
    // case saves a DOM node per code block, which matters at the
    // hundreds-of-code-blocks scale the P1/P2 performance budgets measure
    // against (docs/specs/06-testing-quality-gate.md §1a).
    const body = options.lineNumbers
      ? `<div class="markora-code-block__body">${buildGutter(lineCount)}${pre}</div>`
      : pre;

    return (
      `<div class="markora-code-block${wrapClass}${numbersClass}" data-language="${escapeHtml(languageKey ?? '')}">` +
      `<div class="markora-code-block__toolbar">` +
      `<span class="markora-code-block__lang">${escapeHtml(label)}</span>` +
      `<button type="button" class="markora-code-block__copy-btn">${escapeHtml(t('viewer.code.copy'))}</button>` +
      `</div>` +
      body +
      `</div>\n`
    );
  };
}
