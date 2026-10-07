// Click-to-load for images blocked by the "Block remote images" setting
// (../markdown/plugins/blockRemoteImages.ts generates the placeholder
// markup this wires up). Delegated, registered at most once per contentEl
// — same reasoning as lightbox's own delegated listeners and
// wireCodeBlockCopy in viewer/syntax/enhance.ts: contentEl persists across
// re-renders, only its innerHTML is replaced.
const attachedContentEls = new WeakSet<HTMLElement>();

function loadBlockedImage(wrap: HTMLElement): void {
  const src = wrap.dataset.blockedSrc;
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = wrap.dataset.blockedAlt ?? '';
  img.loading = 'lazy';
  if (wrap.dataset.blockedTitle) img.title = wrap.dataset.blockedTitle;
  wrap.replaceWith(img);
}

/** Wires click/keyboard activation for every "Block remote images" placeholder in `contentEl`. Safe to call again after a re-render. */
export function attachImageBlocking(contentEl: HTMLElement): void {
  if (attachedContentEls.has(contentEl)) return;
  attachedContentEls.add(contentEl);

  contentEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>('.markora-image-placeholder--clickable');
    if (!button) return;
    const wrap = button.closest<HTMLElement>('.markora-image-wrap--blocked');
    if (!wrap) return;
    loadBlockedImage(wrap);
  });
}
