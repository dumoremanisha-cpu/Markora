import { describe, expect, it, vi } from 'vitest';
import { buildMathContent, tryTier1Omml } from './math';
import type { MathRasterizer } from './math';

describe('tryTier1Omml — the documented tier-1 simple-construct set', () => {
  it('accepts a plain literal run', () => {
    expect(tryTier1Omml('x+y=z')).not.toBeNull();
  });

  it('accepts symbol-table commands', () => {
    expect(tryTier1Omml('\\alpha + \\beta \\leq \\pi')).not.toBeNull();
  });

  it('accepts one level of superscript with a single-char argument', () => {
    expect(tryTier1Omml('x^2')).not.toBeNull();
  });

  it('accepts one level of superscript with a braced argument', () => {
    expect(tryTier1Omml('x^{ab}')).not.toBeNull();
  });

  it('accepts one level of subscript', () => {
    expect(tryTier1Omml('a_i')).not.toBeNull();
  });

  it('accepts \\frac with flat arguments', () => {
    expect(tryTier1Omml('\\frac{1}{2}')).not.toBeNull();
  });

  it('accepts \\sqrt with a flat argument', () => {
    expect(tryTier1Omml('\\sqrt{2}')).not.toBeNull();
  });

  it('rejects an unrecognized command', () => {
    expect(tryTier1Omml('\\int_0^1 x')).toBeNull();
  });

  it('rejects nested scripts (two levels)', () => {
    expect(tryTier1Omml('x^{2^3}')).toBeNull();
  });

  it('rejects a fraction with a nested fraction inside it', () => {
    expect(tryTier1Omml('\\frac{\\frac{1}{2}}{3}')).toBeNull();
  });

  it('rejects a superscript with no base', () => {
    expect(tryTier1Omml('^2')).toBeNull();
  });

  it('rejects unbalanced braces', () => {
    expect(tryTier1Omml('\\frac{1}{2')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(tryTier1Omml('')).toBeNull();
    expect(tryTier1Omml('   ')).toBeNull();
  });
});

describe('buildMathContent — tier orchestration', () => {
  it('uses tier 1 when the construct is simple, without calling the rasterizer', async () => {
    const rasterize = vi.fn<MathRasterizer>(async () => null);
    const result = await buildMathContent('x^2', false, rasterize);
    expect(result.tier).toBe(1);
    expect(rasterize).not.toHaveBeenCalled();
  });

  it('falls to tier 2 when tier 1 fails and rasterization succeeds', async () => {
    const rasterize = vi.fn<MathRasterizer>(async () => ({
      data: new Uint8Array([1, 2, 3]),
      widthPx: 10,
      heightPx: 10,
    }));
    const result = await buildMathContent('\\int_0^1 x', false, rasterize);
    expect(result.tier).toBe(2);
    expect(rasterize).toHaveBeenCalledWith('\\int_0^1 x', false);
  });

  it('falls to tier 3 (italic source text) when both tier 1 and tier 2 fail', async () => {
    const rasterize = vi.fn<MathRasterizer>(async () => null);
    const result = await buildMathContent('\\int_0^1 x', false, rasterize);
    expect(result.tier).toBe(3);
  });

  it('falls to tier 3 when the rasterizer throws', async () => {
    const rasterize = vi.fn<MathRasterizer>(async () => {
      throw new Error('boom');
    });
    const result = await buildMathContent('\\int_0^1 x', false, rasterize);
    expect(result.tier).toBe(3);
  });
});
