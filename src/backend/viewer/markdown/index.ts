// Parse stage: markdown-it extended with GFM plugins, custom containers,
// GitHub-style alerts, front matter, safe MDX handling, syntax highlighting,
// heading anchors, external-link treatment, and sticky tables (Phase 2-A).
// parse -> sanitize -> enhance stays separable (code-conventions.md §4):
// this module does parse + sanitize; DOM wiring (copy buttons, theme
// loading) is the caller's enhance-stage responsibility.
import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import deflist from 'markdown-it-deflist';
import { t } from '../../i18n';
import { DEFAULT_MARKDOWN_FEATURE_TOGGLES } from '../../storage/schema';
import type { MarkdownFeatureToggles } from '../../storage/schema';
import { sanitizeHtml } from '../sanitization';
import { extractFrontMatter, renderFrontMatterCard } from './frontMatter';
import { transformMdx } from './mdx';
import { registerAlerts } from './plugins/alerts';
import { registerAnchors } from './plugins/anchors';
import { registerBlockRemoteImages } from './plugins/blockRemoteImages';
import { registerContainers } from './plugins/containers';
import { registerExternalLinks } from './plugins/externalLinks';
import { registerFence } from './plugins/fence';
import { registerMath } from './plugins/math';
import { registerMermaidContainer } from './plugins/mermaidContainer';
import { registerRtlAuto } from './plugins/rtlAuto';
import { registerStickyTables } from './plugins/stickyTables';

export { isMdxSource } from './mdx';

export interface RenderMarkdownOptions {
  /** ADR-0008 §2 trigger scope: file extension only in this phase. */
  isMdx?: boolean;
  features?: Partial<MarkdownFeatureToggles>;
  codeLineNumbers?: boolean;
  codeLineWrap?: boolean;
  alertTitleMode?: 'localized' | 'literal';
  externalLinkIndicator?: boolean;
  /** security-privacy.md §1 point 4 — see plugins/blockRemoteImages.ts. */
  blockRemoteImages?: boolean;
}

interface ResolvedOptions {
  features: MarkdownFeatureToggles;
  isMdx: boolean;
  alertTitleMode: 'localized' | 'literal';
  externalLinkIndicator: boolean;
  codeLineNumbers: boolean;
  codeLineWrap: boolean;
  blockRemoteImages: boolean;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  isMdx: false,
  features: DEFAULT_MARKDOWN_FEATURE_TOGGLES,
  codeLineNumbers: false,
  codeLineWrap: false,
  alertTitleMode: 'localized',
  externalLinkIndicator: true,
  blockRemoteImages: false,
};

function resolveOptions(options: RenderMarkdownOptions): ResolvedOptions {
  return {
    features: { ...DEFAULT_OPTIONS.features, ...options.features },
    isMdx: options.isMdx ?? DEFAULT_OPTIONS.isMdx,
    alertTitleMode: options.alertTitleMode ?? DEFAULT_OPTIONS.alertTitleMode,
    externalLinkIndicator: options.externalLinkIndicator ?? DEFAULT_OPTIONS.externalLinkIndicator,
    codeLineNumbers: options.codeLineNumbers ?? DEFAULT_OPTIONS.codeLineNumbers,
    codeLineWrap: options.codeLineWrap ?? DEFAULT_OPTIONS.codeLineWrap,
    blockRemoteImages: options.blockRemoteImages ?? DEFAULT_OPTIONS.blockRemoteImages,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function buildPipeline(features: MarkdownFeatureToggles) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: features.lineBreaks,
    typographer: features.typographer,
  });

  if (!features.tables) md.disable('table');
  if (features.footnotes) md.use(footnote);
  if (features.taskLists) md.use(taskLists, { label: true });
  if (features.definitionLists) md.use(deflist);
  if (features.containers) registerContainers(md);
  if (features.mermaidDiagrams) registerMermaidContainer(md);
  if (features.math) registerMath(md);

  return md;
}

/** Builds a markdown-it instance with every Phase 2-A/3-A/3-B renderer-level feature registered (F60, F44, F25/F72, F26, F10, F11/F79, F12, F13, F14). */
function configurePipeline(features: MarkdownFeatureToggles, options: ResolvedOptions) {
  const md = buildPipeline(features);
  registerAnchors(md);
  registerRtlAuto(md);
  registerAlerts(md, { titleMode: options.alertTitleMode });
  registerExternalLinks(md, { showIndicator: options.externalLinkIndicator });
  registerStickyTables(md);
  if (options.blockRemoteImages) registerBlockRemoteImages(md);
  registerFence(md, {
    lineNumbers: options.codeLineNumbers,
    lineWrap: options.codeLineWrap,
    mermaidDiagrams: features.mermaidDiagrams,
    graphvizDiagrams: features.graphvizDiagrams,
  });
  return md;
}

/** Renders MDX source as a fenced code block with an inline notice (ADR-0008 §4 failure behaviour). */
function renderMdxFallback(source: string): string {
  return (
    `<div class="markora-notice markora-notice--warning">${escapeHtml(t('markdown.mdx.transformFailed'))}</div>` +
    `<pre><code>${escapeHtml(source)}</code></pre>`
  );
}

interface PreparedDocument {
  frontMatterCard: string;
  bodyKind: 'markdown' | 'fallback';
  bodyMarkdown: string;
  fallbackHtml: string;
}

/** Front matter extraction + (when requested) the MDX pre-pass — shared by the synchronous and streaming render entry points. */
function prepareDocument(
  source: string,
  features: MarkdownFeatureToggles,
  isMdx: boolean,
): PreparedDocument {
  const { data: frontMatterData, body: afterFrontMatter } = features.frontMatter
    ? extractFrontMatter(source)
    : { data: null, body: source };
  const frontMatterCard = frontMatterData ? renderFrontMatterCard(frontMatterData) : '';

  if (!isMdx) {
    return {
      frontMatterCard,
      bodyKind: 'markdown',
      bodyMarkdown: afterFrontMatter,
      fallbackHtml: '',
    };
  }
  try {
    const transformed = transformMdx(afterFrontMatter);
    return { frontMatterCard, bodyKind: 'markdown', bodyMarkdown: transformed, fallbackHtml: '' };
  } catch {
    return {
      frontMatterCard,
      bodyKind: 'fallback',
      bodyMarkdown: '',
      fallbackHtml: renderMdxFallback(source),
    };
  }
}

/**
 * Renders raw Markdown (or, when `options.isMdx` is set, MDX) source to
 * sanitized HTML. Never throws on malformed input — markdown-it's own parser
 * is resilient by design, but this wraps the whole pipeline defensively
 * (functional requirements §2, §40) so one bad document can't blank the
 * viewer.
 */
export function renderMarkdown(
  source: string,
  options: RenderMarkdownOptions = {},
): { html: string; malformed: boolean } {
  const resolved = resolveOptions(options);
  try {
    const prepared = prepareDocument(source, resolved.features, resolved.isMdx);
    const bodyHtml =
      prepared.bodyKind === 'fallback'
        ? prepared.fallbackHtml
        : configurePipeline(resolved.features, resolved).render(prepared.bodyMarkdown);
    return { html: sanitizeHtml(prepared.frontMatterCard + bodyHtml), malformed: false };
  } catch {
    const escaped = escapeHtml(source);
    return { html: `<pre>${escaped}</pre>`, malformed: true };
  }
}

export interface ParsedMarkdownTokens {
  /** Empty when `bodyKind === 'fallback'` (MDX transform failed) — nothing structured to walk. */
  tokens: Token[];
  malformed: boolean;
}

/**
 * Returns the same markdown-it token stream {@link renderMarkdown} renders
 * from — front matter already stripped, every Phase 2-A/3-A/3-B parser-level
 * rule (footnotes, task lists, alerts' marker-stripping, math placeholders,
 * mermaid containers, ...) already applied — for consumers that walk tokens
 * directly instead of taking rendered HTML (DOCX export, Phase 7-B:
 * ADR-0005 walks "the same markdown-it token stream used for rendering, not
 * the DOM"). Never sanitizes or touches the DOM; parse-stage output only
 * (code-conventions.md §4 — parse/sanitize/enhance stay separable).
 */
export function parseMarkdownTokens(
  source: string,
  options: RenderMarkdownOptions = {},
): ParsedMarkdownTokens {
  const resolved = resolveOptions(options);
  try {
    const prepared = prepareDocument(source, resolved.features, resolved.isMdx);
    if (prepared.bodyKind === 'fallback') return { tokens: [], malformed: false };
    const md = configurePipeline(resolved.features, resolved);
    return { tokens: md.parse(prepared.bodyMarkdown, {}), malformed: false };
  } catch {
    return { tokens: [], malformed: true };
  }
}

// A macrotask yield (`setTimeout`), not `requestAnimationFrame` — rAF is
// throttled to the display's refresh rate (~16.7ms at 60Hz) *per call*,
// which dominated total render time once there were dozens of chunks (a
// first version of this measured ~1s of pure rAF-wait overhead rendering
// the 1MB performance fixture — worse than not chunking at all).
// `setTimeout(0)` still creates a genuine task-queue boundary (so the
// browser can paint or handle input between chunks, and the Long Tasks API
// sees separate tasks), just without waiting for a paint.
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Bounds how much work (and how much HTML DOMPurify sanitizes) happens in a
// single synchronous slice, so no one rendering task blows past the P4
// budget (docs/specs/06-testing-quality-gate.md §1a: "no load task > 500ms")
// on a large document, while keeping the chunk *count* — and therefore the
// total yield overhead — low enough not to blow the P1/P2 total-time
// budgets. Chunking happens strictly after `md.parse()` — which already ran
// every core rule (anchors, alerts, external links) exactly once over the
// whole token stream — so ids/numbering/dedup are identical to the
// non-streaming path regardless of how the resulting tokens are batched for
// rendering.
const STREAM_CHUNK_BLOCK_COUNT = 300;

/**
 * Same rendering pipeline as {@link renderMarkdown}, but yields the result
 * through `onChunk` in bounded pieces instead of one synchronous pass, and
 * yields control back to the browser between chunks. Used by the viewer for
 * every document load; `renderMarkdown` stays synchronous for callers (and
 * tests) that don't need progressive/chunked output.
 */
export async function renderMarkdownStreaming(
  source: string,
  options: RenderMarkdownOptions,
  onChunk: (html: string) => void,
): Promise<{ malformed: boolean }> {
  const resolved = resolveOptions(options);
  try {
    const prepared = prepareDocument(source, resolved.features, resolved.isMdx);
    if (prepared.frontMatterCard) onChunk(sanitizeHtml(prepared.frontMatterCard));

    if (prepared.bodyKind === 'fallback') {
      onChunk(sanitizeHtml(prepared.fallbackHtml));
      return { malformed: false };
    }

    const md = configurePipeline(resolved.features, resolved);
    const env = {};
    const tokens = md.parse(prepared.bodyMarkdown, env);

    let pending: Token[] = [];
    let depth = 0;
    let blockCount = 0;
    for (const token of tokens) {
      pending.push(token);
      depth += token.nesting;
      if (depth !== 0) continue;
      blockCount++;
      if (blockCount < STREAM_CHUNK_BLOCK_COUNT) continue;
      onChunk(sanitizeHtml(md.renderer.render(pending, md.options, env)));
      pending = [];
      blockCount = 0;
      await yieldToBrowser();
    }
    if (pending.length) {
      onChunk(sanitizeHtml(md.renderer.render(pending, md.options, env)));
    }
    return { malformed: false };
  } catch {
    onChunk(`<pre>${escapeHtml(source)}</pre>`);
    return { malformed: true };
  }
}
