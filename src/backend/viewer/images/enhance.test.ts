import { describe, expect, it } from 'vitest';
import { attachImageBlocking } from './enhance';

function buildBlockedWrap(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML =
    '<p>before</p>' +
    '<span class="markora-image-wrap markora-image-wrap--blocked" ' +
    'data-blocked-src="https://example.com/photo.png" data-blocked-alt="a photo" data-blocked-title="a title">' +
    '<button type="button" class="markora-image-placeholder markora-image-placeholder--clickable">Click to load image: a photo</button>' +
    '</span>' +
    '<p>after</p>';
  return container;
}

describe('attachImageBlocking', () => {
  it('replaces the placeholder with a real <img> on click, using the stored src/alt/title', () => {
    const container = buildBlockedWrap();
    attachImageBlocking(container);

    container
      .querySelector<HTMLButtonElement>('.markora-image-placeholder--clickable')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('.markora-image-wrap--blocked')).toBeNull();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toBe('https://example.com/photo.png');
    expect(img?.alt).toBe('a photo');
    expect(img?.title).toBe('a title');
    // Surrounding content survives the swap.
    expect(container.textContent).toContain('before');
    expect(container.textContent).toContain('after');
  });

  it('is a no-op for clicks outside any placeholder', () => {
    const container = buildBlockedWrap();
    attachImageBlocking(container);

    container.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('.markora-image-wrap--blocked')).not.toBeNull();
  });

  it('only registers one listener per contentEl (idempotent across re-renders)', () => {
    const container = buildBlockedWrap();
    attachImageBlocking(container);
    attachImageBlocking(container);

    container
      .querySelector<HTMLButtonElement>('.markora-image-placeholder--clickable')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // If the listener were registered twice, a second click handler firing
    // on the same (now-replaced) wrap would throw or double-process; a
    // clean single <img> result confirms it didn't.
    expect(container.querySelectorAll('img').length).toBe(1);
  });
});
