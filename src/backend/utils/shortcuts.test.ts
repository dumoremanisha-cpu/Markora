import { describe, expect, it } from 'vitest';
import { formatShortcut, isCompleteShortcut, matchesShortcut } from './shortcuts';

function event(
  overrides: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    key: string;
  }>,
) {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'a',
    ...overrides,
  };
}

describe('formatShortcut (F39)', () => {
  it('formats a simple Ctrl+letter combo, uppercasing the key', () => {
    expect(formatShortcut(event({ ctrlKey: true, key: 'l' }))).toBe('Ctrl+L');
  });

  it('treats metaKey (Cmd) the same as Ctrl so combos are stored once cross-platform', () => {
    expect(formatShortcut(event({ metaKey: true, key: 'l' }))).toBe('Ctrl+L');
  });

  it('orders modifiers Ctrl, Alt, Shift regardless of press order', () => {
    expect(formatShortcut(event({ ctrlKey: true, altKey: true, shiftKey: true, key: 'd' }))).toBe(
      'Ctrl+Alt+Shift+D',
    );
  });

  it('does not double-append the modifier itself as the key', () => {
    expect(formatShortcut(event({ ctrlKey: true, key: 'Control' }))).toBe('Ctrl');
  });

  it('keeps non-letter keys as-is (e.g. "/")', () => {
    expect(formatShortcut(event({ ctrlKey: true, key: '/' }))).toBe('Ctrl+/');
  });

  it('formats a bare key with no modifiers', () => {
    expect(formatShortcut(event({ key: 'Escape' }))).toBe('Escape');
  });
});

describe('matchesShortcut', () => {
  it('matches an event against its own formatted combo', () => {
    const e = event({ ctrlKey: true, shiftKey: true, key: 'm' });
    expect(matchesShortcut(e, formatShortcut(e))).toBe(true);
  });

  it('does not match a different combo', () => {
    expect(matchesShortcut(event({ ctrlKey: true, key: 'l' }), 'Ctrl+M')).toBe(false);
  });
});

describe('isCompleteShortcut', () => {
  it('rejects a combo that is only modifiers', () => {
    expect(isCompleteShortcut('Ctrl')).toBe(false);
    expect(isCompleteShortcut('Ctrl+Shift')).toBe(false);
  });

  it('accepts a combo with a real key', () => {
    expect(isCompleteShortcut('Ctrl+Shift+L')).toBe(true);
    expect(isCompleteShortcut('Escape')).toBe(true);
  });
});
