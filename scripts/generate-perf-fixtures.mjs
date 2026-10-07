// Generates the ~1MB and ~5MB performance fixtures Phase 2-A commits for
// budgets P1/P2 (docs/specs/06-testing-quality-gate.md §1a). Run manually
// with `node scripts/generate-perf-fixtures.mjs` whenever the fixtures need
// regenerating — the output is committed, not built on the fly.
//
// Section count is deliberately kept in the "hundreds" range the spec asks
// for ("hundreds of headings, many code blocks, many images") by bulking up
// each section's prose rather than multiplying the number of sections —
// matching a real large document (mostly text) rather than an unrealistic
// stress case of thousands of tiny structural elements, which measures
// DOMPurify's per-node overhead rather than realistic render performance.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'e2e', 'fixtures');

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
  'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure ' +
  'dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

// Ten LOREM blocks' worth of prose per section, same as before, but split
// across several markdown paragraphs (blank-line-separated) instead of one
// unbroken block. A single multi-KB paragraph with no line-break
// opportunities pathologically stresses the browser's own text-layout/
// line-breaking pass (independently measured at over 1s for the 5MB
// fixture's single-paragraph form — dwarfing the extension's actual parse/
// sanitize work) in a way real technical documentation never does: even
// dense prose breaks every few sentences. Splitting preserves the same
// total text volume and heading/section count ("hundreds of headings,
// mostly text" per docs/specs/06-testing-quality-gate.md §1) while
// removing that unrepresentative layout cost.
const PARAGRAPH_BLOCK_COUNTS = [3, 3, 2, 2]; // sums to the original 10 LOREM blocks

function section(i) {
  const paragraphs = PARAGRAPH_BLOCK_COUNTS.map((count) =>
    Array.from({ length: count }, () => LOREM).join(' '),
  );
  const body = [
    `Paragraph ${i} with **bold**, *italic*, and \`inline code\`. ${paragraphs[0]}`,
    ...paragraphs.slice(1),
  ].join('\n\n');
  return [
    `## Section ${i}: heading with some text`,
    '',
    body,
    '',
    '| Col A | Col B | Col C |',
    '| --- | --- | --- |',
    `| ${i} | value | ${i * 2} |`,
    '',
    '```javascript',
    `function section${i}() {`,
    `  return ${i} * 2;`,
    '}',
    '```',
    '',
    `![diagram ${i}](https://example.com/img-${i}.png)`,
    '',
  ].join('\n');
}

function generate(targetBytes) {
  const parts = ['# Performance Fixture', ''];
  let size = parts.join('\n').length;
  let i = 0;
  while (size < targetBytes) {
    i++;
    const s = section(i);
    parts.push(s);
    size += s.length;
  }
  return parts.join('\n');
}

writeFileSync(path.join(outDir, 'perf-1mb.md'), generate(1_000_000), 'utf-8');
writeFileSync(path.join(outDir, 'perf-5mb.md'), generate(5_000_000), 'utf-8');
