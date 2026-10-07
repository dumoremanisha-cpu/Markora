import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

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

test.describe('Phase 1 — remote raw-host detection & handoff (ADR-0001 §2, ADR-0006 §2)', () => {
  let server: http.Server;
  let baseUrl: string;
  const requestLog: string[] = [];
  const docBody = '# Hello Markora\n\nA paragraph.';

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      requestLog.push(req.url ?? '');
      if (req.url === '/favicon.ico') {
        res.writeHead(204).end();
        return;
      }
      if (req.url === '/README.md') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(docBody);
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('detects, hands off, renders, never re-fetches the source, and is single-use', async () => {
    const context = await launchExtension();
    try {
      const page = await context.newPage();
      requestLog.length = 0;

      await page.goto(baseUrl + '/README.md', { waitUntil: 'commit' });
      await page.waitForURL(/chrome-extension:\/\/.*\/viewer\/index\.html/, { timeout: 10_000 });

      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      await expect(page.locator('.markora-content h1')).toHaveText('Hello Markora');

      // No re-fetch of the source URL by the extension (ADR-0006 §2).
      const readmeRequests = requestLog.filter((u) => u === '/README.md');
      expect(readmeRequests.length).toBe(1);

      // Single-use: revisiting the same viewer URL finds the record gone.
      const viewerUrl = page.url();
      await page.goto(viewerUrl);
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'no-record', {
        timeout: 10_000,
      });
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 1 — drag-and-drop (F06)', () => {
  test('loads a dropped Markdown file into the viewer', async () => {
    const context = await launchExtension();
    try {
      let [worker] = context.serviceWorkers();
      if (!worker) worker = await context.waitForEvent('serviceworker');
      const extensionId = worker.url().split('/')[2];

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      await page.evaluate(() => {
        const file = new File(['# Dropped\n\nContent.'], 'dropped.md', { type: 'text/markdown' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
        document.dispatchEvent(event);
      });

      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      await expect(page.locator('.markora-content h1')).toHaveText('Dropped');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 1 — master enable toggle (F54)', () => {
  test('viewer no-ops cleanly (no partial render) when disabled', async () => {
    const context = await launchExtension();
    try {
      let [worker] = context.serviceWorkers();
      if (!worker) worker = await context.waitForEvent('serviceworker');
      const extensionId = worker.url().split('/')[2];

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.evaluate(async () => {
        await chrome.storage.local.set({
          'markora.settings': {
            theme: 'system',
            language: 'auto',
            licenseStatus: { tier: 'free' },
            extensionEnabled: false,
          },
        });
      });

      await page.reload();
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'disabled', {
        timeout: 10_000,
      });
      expect(await page.locator('.markora-toolbar').count()).toBe(0);
      expect(await page.locator('.markora-empty-state').count()).toBe(0);
    } finally {
      await context.close();
    }
  });
});
