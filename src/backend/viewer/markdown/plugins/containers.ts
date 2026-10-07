// Custom containers (F67): `:::info`, `:::warning`/`:::caution`, `:::danger`,
// `:::details` (collapsible), `:::spoiler`. Distinct from, but visually
// consistent with, the GitHub-style alerts in ./alerts.ts.
import container from 'markdown-it-container';
import type { MarkdownIt, Token } from 'markdown-it';
import { t } from '../../../i18n';

type Variant = 'info' | 'warning' | 'danger' | 'details' | 'spoiler';

interface ContainerSpec {
  name: string;
  variant: Variant;
  icon: string;
  defaultLabelKey: string;
}

const CONTAINERS: ContainerSpec[] = [
  { name: 'info', variant: 'info', icon: 'ℹ️', defaultLabelKey: 'markdown.container.info' },
  {
    name: 'warning',
    variant: 'warning',
    icon: '⚠️',
    defaultLabelKey: 'markdown.container.warning',
  },
  {
    name: 'caution',
    variant: 'warning',
    icon: '⚠️',
    defaultLabelKey: 'markdown.container.warning',
  },
  { name: 'danger', variant: 'danger', icon: '🛑', defaultLabelKey: 'markdown.container.danger' },
  { name: 'details', variant: 'details', icon: '', defaultLabelKey: 'markdown.container.details' },
  { name: 'spoiler', variant: 'spoiler', icon: '', defaultLabelKey: 'markdown.container.spoiler' },
];

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function extractTitle(info: string, name: string): string {
  return info.trim().slice(name.length).trim();
}

export function registerContainers(md: MarkdownIt): void {
  for (const spec of CONTAINERS) {
    md.use(container, spec.name, {
      validate: (params: string) => params.trim().split(/\s+/)[0] === spec.name,
      render(tokens: Token[], idx: number) {
        const token = tokens[idx];
        if (!token) return '';
        if (token.nesting === 1) {
          const customTitle = extractTitle(token.info, spec.name);
          const label = customTitle ? escapeHtml(customTitle) : escapeHtml(t(spec.defaultLabelKey));
          if (spec.variant === 'details' || spec.variant === 'spoiler') {
            return `<details class="markora-container markora-container--${spec.variant}" dir="auto"><summary>${label}</summary>\n`;
          }
          return (
            `<div class="markora-container markora-container--${spec.variant}" dir="auto">` +
            `<p class="markora-container__label"><span aria-hidden="true">${spec.icon}</span> ${label}</p>\n`
          );
        }
        return spec.variant === 'details' || spec.variant === 'spoiler'
          ? '</details>\n'
          : '</div>\n';
      },
    });
  }
}
