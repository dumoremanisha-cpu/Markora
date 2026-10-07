// GitHub-style alerts (F44): `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`,
// `> [!WARNING]`, `> [!CAUTION]`. Runs as a core rule between 'block' and
// 'inline' so it can still see each alert's raw (pre-inline-parsed) marker
// line, strip it, and re-tag the enclosing blockquote — the renderer then
// checks that tag at render time to decide between a plain blockquote and a
// styled alert.
import type { MarkdownIt, StateCore } from 'markdown-it';
import { t } from '../../../i18n';

type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

const ICONS: Record<AlertType, string> = {
  NOTE: 'ℹ️',
  TIP: '💡',
  IMPORTANT: '📌',
  WARNING: '⚠️',
  CAUTION: '🚫',
};

const LABEL_KEYS: Record<AlertType, string> = {
  NOTE: 'markdown.alert.note',
  TIP: 'markdown.alert.tip',
  IMPORTANT: 'markdown.alert.important',
  WARNING: 'markdown.alert.warning',
  CAUTION: 'markdown.alert.caution',
};

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i;

const alertType = new WeakMap<object, AlertType>();

export interface AlertsOptions {
  /** F44 setting: show the localized title ("Note") or the literal keyword ("NOTE"). */
  titleMode: 'localized' | 'literal';
}

function findAlerts(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const blockquoteOpen = tokens[i];
    if (!blockquoteOpen || blockquoteOpen.type !== 'blockquote_open') continue;
    const paragraphOpen = tokens[i + 1];
    const inline = tokens[i + 2];
    if (!paragraphOpen || paragraphOpen.type !== 'paragraph_open') continue;
    if (!inline || inline.type !== 'inline') continue;
    const match = MARKER_RE.exec(inline.content);
    if (!match) continue;
    const type = match[1]?.toUpperCase() as AlertType;
    inline.content = inline.content.slice(match[0].length);
    alertType.set(blockquoteOpen, type);
    // The matching blockquote_close is found by the renderer at render time
    // via the same nesting-depth scan every blockquote already needs.
  }
}

export function registerAlerts(md: MarkdownIt, options: AlertsOptions): void {
  md.core.ruler.after('block', 'markora_alerts', findAlerts);

  const defaultOpen =
    md.renderer.rules.blockquote_open ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  const defaultClose =
    md.renderer.rules.blockquote_close ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const type = token ? alertType.get(token) : undefined;
    if (!type) return defaultOpen(tokens, idx, opts, env, self);
    const label = options.titleMode === 'literal' ? type : t(LABEL_KEYS[type]);
    return (
      `<div class="markora-alert markora-alert--${type.toLowerCase()}" role="note" dir="auto">` +
      `<p class="markora-alert__title"><span aria-hidden="true">${ICONS[type]}</span> ${label}</p>\n`
    );
  };

  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) => {
    // Find the matching blockquote_open by scanning back through nesting
    // depth (mirrors how markdown-it itself pairs open/close tokens).
    let depth = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const t2 = tokens[i];
      if (!t2) continue;
      if (t2.type === 'blockquote_close') {
        depth++;
      } else if (t2.type === 'blockquote_open') {
        if (depth === 0) {
          return alertType.has(t2) ? '</div>\n' : defaultClose(tokens, idx, opts, env, self);
        }
        depth--;
      }
    }
    return defaultClose(tokens, idx, opts, env, self);
  };
}
