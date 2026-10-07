// "Block remote images" (04-security-privacy.md §1, point 4): when
// enabled, a remote (http/https) image referenced by the open document
// never gets a real `src` at all. This runs as a core rule (not just a
// renderer override) so the *token* itself carries the block marker
// (`data-markora-blocked-src`) — DOCX export walks this same token stream
// directly (ADR-0005, astMapper.ts), not the rendered HTML/DOM, so a
// renderer-only override would be invisible to it. Local/relative and
// `file:` image sources are never affected — this is about eliminating
// the one disclosed network exception 04-security-privacy.md §1
// documents (a document-referenced remote subresource), not about local
// content the extension already treats as fully private.
import type { MarkdownIt } from 'markdown-it';
import { t } from '../../../i18n';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

const REMOTE_URL_RE = /^https?:\/\//i;
export const BLOCKED_SRC_ATTR = 'data-markora-blocked-src';

export function registerBlockRemoteImages(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'markora_block_remote_images', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue;
      for (const token of blockToken.children) {
        if (token.type !== 'image') continue;
        const src = String(token.attrGet('src') ?? '');
        if (!REMOTE_URL_RE.test(src)) continue;
        token.attrSet(BLOCKED_SRC_ATTR, src);
        token.attrSet('src', '');
      }
    }
  });

  const defaultRule =
    md.renderer.rules.image ??
    ((tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (!token) return '';
      const altIndex = token.attrIndex('alt');
      if (altIndex >= 0 && token.attrs) {
        token.attrs[altIndex]![1] = self.renderInlineAsText(token.children ?? [], options, env);
      }
      return self.renderToken(tokens, idx, options);
    });

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (!token) return '';
    const blockedSrc = String(token.attrGet(BLOCKED_SRC_ATTR) ?? '');
    if (!blockedSrc) return defaultRule(tokens, idx, options, env, self);

    const alt = self.renderInlineAsText(token.children ?? [], options, env);
    const title = token.attrGet('title');
    const titleStr = title ? String(title) : '';
    const label = t('image.blocked.clickToLoad', { alt: alt || blockedSrc });
    return (
      `<span class="markora-image-wrap markora-image-wrap--blocked" data-blocked-src="${escapeHtml(blockedSrc)}" data-blocked-alt="${escapeHtml(alt)}"${
        titleStr ? ` data-blocked-title="${escapeHtml(titleStr)}"` : ''
      }>` +
      `<button type="button" class="markora-image-placeholder markora-image-placeholder--clickable">${escapeHtml(label)}</button>` +
      `</span>`
    );
  };
}
