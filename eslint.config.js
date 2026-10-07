// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import markora from './eslint-rules/no-literal-user-strings.js';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'spikes/**',
      'playwright-report/**',
      'test-results/**',
      // A vendored Google AI Studio prototype (React/Tailwind/lucide-react) —
      // the Ui-prompt.md visual design reference for Phase 10 UI polish, not
      // part of Markora's own vanilla-TS build or its lint/type contract.
      'referenece/UI/**',
      // Top-level frontend/ is a second copy of the same React design
      // reference (not src/frontend/, which is Markora's own real vanilla-TS
      // presentation code and IS linted normally) — its own separate React
      // project with its own node_modules, never part of Markora's build.
      'frontend/**',
    ],
  },
  {
    languageOptions: {
      globals: {
        chrome: 'readonly',
      },
    },
    rules: {},
  },
  {
    // One-off Node dev scripts (not shipped in the extension bundle) — need
    // Node globals, unlike everything under src/.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    // UI modules only (code-conventions.md §1) — src/backend (storage,
    // export, i18n, utils, background, content, the markdown/diagram
    // rendering pipeline) legitimately holds string literals (message
    // types, catalog keys, storage keys) that never reach a rendered DOM
    // sink. Covers both halves of what was one `src/viewer/**` before the
    // frontend/backend split: viewer/index.ts + autoRefresh.ts stayed at
    // src/viewer/ (page assembly), while viewer/markdown, viewer/annotations,
    // etc. moved to src/backend/viewer/ — both produce/inject DOM content
    // and need the same check the pre-split single glob already gave them.
    files: [
      'src/viewer/**/*.ts',
      'src/backend/viewer/**/*.ts',
      'src/popup/**/*.ts',
      'src/frontend/components/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    plugins: { markora },
    rules: {
      'markora/no-literal-user-strings': 'error',
    },
  },
);
