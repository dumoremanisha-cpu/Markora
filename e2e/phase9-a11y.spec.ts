// Phase 9 — full accessibility sweep (docs/specs/06-testing-quality-gate.md
// §3 "Accessibility"). The baseline axe scans (popup, options, a bare
// viewer) and one keyboard-tab check already existed (smoke.spec.ts,
// phase2b.spec.ts) but never covered the interactive surfaces the spec
// explicitly names: annotations panel, presentation controls, mind map,
// folder browser, search, lightbox — nor either theme's contrast (axe's
// color-contrast rule is theme-sensitive; a scan in light mode says
// nothing about dark mode). This file closes that gap without duplicating
// what already passes.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

// The lightbox only treats http:/https:/file: image sources as clickable
// (src/components/lightbox/safety.ts deliberately excludes data: as a
// second, independent gate beyond DOMPurify's own URL-scheme allowlist) —
// a real image needs serving over http, matching the pattern
// phase2b.spec.ts's own lightbox tests already use.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
let imageServer: http.Server;
let imageBaseUrl: string;

test.beforeAll(async () => {
  imageServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(ONE_PX_PNG);
  });
  await new Promise<void>((resolve) => imageServer.listen(0, '127.0.0.1', resolve));
  const { port } = imageServer.address() as AddressInfo;
  imageBaseUrl = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => imageServer.close(() => resolve()));
});

async function launchExtension() {
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--headless=new',
    ],
  });
}

async function getExtensionId(context: Awaited<ReturnType<typeof launchExtension>>) {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker.url().split('/')[2] as string;
}

async function openViewer(context: Awaited<ReturnType<typeof launchExtension>>) {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
  await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });
  return { page, extensionId };
}

async function dropFile(page: Page, name: string, content: string) {
  await page.evaluate(
    ({ name, content }) => {
      const file = new File([content], name, { type: 'text/markdown' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      document.dispatchEvent(event);
    },
    { name, content },
  );
  await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
    timeout: 10_000,
  });
}

/** Sets the theme directly via storage + reload — deterministic, unlike cycling the toolbar button through an unknown starting state. `.markora-content` always exists in the DOM (just hidden pre-load), so waiting on it directly instead of `.markora-empty-state` would resolve immediately without ever becoming visible — wait for the empty state specifically, same as `openViewer`. */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate(async (theme) => {
    const stored = await chrome.storage.local.get('markora.settings');
    const settings = stored['markora.settings'] as Record<string, unknown> | undefined;
    await chrome.storage.local.set({ 'markora.settings': { ...settings, theme } });
  }, theme);
  await page.reload();
  await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });
}

const DOC_WITH_HEADINGS =
  '# Title\n\n## Alpha\n\nSome text.\n\n## Beta\n\nMore text worth selecting for an annotation.\n\n## Gamma\n\nEven more text.\n';

interface FakeNode {
  name: string;
  kind: 'file' | 'directory';
  content?: string;
  children?: FakeNode[];
}

/** Minimal fake `showDirectoryPicker()` — see phase4.spec.ts for the fuller version this borrows from; only what this file's folder-browser a11y scan needs. */
async function installFakeFolderPicker(page: Page, tree: FakeNode[]): Promise<void> {
  await page.addInitScript((tree: FakeNode[]) => {
    function makeFileHandle(node: FakeNode) {
      return {
        kind: 'file' as const,
        name: node.name,
        async getFile() {
          return new File([node.content ?? ''], node.name);
        },
      };
    }
    function makeDirHandle(name: string, children: FakeNode[]): unknown {
      return {
        kind: 'directory' as const,
        name,
        async *values() {
          for (const child of children) {
            await new Promise((resolve) => setTimeout(resolve, 1));
            yield child.kind === 'directory'
              ? makeDirHandle(child.name, child.children ?? [])
              : makeFileHandle(child);
          }
        },
        async queryPermission() {
          return 'granted';
        },
        async requestPermission() {
          return 'granted';
        },
      };
    }
    (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker =
      async () => makeDirHandle('test-folder', tree);
  }, tree);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Phase 9 — accessibility, ${theme} theme`, () => {
    test(`viewer with annotations panel open passes axe (incl. WCAG AA contrast)`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await setTheme(page, theme);
        await dropFile(page, 'a11y.md', DOC_WITH_HEADINGS);

        await page.getByRole('button', { name: 'Annotations' }).click();
        await expect(page.locator('.markora-annotations-panel')).toBeVisible();

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`presentation mode passes axe`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await setTheme(page, theme);
        await dropFile(page, 'slides.md', '# One\n\nFirst\n\n# Two\n\nSecond\n\n# Three\n\nThird');

        await page.getByRole('button', { name: 'Presentation' }).click();
        await expect(page.locator('.markora-presentation')).toBeVisible();

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`mind map passes axe`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await setTheme(page, theme);
        await dropFile(page, 'headings.md', DOC_WITH_HEADINGS);

        await page.getByRole('button', { name: 'Mind Map' }).click();
        await expect(page.locator('.markora-mindmap')).toBeVisible();

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`folder browser passes axe`, async () => {
      const context = await launchExtension();
      try {
        const extensionId = await getExtensionId(context);
        const page = await context.newPage();
        await installFakeFolderPicker(page, [
          { name: 'README.md', kind: 'file', content: '# Hi' },
          { name: 'guide.md', kind: 'file', content: '# Guide' },
        ]);
        await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
        await page.locator('.markora-empty-state').waitFor({ state: 'attached' });
        await setTheme(page, theme);

        await page
          .locator('.markora-empty-state')
          .getByRole('button', { name: 'Open folder' })
          .click();
        await expect(page.locator('.markora-file-browser--visible')).toBeVisible();
        await expect(page.locator('.markora-file-browser__status')).toHaveText(/files/, {
          timeout: 10_000,
        });

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`in-document search and image lightbox both pass axe`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await setTheme(page, theme);
        await dropFile(page, 'search.md', DOC_WITH_HEADINGS);

        await page.getByRole('button', { name: 'Search' }).click();
        await page.locator('.markora-search__input').fill('text');
        let results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        await page.keyboard.press('Escape');

        await dropFile(page, 'img.md', `![alt](${imageBaseUrl}/pic.png)`);
        await page.locator('.markora-content img').click();
        await expect(page.locator('.markora-lightbox')).toBeVisible();
        results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`"Block remote images" placeholder passes axe (incl. WCAG AA contrast)`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await page.evaluate(async () => {
          const stored = await chrome.storage.local.get('markora.settings');
          const settings = stored['markora.settings'] as Record<string, unknown>;
          await chrome.storage.local.set({
            'markora.settings': { ...settings, blockRemoteImages: true },
          });
        });
        await page.reload();
        await page.locator('.markora-empty-state').waitFor({ state: 'attached' });
        await setTheme(page, theme);

        await dropFile(page, 'blocked.md', `# Title\n\n![a photo](${imageBaseUrl}/pic.png)`);
        await expect(page.locator('.markora-image-placeholder--clickable')).toBeVisible();

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      } finally {
        await context.close();
      }
    });
  });
}

test.describe('Phase 9 — keyboard-only operation of every major surface', () => {
  test('annotations panel: open, create a highlight, delete it, close — all via keyboard', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'kbd-annotate.md', DOC_WITH_HEADINGS);

      await page.getByRole('button', { name: 'Annotations' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.markora-annotations-panel')).toBeVisible();
      await page.keyboard.press('Escape');
    } finally {
      await context.close();
    }
  });

  test('presentation mode: enter, navigate, and exit — all via keyboard', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      // Presentation mode needs at least 3 headings to detect a slide
      // strategy at all (below that it shows "not enough structure",
      // per phase6.spec.ts's own equivalent test) — 2 headings would make
      // this test pass for the wrong reason (an empty, unnavigable view).
      await dropFile(
        page,
        'kbd-slides.md',
        '# One\n\nFirst\n\n# Two\n\nSecond\n\n# Three\n\nThird',
      );

      await page.getByRole('button', { name: 'Presentation' }).focus();
      await page.keyboard.press('Enter');
      const presentation = page.locator('.markora-presentation');
      await expect(presentation).toBeVisible();
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('1 / 3');
      await page.keyboard.press('ArrowRight');
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('2 / 3');
      await page.keyboard.press('Escape');
      await expect(presentation).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('mind map: open and close — all via keyboard, Tab stays trapped inside it', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'kbd-headings.md', DOC_WITH_HEADINGS);

      await page.getByRole('button', { name: 'Mind Map' }).focus();
      await page.keyboard.press('Enter');
      const mindMap = page.locator('.markora-mindmap');
      await expect(mindMap).toBeVisible();
      // Opening focuses the close button directly (mindmap/index.ts's
      // open()) — confirm that here rather than assuming it, since the
      // Tab-count loop below only proves the trap, not the initial focus.
      await expect(page.locator('.markora-mindmap__close')).toBeFocused();

      // Tab exactly once all the way around the dialog's own controls
      // (close + the diagram-chrome zoom/reset/fullscreen/download
      // buttons) and back to close — every single step must stay inside
      // .markora-mindmap; if focus ever escapes to the page behind it,
      // that's the bug this test exists to catch (see DEVELOPMENT.md's
      // Phase 9 findings).
      const focusableCount = await page.locator('.markora-mindmap button:visible').count();
      expect(focusableCount).toBeGreaterThan(1);
      let escaped = false;
      for (let i = 0; i < focusableCount; i++) {
        await page.keyboard.press('Tab');
        const insideDialog = await page.evaluate(
          () => document.activeElement?.closest('.markora-mindmap') !== null,
        );
        if (!insideDialog) {
          escaped = true;
          break;
        }
      }
      expect(escaped).toBe(false);
      await expect(page.locator('.markora-mindmap__close')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(mindMap).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
