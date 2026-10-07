import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { trapTabFocus } from './focusTrap';

function makeEvent(shiftKey: boolean): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
}

describe('trapTabFocus', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c" hidden>C (hidden)</button>
      <button id="d" disabled>D (disabled)</button>
      <button id="e">E</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('wraps Tab from the last visible/enabled element back to the first', () => {
    const last = container.querySelector<HTMLElement>('#e')!;
    last.focus();
    const event = makeEvent(false);
    trapTabFocus(container, event);
    expect(document.activeElement).toBe(container.querySelector('#a'));
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    const first = container.querySelector<HTMLElement>('#a')!;
    first.focus();
    const event = makeEvent(true);
    trapTabFocus(container, event);
    expect(document.activeElement).toBe(container.querySelector('#e'));
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing (lets default Tab proceed) when focus is on a middle element', () => {
    const middle = container.querySelector<HTMLElement>('#b')!;
    middle.focus();
    const event = makeEvent(false);
    trapTabFocus(container, event);
    expect(document.activeElement).toBe(middle);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores hidden and disabled elements when computing first/last', () => {
    // #e is the last *visible, enabled* element even though #c/#d follow #b
    // in document order — both are excluded from the focus cycle.
    const first = container.querySelector<HTMLElement>('#a')!;
    first.focus();
    const event = makeEvent(true);
    trapTabFocus(container, event);
    expect(document.activeElement).toBe(container.querySelector('#e'));
  });

  it('is a no-op when the container has no focusable elements', () => {
    const empty = document.createElement('div');
    empty.innerHTML = '<p>no controls here</p>';
    document.body.appendChild(empty);
    const event = makeEvent(false);
    expect(() => trapTabFocus(empty, event)).not.toThrow();
    expect(event.defaultPrevented).toBe(false);
    empty.remove();
  });
});
