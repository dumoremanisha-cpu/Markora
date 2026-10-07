// Shared placeholder markup emitted at parse time for diagram source
// (Mermaid, Graphviz, PlantUML). Rendering the actual diagram requires an
// engine that only runs against a live DOM (Mermaid) or a network round-trip
// (PlantUML), so parse time only ever emits an inert, sanitizer-safe
// placeholder holding the escaped source as plain text —
// src/viewer/mermaid/ and src/viewer/diagrams/{graphviz,plantuml}/ find
// these after the document is inserted and hydrate them (task 7: deferred,
// doesn't block first paint of surrounding text).
let counter = 0;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

export function buildDiagramPlaceholder(
  kind: 'mermaid' | 'graphviz' | 'plantuml',
  source: string,
): string {
  counter += 1;
  const id = `markora-diagram-${kind}-${counter}`;
  return (
    `<div class="markora-diagram markora-diagram--${kind}" data-diagram-kind="${kind}" data-diagram-id="${id}">` +
    `<pre class="markora-diagram__source" hidden>${escapeHtml(source)}</pre>` +
    `<div class="markora-diagram__placeholder" aria-hidden="true"></div>` +
    `</div>\n`
  );
}

/** Test-only: resets the id counter so snapshot-style assertions stay stable across test files. */
export function resetDiagramPlaceholderCounter(): void {
  counter = 0;
}
