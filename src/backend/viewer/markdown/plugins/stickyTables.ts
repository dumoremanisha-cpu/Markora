// Sticky table headers (F26): wraps every table in a horizontally-scrollable
// container so wide tables stay responsive at narrow widths, while the CSS
// in src/styles/index.css pins the header row via `position: sticky`.
import type { MarkdownIt } from 'markdown-it';

export function registerStickyTables(md: MarkdownIt): void {
  const defaultOpen =
    md.renderer.rules.table_open ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.table_open = (tokens, idx, opts, env, self) =>
    `<div class="markora-table-wrap">${defaultOpen(tokens, idx, opts, env, self)}`;

  const defaultClose =
    md.renderer.rules.table_close ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.table_close = (tokens, idx, opts, env, self) =>
    `${defaultClose(tokens, idx, opts, env, self)}</div>`;
}
