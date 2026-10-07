// highlight.js integration (F10). Uses the full `highlight.js` package
// (all ~190 bundled languages) rather than `lib/core` + a curated per-
// language subset: highlight.js's subpath exports (`lib/core`,
// `lib/languages/*`) have no per-file `.d.ts`, only an ambient wildcard
// declaration inside the package's main `types/index.d.ts` — which this
// project's tsconfig has no guaranteed path to load unless something also
// imports the bare `highlight.js` specifier. Importing the full package
// sidesteps that fragility and, incidentally, satisfies the spec's "180+
// languages total via the chosen highlighter library" more literally than a
// curated subset would.
//
// Language is taken from the fence's declared info string only — never
// content-based auto-detection (`hljs.highlightAuto`), which would run a
// multi-language trial on every fenced block and put budgets P1/P2
// (`docs/specs/06-testing-quality-gate.md` §1a) at risk on documents with
// many undeclared-language code blocks.
import hljs from 'highlight.js';

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  csharp: 'C#',
  cs: 'C#',
  php: 'PHP',
  go: 'Go',
  golang: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  ruby: 'Ruby',
  rb: 'Ruby',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  swift: 'Swift',
  sql: 'SQL',
  bash: 'Bash',
  sh: 'Bash',
  shell: 'Bash',
  zsh: 'Bash',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  svg: 'XML',
  css: 'CSS',
  scss: 'SCSS',
  markdown: 'Markdown',
  md: 'Markdown',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  scala: 'Scala',
  dart: 'Dart',
  plaintext: 'Plain text',
  text: 'Plain text',
};

export function languageLabel(languageKey: string | null): string {
  if (!languageKey) return '';
  return LANGUAGE_LABELS[languageKey] ?? languageKey.toUpperCase();
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

export interface HighlightOutcome {
  html: string;
  languageKey: string | null;
}

/** Highlights `code` as `lang` when highlight.js recognizes it; otherwise returns escaped plain text. */
export function highlightCode(code: string, lang: string | undefined): HighlightOutcome {
  const normalized = lang?.trim().toLowerCase() ?? '';
  if (normalized && hljs.getLanguage(normalized)) {
    try {
      const result = hljs.highlight(code, { language: normalized, ignoreIllegals: true });
      return { html: result.value, languageKey: normalized };
    } catch {
      // Falls through to plain escaping below.
    }
  }
  return { html: escapeHtml(code), languageKey: null };
}
