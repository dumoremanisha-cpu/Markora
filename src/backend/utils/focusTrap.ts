// Focus trapping for open modal dialogs (06-testing-quality-gate.md §3:
// "focus trapped inside open dialogs"). Extracted from the pattern
// src/components/lightbox/index.ts already implemented correctly — call
// this from a dialog's own `keydown` handler on every 'Tab' press so
// Tab/Shift+Tab cycle within the dialog's own focusable elements instead
// of escaping to the page behind it.
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** True if `el` or any ancestor up to (and excluding) `document` carries the `hidden` attribute. `:not([hidden])` in a CSS selector only checks the element's own attribute — every component in this codebase toggles visibility via `.hidden` on a *container* (e.g. the diagram-chrome fullscreen overlay), leaving descendants like its own close button technically un-hidden themselves. */
function isHiddenByAncestor(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hidden) return true;
  }
  return false;
}

/** Wraps Tab at the last focusable element back to the first (and Shift+Tab at the first back to the last), scoped to `container`'s current focusable descendants — recomputed on every call so it stays correct as a dialog's own content changes (e.g. the presentation's prev/next zone buttons hiding at the first/last slide). */
export function trapTabFocus(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !isHiddenByAncestor(el),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
