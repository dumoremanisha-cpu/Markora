import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // viewer.html and onboarding.html are each reached only by a
      // programmatic chrome.tabs.create()/location.replace() (ADR-0006 §2;
      // Phase 10's onInstalled handler), never through a manifest field
      // crxjs scans for HTML entries (action.default_popup, options_page,
      // etc.) — so both must be declared as build inputs explicitly, or
      // Vite ships them un-transformed (raw "<script src="./index.ts">",
      // 404s at runtime).
      input: {
        viewer: fileURLToPath(new URL('./src/viewer/index.html', import.meta.url)),
        onboarding: fileURLToPath(new URL('./src/onboarding/index.html', import.meta.url)),
      },
    },
  },
});
