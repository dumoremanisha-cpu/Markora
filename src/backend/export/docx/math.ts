// F31/ADR-0005 §4 task 3 — the three-tier math strategy. Tier 1 (this
// module's parser) is a small, deliberately restricted LaTeX grammar: the
// exact "simple construct" set the phase's exit criteria requires be
// explicit and testable, not "simple enough" left vague. It covers, and
// *only* covers:
//
//   - plain runs of letters/digits/basic punctuation (`+ - = ( ) [ ] , . ! < > | *`)
//   - the symbol table in `SYMBOLS` below (Greek letters, common operators/arrows)
//   - exactly one level of superscript/subscript (`x^2`, `x^{ab}`, `x_i`, `x_{ij}`)
//   - exactly one level of `\frac{A}{B}` or `\sqrt{A}`, where A/B are
//     themselves restricted to plain runs + symbols (no nested scripts,
//     fractions, or radicals)
//
// Anything else — nested structures, matrices, sums/integrals, unrecognized
// commands, unbalanced braces — fails tier 1 and falls to tier 2 (rasterized
// KaTeX image) per `mathRaster.ts`, then tier 3 (italic source text) if that
// also fails. This module never throws: a failed parse returns `null`, the
// orchestration in `buildMathContent` below is what walks the tiers.
import {
  Math as MathBlock,
  MathRun,
  MathSuperScript,
  MathSubScript,
  MathFraction,
  MathRadical,
  TextRun,
  ImageRun,
} from 'docx';
import type { MathComponent, ParagraphChild } from 'docx';

const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  infty: '∞',
  times: '×',
  cdot: '⋅',
  pm: '±',
  mp: '∓',
  div: '÷',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  rightarrow: '→',
  to: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  ldots: '…',
  cdots: '⋯',
};

const PLAIN_CHAR_RE = /[A-Za-z0-9+\-=().,!<>|*/[\]]/;

class Tier1ParseError extends Error {}

/** Parses a LaTeX fragment restricted to plain text + the symbol table (no scripts, fractions, or radicals) — used for `\frac`/`\sqrt` arguments, which tier 1 only supports one level deep. */
function parseFlat(src: string, pos: { i: number }, stopAt: string): string {
  let out = '';
  while (pos.i < src.length && src[pos.i] !== stopAt) {
    const ch = src[pos.i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      pos.i++;
      continue;
    }
    if (ch === '\\') {
      pos.i++;
      const start = pos.i;
      while (pos.i < src.length && /[A-Za-z]/.test(src[pos.i]!)) pos.i++;
      const name = src.slice(start, pos.i);
      const symbol = SYMBOLS[name];
      if (!symbol) throw new Tier1ParseError(`unsupported command in flat context: \\${name}`);
      out += symbol;
      continue;
    }
    if (PLAIN_CHAR_RE.test(ch)) {
      out += ch;
      pos.i++;
      continue;
    }
    throw new Tier1ParseError(`unsupported character in flat context: ${ch}`);
  }
  if (src[pos.i] !== stopAt) throw new Tier1ParseError('unterminated group');
  return out;
}

function expect(src: string, pos: { i: number }, ch: string): void {
  if (src[pos.i] !== ch) throw new Tier1ParseError(`expected "${ch}"`);
  pos.i++;
}

/** One level of superscript/subscript content: a brace group of flat text, or a single literal/symbol character. */
function parseScriptArg(src: string, pos: { i: number }): string {
  if (src[pos.i] === '{') {
    pos.i++;
    const content = parseFlat(src, pos, '}');
    pos.i++; // consume '}'
    return content;
  }
  const ch = src[pos.i];
  if (ch === undefined) throw new Tier1ParseError('missing script argument');
  if (ch === '\\') {
    pos.i++;
    const start = pos.i;
    while (pos.i < src.length && /[A-Za-z]/.test(src[pos.i]!)) pos.i++;
    const name = src.slice(start, pos.i);
    const symbol = SYMBOLS[name];
    if (!symbol) throw new Tier1ParseError(`unsupported command in script: \\${name}`);
    return symbol;
  }
  if (!PLAIN_CHAR_RE.test(ch)) throw new Tier1ParseError(`unsupported script character: ${ch}`);
  pos.i++;
  return ch;
}

/** The full (non-flat) grammar: plain runs, symbols, one level of `^`/`_`, and one level of `\frac`/`\sqrt`. */
function parseSequence(src: string, pos: { i: number }): MathComponent[] {
  const components: MathComponent[] = [];

  function lastOrThrow(): MathComponent {
    const last = components.pop();
    if (!last) throw new Tier1ParseError('script with no base');
    return last;
  }

  while (pos.i < src.length) {
    const ch = src[pos.i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      pos.i++;
      continue;
    }
    if (ch === '^') {
      pos.i++;
      const exp = parseScriptArg(src, pos);
      components.push(
        new MathSuperScript({ children: [lastOrThrow()], superScript: [new MathRun(exp)] }),
      );
      continue;
    }
    if (ch === '_') {
      pos.i++;
      const sub = parseScriptArg(src, pos);
      components.push(
        new MathSubScript({ children: [lastOrThrow()], subScript: [new MathRun(sub)] }),
      );
      continue;
    }
    if (ch === '\\') {
      pos.i++;
      const start = pos.i;
      while (pos.i < src.length && /[A-Za-z]/.test(src[pos.i]!)) pos.i++;
      const name = src.slice(start, pos.i);
      if (name === 'frac') {
        expect(src, pos, '{');
        const numerator = parseFlat(src, pos, '}');
        pos.i++;
        expect(src, pos, '{');
        const denominator = parseFlat(src, pos, '}');
        pos.i++;
        components.push(
          new MathFraction({
            numerator: [new MathRun(numerator)],
            denominator: [new MathRun(denominator)],
          }),
        );
        continue;
      }
      if (name === 'sqrt') {
        expect(src, pos, '{');
        const radicand = parseFlat(src, pos, '}');
        pos.i++;
        components.push(new MathRadical({ children: [new MathRun(radicand)] }));
        continue;
      }
      const symbol = SYMBOLS[name];
      if (!symbol) throw new Tier1ParseError(`unsupported command: \\${name}`);
      components.push(new MathRun(symbol));
      continue;
    }
    if (PLAIN_CHAR_RE.test(ch)) {
      let run = '';
      while (pos.i < src.length && PLAIN_CHAR_RE.test(src[pos.i]!)) {
        run += src[pos.i];
        pos.i++;
      }
      components.push(new MathRun(run));
      continue;
    }
    throw new Tier1ParseError(`unsupported character: ${ch}`);
  }
  return components;
}

/** Attempts tier-1 direct LaTeX->OMML conversion. Returns `null` (never throws) for anything outside the documented simple-construct set. */
export function tryTier1Omml(latex: string): MathComponent[] | null {
  const trimmed = latex.trim();
  if (trimmed.length === 0) return null;
  try {
    const pos = { i: 0 };
    const components = parseSequence(trimmed, pos);
    if (pos.i !== trimmed.length || components.length === 0) return null;
    return components;
  } catch {
    return null;
  }
}

export interface RasterizedMath {
  data: Uint8Array;
  /** Intended display size in pixels — already scaled back down from the (higher-resolution) raster buffer. */
  widthPx: number;
  heightPx: number;
}

export type MathRasterizer = (
  latex: string,
  displayMode: boolean,
) => Promise<RasterizedMath | null>;

export interface MathConversionResult {
  tier: 1 | 2 | 3;
  children: ParagraphChild[];
}

/**
 * Runs the full three-tier strategy for one math placeholder. `rasterize` is
 * injected (see `mathRaster.ts`) so this orchestration is unit-testable
 * without a real browser canvas.
 */
export async function buildMathContent(
  latex: string,
  displayMode: boolean,
  rasterize: MathRasterizer,
): Promise<MathConversionResult> {
  const tier1 = tryTier1Omml(latex);
  if (tier1) {
    return { tier: 1, children: [new MathBlock({ children: tier1 })] };
  }

  try {
    const rasterized = await rasterize(latex, displayMode);
    if (rasterized) {
      return {
        tier: 2,
        children: [
          new ImageRun({
            type: 'png',
            data: rasterized.data,
            transformation: { width: rasterized.widthPx, height: rasterized.heightPx },
          }),
        ],
      };
    }
  } catch {
    // Falls through to tier 3 — rasterization is never allowed to abort the export.
  }

  return { tier: 3, children: [new TextRun({ text: latex, italics: true })] };
}
