// Unicode-safe heading-anchor generation (F60). Always on — anchors and
// URL-fragment deep-linking are a baseline requirement, not one of the F69
// per-feature toggles. A small core rule rather than a third-party plugin:
// markdown-it-anchor's shipped types import from `markdown-it/lib/...`
// subpaths that markdown-it 15's package layout no longer ships, and this
// task is simple enough not to need the dependency.
import type { MarkdownIt } from 'markdown-it';

// Every generated id is prefixed — never a bare slug. DOMPurify's
// anti-DOM-clobbering protection (SANITIZE_DOM, on by default) silently
// strips any `id`/`name` attribute whose *value* collides with an existing
// property name on `document` (security-privacy.md's "sanitize everything"
// is non-negotiable, so this isn't something to configure around). Common
// English heading words are a real collision risk this way — "Title",
// "Location", "Forms", "Cookie", "Domain", "Body", "Images", "Links", "All"
// and dozens more are all live `document.*` properties, and a slug matching
// one would have its id attribute vanish silently. The prefix makes a
// collision effectively impossible without changing what a reader sees.
const ID_PREFIX = 'heading-';

/**
 * Keeps Unicode letters/numbers (any script — not just ASCII), lowercases,
 * collapses whitespace to single hyphens, and strips punctuation/symbols
 * (including emoji, and incidentally Markdown's own inline-emphasis
 * characters, since headings are slugified from their raw, not-yet-rendered
 * source text). Matches the general shape of GitHub's heading-slug algorithm
 * closely enough for deep-linking to work correctly against non-English
 * headings.
 */
export function slugifyHeading(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function registerAnchors(md: MarkdownIt): void {
  md.core.ruler.push('markora_anchors', (state) => {
    const seen = new Map<string, number>();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token.type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      const raw = inline && inline.type === 'inline' ? inline.content : '';
      const base = slugifyHeading(raw) || 'section';
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      token.attrSet('id', ID_PREFIX + (count === 0 ? base : `${base}-${count}`));
    }
  });
}
