import { afterEach, describe, expect, it } from 'vitest';
import { collectUsedCss } from './cssTreeShake';

function injectStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

describe('collectUsedCss', () => {
  const injected: HTMLStyleElement[] = [];

  afterEach(() => {
    for (const style of injected.splice(0)) style.remove();
    document.body.innerHTML = '';
  });

  it('keeps a rule whose selector matches an element inside root', () => {
    injected.push(injectStyle('.used { color: red; }'));
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    expect(collectUsedCss(root)).toContain('.used');
  });

  it('drops a rule whose selector matches nothing inside root', () => {
    injected.push(injectStyle('.unused { color: blue; }'));
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    expect(collectUsedCss(root)).not.toContain('.unused');
  });

  it('always keeps :root/html/body-level rules regardless of root content', () => {
    injected.push(injectStyle(":root[data-theme='dark'] { --x: 1; }"));
    const root = document.createElement('div');
    root.innerHTML = '<p>hi</p>';
    expect(collectUsedCss(root)).toContain("data-theme='dark'");
  });

  it('keeps the root element itself matching a selector, not just its descendants', () => {
    injected.push(injectStyle('.markora-content { padding: 1em; }'));
    const root = document.createElement('div');
    root.className = 'markora-content';
    expect(collectUsedCss(root)).toContain('.markora-content');
  });

  it('recurses into @media, keeping only the block if an inner rule matches', () => {
    injected.push(
      injectStyle('@media (max-width: 768px) { .used { color: green; } .unused { color: pink; } }'),
    );
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    const css = collectUsedCss(root);
    expect(css).toContain('@media');
    expect(css).toContain('.used');
    expect(css).not.toContain('.unused');
  });

  it('drops an @media block entirely when nothing inside it matches', () => {
    injected.push(injectStyle('@media (max-width: 768px) { .unused { color: pink; } }'));
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    expect(collectUsedCss(root)).not.toContain('@media');
  });

  it('includes an @keyframes block referenced by a kept rule, and drops an unreferenced one', () => {
    injected.push(
      injectStyle(
        '@keyframes markora-bounce { 0% { transform: none; } } ' +
          '@keyframes markora-unused { 0% { opacity: 0; } } ' +
          '.used { animation: markora-bounce 1s infinite; }',
      ),
    );
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    const css = collectUsedCss(root);
    expect(css).toContain('markora-bounce');
    expect(css).not.toContain('markora-unused');
  });

  it('handles a selector list, keeping the rule if any comma-separated part matches', () => {
    injected.push(injectStyle('.absent, .used { color: red; }'));
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    expect(collectUsedCss(root)).toContain('.used');
  });

  it('does not throw on a selector matches()/querySelector() reject (a pseudo-element)', () => {
    injected.push(injectStyle('.used::before { content: "*"; }'));
    const root = document.createElement('div');
    root.innerHTML = '<p class="used">hi</p>';
    expect(() => collectUsedCss(root)).not.toThrow();
  });
});
