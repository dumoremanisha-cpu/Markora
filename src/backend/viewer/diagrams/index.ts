// Graphviz (WASM, fully offline) + PlantUML (opt-in remote-render) adapters
// (Phase 3-B, F13/F14, ADR-0002). Re-exported from one module so
// src/viewer/index.ts can hydrate both with a single dynamic import, the
// same lazy-load shape Phase 3-A's Mermaid/math adapters use — neither
// submodule's heavy work (the WASM Graphviz load, the PlantUML fetch) runs
// just because this wrapper module was imported; each only fires once its
// own hydrate function finds a matching placeholder.
export { renderGraphvizIn } from './graphviz';
export { renderPlantumlIn } from './plantuml';
export type { PlantumlRenderOptions } from './plantuml';
