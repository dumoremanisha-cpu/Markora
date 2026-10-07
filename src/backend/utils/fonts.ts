// F35 curated font stacks. See schema.ts's FontFamilyKey doc comment: these
// are OS-available stacks, not bundled `@font-face` assets — a scoped-down
// stand-in for the spec's "~9 curated fonts locally, no CDN" until real font
// binaries are sourced. Swapping in bundled fonts later only means changing
// the CSS values here, not the settings schema or UI.
import type { CodeFontFamilyKey, FontFamilyKey } from '../storage/schema';

export const FONT_FAMILY_STACKS: Record<FontFamilyKey, string> = {
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
  garamond: "Garamond, 'Apple Garamond', Baskerville, serif",
  palatino: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
  verdana: 'Verdana, Geneva, sans-serif',
  trebuchet: "'Trebuchet MS', 'Lucida Grande', sans-serif",
  atkinson: "'Atkinson Hyperlegible', Arial, sans-serif",
  'opendyslexic-fallback': "'OpenDyslexic', Comic Sans MS, sans-serif",
  // Same stack as CODE_FONT_FAMILY_STACKS['mono-system'] — reading the
  // whole document body in monospace (popup Quick Controls' "Mono"
  // quick-pick, `new_ui/extension_popup.png`), not just code blocks.
  mono: "ui-monospace, 'SFMono-Regular', Consolas, monospace",
};

export const CODE_FONT_FAMILY_STACKS: Record<CodeFontFamilyKey, string> = {
  'mono-system': "ui-monospace, 'SFMono-Regular', Consolas, monospace",
  courier: "'Courier New', Courier, monospace",
  consolas: 'Consolas, monospace',
  lucida: "'Lucida Console', Monaco, monospace",
};

export const FONT_FAMILY_KEYS = Object.keys(FONT_FAMILY_STACKS) as FontFamilyKey[];
export const CODE_FONT_FAMILY_KEYS = Object.keys(CODE_FONT_FAMILY_STACKS) as CodeFontFamilyKey[];
