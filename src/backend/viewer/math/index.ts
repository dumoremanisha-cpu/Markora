// KaTeX adapter (F12, ADR-0002 KaTeX section). Hydrates the `.markora-math`
// placeholders emitted by ../markdown/plugins/math.ts once they're in the
// live DOM — see that module's comment for why rendering is deferred to
// this post-insertion pass rather than done inline during parsing. KaTeX's
// JS and font-bearing CSS are only fetched the first time a document
// actually contains a math placeholder (task 7: deferred, never on the
// critical path for documents with no math).
import { t } from '../../i18n';
import { sanitizeMathHtml } from '../sanitization';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

interface KatexLike {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

let katexPromise: Promise<KatexLike> | null = null;

function loadKatex(): Promise<KatexLike> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([mod]) => (mod as unknown as { default?: KatexLike }).default ?? (mod as unknown as KatexLike),
  );
  return katexPromise;
}

function buildErrorNotice(): string {
  return (
    `<span class="markora-notice markora-notice--error markora-math__error">` +
    `${escapeHtml(t('viewer.math.invalid'))}</span>`
  );
}

/**
 * Finds every not-yet-rendered `.markora-math` placeholder under `root` and
 * hydrates it with KaTeX's output, sanitized via {@link sanitizeMathHtml}
 * (security-privacy.md §1 — mandatory before DOM insertion, no exceptions).
 * Idempotent: already-hydrated placeholders (marked via `data-rendered`) are
 * skipped, so this is safe to call again after a partial/incremental render.
 * Invalid LaTeX renders the project's standard inline-error notice
 * (ADR-0002) instead of KaTeX's own raw error markup, and never throws —
 * one bad expression can't break the rest of the document.
 */
export async function renderMathIn(root: ParentNode): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('.markora-math:not([data-rendered])'),
  );
  if (placeholders.length === 0) return;

  let katex: KatexLike;
  try {
    katex = await loadKatex();
  } catch {
    for (const el of placeholders) {
      el.innerHTML = buildErrorNotice();
      el.dataset.rendered = 'true';
    }
    return;
  }

  for (const el of placeholders) {
    const source = el.textContent ?? '';
    const displayMode = el.dataset.display === 'true';
    try {
      const rendered = katex.renderToString(source, { throwOnError: true, displayMode });
      el.innerHTML = sanitizeMathHtml(rendered);
    } catch {
      el.innerHTML = buildErrorNotice();
      el.classList.add('markora-math--error');
    }
    el.dataset.rendered = 'true';
  }
}
