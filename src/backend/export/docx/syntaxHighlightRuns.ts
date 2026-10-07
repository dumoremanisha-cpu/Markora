// Turns highlight.js's `<span class="hljs-xxx">...</span>`-nested HTML
// output (src/viewer/syntax/highlight.ts) into flat text+style runs for
// DOCX code blocks — a small dedicated parser rather than a DOM/innerHTML
// round-trip, since highlight.js's output is a narrow, predictable subset of
// HTML (nested `<span class="...">`, escaped entities, no other tags) that a
// short stack-based scan handles directly.
import { syntaxRunStyle } from './syntaxColors';
import type { SyntaxRunStyle } from './syntaxColors';

export interface HighlightedTextRun {
  text: string;
  style: SyntaxRunStyle;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function mergeStyles(stack: SyntaxRunStyle[]): SyntaxRunStyle {
  const merged: SyntaxRunStyle = {};
  for (const style of stack) {
    if (style.color) merged.color = style.color;
    if (style.italic) merged.italic = true;
    if (style.bold) merged.bold = true;
  }
  return merged;
}

/** Parses highlight.js's highlighted HTML into flat `{text, style}` runs, one per contiguous same-style span. Never throws — malformed/unexpected markup degrades to plain unstyled text rather than losing code content. */
export function parseHighlightedHtml(html: string): HighlightedTextRun[] {
  const runs: HighlightedTextRun[] = [];
  const styleStack: SyntaxRunStyle[] = [];
  let i = 0;
  let textBuffer = '';

  function flushText(): void {
    if (textBuffer.length === 0) return;
    runs.push({ text: decodeEntities(textBuffer), style: mergeStyles(styleStack) });
    textBuffer = '';
  }

  const spanOpenRe = /^<span class="([^"]*)">/;
  while (i < html.length) {
    if (html[i] === '<') {
      const rest = html.slice(i);
      const openMatch = spanOpenRe.exec(rest);
      if (openMatch) {
        flushText();
        const classes = openMatch[1]?.split(/\s+/) ?? [];
        const style: SyntaxRunStyle = {};
        for (const cls of classes) Object.assign(style, syntaxRunStyle(cls));
        styleStack.push(style);
        i += openMatch[0].length;
        continue;
      }
      if (rest.startsWith('</span>')) {
        flushText();
        styleStack.pop();
        i += '</span>'.length;
        continue;
      }
    }
    textBuffer += html[i];
    i++;
  }
  flushText();
  return runs;
}
