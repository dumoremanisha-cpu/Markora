// Front matter extraction + info-card rendering (F43). Values are rendered
// as text into the card, never as HTML (Phase 2-A security requirement) —
// DOMPurify remains the final backstop regardless, but this module never
// hands a parsed value to innerHTML without escaping it first.
import { load } from 'js-yaml';
import { t } from '../../i18n';

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export interface ExtractedFrontMatter {
  data: Record<string, unknown> | null;
  body: string;
}

/** Structurally strips a leading `---\n...\n---` block; only exposes `data` when it parses as a YAML mapping. */
export function extractFrontMatter(source: string): ExtractedFrontMatter {
  const match = FRONT_MATTER_RE.exec(source);
  if (!match) return { data: null, body: source };
  const raw = match[1] ?? '';
  const body = source.slice(match[0].length);
  try {
    // maxAliases: 0 rejects YAML anchors/aliases outright — front matter
    // never legitimately needs them, and untrusted alias chains are a known
    // denial-of-service vector ("billion laughs") for YAML parsers.
    const parsed = load(raw, { maxAliases: 0 });
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, body };
    }
    return { data: null, body };
  } catch {
    return { data: null, body };
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Renders parsed front matter as a clean info card (F43) rather than raw YAML. */
export function renderFrontMatterCard(data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && formatValue(value) !== '')
    .map(
      ([key, value]) =>
        `<div class="markora-frontmatter__row"><dt>${escapeHtml(key)}</dt><dd dir="auto">${escapeHtml(formatValue(value))}</dd></div>`,
    )
    .join('');
  if (!rows) return '';
  return `<dl class="markora-frontmatter" aria-label="${escapeHtml(t('markdown.frontMatter.title'))}">${rows}</dl>`;
}
