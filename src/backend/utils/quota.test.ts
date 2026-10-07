import { describe, expect, it } from 'vitest';
import { shouldPromptUnlimitedStorage, usageRatio } from './quota';

describe('shouldPromptUnlimitedStorage', () => {
  it('is false below the warning threshold', () => {
    expect(shouldPromptUnlimitedStorage(7_000_000, 10_000_000)).toBe(false);
  });

  it('is true at or above the warning threshold', () => {
    expect(shouldPromptUnlimitedStorage(8_000_000, 10_000_000)).toBe(true);
    expect(shouldPromptUnlimitedStorage(9_500_000, 10_000_000)).toBe(true);
  });

  it('respects a custom ratio', () => {
    expect(shouldPromptUnlimitedStorage(5_000_000, 10_000_000, 0.5)).toBe(true);
  });

  it('is false when quota is zero or negative (avoids divide-by-zero)', () => {
    expect(shouldPromptUnlimitedStorage(100, 0)).toBe(false);
  });
});

describe('usageRatio', () => {
  it('computes the fraction used', () => {
    expect(usageRatio(2_500_000, 10_000_000)).toBe(0.25);
  });

  it('is 0 for a non-positive quota', () => {
    expect(usageRatio(100, 0)).toBe(0);
  });
});
