// Vitest global setup: polyfills IndexedDB (jsdom has none) for the
// handoff store tests (ADR-0006). Individual test files stub `chrome.*`
// themselves since the shape needed varies per module under test.
import 'fake-indexeddb/auto';
