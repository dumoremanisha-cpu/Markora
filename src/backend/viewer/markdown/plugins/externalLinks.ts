// External-link indicators + safe target/rel handling (F25, F72). Safe
// target behavior (no window.opener leakage) applies to every absolute
// http(s) link unconditionally; the visual indicator is gated by the
// `showIndicator` toggle and is never shown on a link whose only content is
// an image (F72).
import type { MarkdownIt } from 'markdown-it';

export interface ExternalLinksOptions {
  showIndicator: boolean;
}

const indicatorFlag = new WeakMap<object, boolean>();

export function registerExternalLinks(md: MarkdownIt, options: ExternalLinksOptions): void {
  md.core.ruler.after('inline', 'markora_external_links', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue;
      const children = blockToken.children;
      for (let i = 0; i < children.length; i++) {
        const openToken = children[i];
        if (!openToken || openToken.type !== 'link_open') continue;
        const href = String(openToken.attrGet('href') ?? '');
        if (!/^https?:\/\//i.test(href)) continue;

        let depth = 1;
        let onlyImage = true;
        let sawContent = false;
        let j = i + 1;
        for (; j < children.length; j++) {
          const child = children[j];
          if (!child) continue;
          if (child.type === 'link_open') depth++;
          if (child.type === 'link_close') {
            depth--;
            if (depth === 0) break;
            continue;
          }
          if (child.type === 'image') {
            sawContent = true;
            continue;
          }
          if (child.type === 'softbreak' || child.type === 'hardbreak') continue;
          if (child.type === 'text' && child.content.trim() === '') continue;
          sawContent = true;
          onlyImage = false;
        }

        openToken.attrSet('target', '_blank');
        openToken.attrSet('rel', 'noopener noreferrer');
        if (options.showIndicator && !(sawContent && onlyImage)) {
          indicatorFlag.set(openToken, true);
        }
      }
    }
  });

  const defaultOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) =>
    defaultOpen(tokens, idx, opts, env, self);

  const defaultClose =
    md.renderer.rules.link_close ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_close = (tokens, idx, opts, env, self) => {
    let depth = 0;
    let matched = false;
    for (let i = idx - 1; i >= 0; i--) {
      const t2 = tokens[i];
      if (!t2) continue;
      if (t2.type === 'link_close') {
        depth++;
      } else if (t2.type === 'link_open') {
        if (depth === 0) {
          matched = indicatorFlag.has(t2);
          break;
        }
        depth--;
      }
    }
    const suffix = matched
      ? '<span class="markora-link-indicator" aria-hidden="true">↗</span>'
      : '';
    return suffix + defaultClose(tokens, idx, opts, env, self);
  };
}
