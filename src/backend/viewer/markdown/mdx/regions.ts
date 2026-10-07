// Protects fenced code blocks, inline code spans, and math delimiters from
// the MDX pre-parse transform (ADR-0008 §3: "Applied outside fenced code
// blocks, inline code spans, and math delimiters — those regions are
// extracted and restored verbatim"). A line-based scanner rather than one
// monolithic regex, since fence markers vary in length/character and must
// be matched against their own closing fence, not a generic pattern.
const PLACEHOLDER_PREFIX = ' MKREGION';
const PLACEHOLDER_SUFFIX = ' ';
const PLACEHOLDER_RE = / MKREGION(\d+) /g;

export interface ProtectedRegions {
  /** Source text with protected regions replaced by placeholder tokens. */
  text: string;
  /** Restores placeholder tokens in (possibly further-transformed) text back to their original content. */
  restore(text: string): string;
}

function extractFences(source: string, store: string[]): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (!open) {
      out.push(line);
      i++;
      continue;
    }
    const fenceChar = open[1]?.[0] ?? '`';
    const fenceLen = open[1]?.length ?? 3;
    const block: string[] = [line];
    i++;
    while (i < lines.length) {
      const current = lines[i] ?? '';
      block.push(current);
      const close = /^ {0,3}(`{3,}|~{3,}) *$/.exec(current);
      i++;
      if (close && close[1]?.[0] === fenceChar && (close[1]?.length ?? 0) >= fenceLen) break;
    }
    store.push(block.join('\n'));
    out.push(`${PLACEHOLDER_PREFIX}${store.length - 1}${PLACEHOLDER_SUFFIX}`);
  }
  return out.join('\n');
}

/** Extracts fenced code, inline code spans, and $/$$ math so the MDX transform never rewrites their contents. */
export function extractProtectedRegions(source: string): ProtectedRegions {
  const store: string[] = [];
  let text = extractFences(source, store);

  text = text.replace(/`[^`\n]*`/g, (match) => {
    store.push(match);
    return `${PLACEHOLDER_PREFIX}${store.length - 1}${PLACEHOLDER_SUFFIX}`;
  });

  text = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, (match) => {
    store.push(match);
    return `${PLACEHOLDER_PREFIX}${store.length - 1}${PLACEHOLDER_SUFFIX}`;
  });

  return {
    text,
    restore(input: string): string {
      return input.replace(PLACEHOLDER_RE, (_match, index: string) => store[Number(index)] ?? '');
    },
  };
}
