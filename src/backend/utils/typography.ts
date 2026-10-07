// F35/F81 — pure mapping from Settings to CSS custom properties, kept
// side-effect-free (no DOM here) so the mapping itself is unit-testable.
// Applying these to the document is the caller's job (src/viewer/index.ts).
import type { Settings } from '../storage';
import { CODE_FONT_FAMILY_STACKS, FONT_FAMILY_STACKS } from './fonts';

export function buildTypographyCssVars(settings: Settings): Record<string, string> {
  return {
    '--markora-content-font-family': FONT_FAMILY_STACKS[settings.fontFamily],
    '--markora-content-font-size': `${settings.fontSize}px`,
    '--markora-content-line-height': String(settings.lineHeight),
    '--markora-content-width': `${settings.contentWidth}px`,
    '--markora-code-font-family': CODE_FONT_FAMILY_STACKS[settings.codeFontFamily],
    '--markora-heading-scale': String(settings.headingScale),
    '--markora-toc-width': `${settings.tocSidebarWidth}px`,
  };
}
