// F79: `:::mermaid ... :::` as an alternative delimiter to the ```mermaid```
// fence (ADR-0002). Deliberately a dedicated block rule rather than a
// markdown-it-container instance (see ./containers.ts) — markdown-it-
// container parses its body as nested Markdown, which would mangle Mermaid
// syntax (`-->`, `|label|`, etc.); this rule instead treats the body as
// literal text, exactly like a fenced code block.
import type { MarkdownIt, StateBlock } from 'markdown-it';
import { buildDiagramPlaceholder } from './diagramPlaceholder';

const MARKER = ':::';

function mermaidContainerRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  let pos = state.bMarks[startLine]! + state.tShift[startLine]!;
  let max = state.eMarks[startLine]!;

  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  if (pos + MARKER.length > max) return false;
  if (state.src.slice(pos, pos + MARKER.length) !== MARKER) return false;
  pos += MARKER.length;

  const params = state.src.slice(pos, max).trim();
  if (params.split(/\s+/)[0] !== 'mermaid') return false;

  if (silent) return true;

  let nextLine = startLine;
  let haveEndMarker = false;
  for (;;) {
    nextLine++;
    if (nextLine >= endLine) break;
    pos = state.bMarks[nextLine]! + state.tShift[nextLine]!;
    max = state.eMarks[nextLine]!;
    if (pos < max && state.sCount[nextLine]! < state.blkIndent) break;
    if (state.src.slice(pos, max).trim() === MARKER) {
      haveEndMarker = true;
      break;
    }
  }

  const indent = state.sCount[startLine]!;
  state.line = nextLine + (haveEndMarker ? 1 : 0);

  const token = state.push('mermaid_container', 'div', 0);
  token.content = state.getLines(startLine + 1, nextLine, indent, true);
  token.map = [startLine, state.line];
  return true;
}

export function registerMermaidContainer(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'mermaid_container', mermaidContainerRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.mermaid_container = (tokens, idx) =>
    buildDiagramPlaceholder('mermaid', tokens[idx]!.content);
}
