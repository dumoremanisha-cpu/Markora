import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spikesDir = path.resolve(__dirname, '..', 'spikes');

async function launchSpike(extensionDir: string) {
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--headless=new',
    ],
  });
}

test.describe('Spike 1 — CSP + WASM under extension_pages CSP', () => {
  test('a WASM module compiles, instantiates, and runs with zero CSP violations', async () => {
    const context = await launchSpike(path.join(spikesDir, 'spike1-csp-wasm'));
    try {
      let [worker] = context.serviceWorkers();
      if (!worker) worker = await context.waitForEvent('serviceworker');
      const extensionId = worker.url().split('/')[2];

      const page = await context.newPage();
      const cspViolations: string[] = [];
      page.on('console', (msg) => {
        if (/content security policy/i.test(msg.text())) cspViolations.push(msg.text());
      });

      await page.goto(`chrome-extension://${extensionId}/wasm.html`);
      await expect(page.locator('#result')).toHaveText('wasm-ok:5', { timeout: 5000 });
      expect(cspViolations).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Spike 2 — Mermaid under strict CSP (no unsafe-eval/unsafe-inline)', () => {
  test('renders a diagram to SVG with zero CSP violations', async () => {
    const context = await launchSpike(path.join(spikesDir, 'spike2-mermaid-csp'));
    try {
      let [worker] = context.serviceWorkers();
      if (!worker) worker = await context.waitForEvent('serviceworker');
      const extensionId = worker.url().split('/')[2];

      const page = await context.newPage();
      const cspViolations: string[] = [];
      const pageErrors: string[] = [];
      page.on('console', (msg) => {
        if (/content security policy/i.test(msg.text())) cspViolations.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(`chrome-extension://${extensionId}/mermaid.html`);
      await expect(page).toHaveTitle('mermaid-ok', { timeout: 10_000 });
      const svgCount = await page.locator('#diagram svg').count();
      expect(svgCount).toBe(1);
      expect(cspViolations).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Spike 5 — content-script → viewer handoff (ADR-0006 §2)', () => {
  let server: http.Server;
  let baseUrl: string;
  const bigText = 'A'.repeat(5 * 1024 * 1024); // ~5 MB

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/favicon.ico') {
        res.writeHead(204).end();
        return;
      }
      if (req.url?.startsWith('/before')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>before page</body></html>');
        return;
      }
      if (req.url?.startsWith('/source')) {
        // Chrome renders text/plain inside a single <pre> — the same DOM
        // shape ADR-0006 §2 says the content script reads from.
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(bigText);
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('round-trips a ~5MB payload, preserves the hash, and Back skips the source', async () => {
    const context = await launchSpike(path.join(spikesDir, 'spike5-handoff'));
    try {
      const page = await context.newPage();

      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(baseUrl + '/before', { waitUntil: 'commit' });
      await page.goto(baseUrl + '/source#section-2', { waitUntil: 'commit' });
      await page.waitForURL(/chrome-extension:\/\/.*\/viewer\.html/, { timeout: 10_000 });
      expect(pageErrors, pageErrors.join('\n')).toEqual([]);
      expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);

      // (a) ~5MB payload survives the round-trip.
      await expect(page.locator('#status')).toHaveText('ok');
      await expect(page.locator('#length')).toHaveText(String(bigText.length));

      // (b) location.hash is preserved.
      await expect(page.locator('#hash')).toHaveText('#section-2');
      expect(page.url()).toContain('#section-2');

      const viewerUrl = page.url();

      // (c) Back returns to the previous site, not to /source (location.replace
      // removed /source from the history stack rather than adding to it).
      await page.goBack();
      expect(page.url()).toBe(baseUrl + '/before');

      // Single-use: reloading the same viewer URL finds the record already deleted.
      await page.goto(viewerUrl);
      await expect(page.locator('#status')).toHaveText('no-record');
    } finally {
      await context.close();
    }
  });

  test('an abandoned handoff record is TTL-swept, not left at rest', async () => {
    const context = await launchSpike(path.join(spikesDir, 'spike5-handoff'));
    try {
      const first = await context.newPage();
      await first.goto(baseUrl + '/source', { waitUntil: 'commit' });
      await first.waitForURL(/chrome-extension:\/\/.*\/viewer\.html/, { timeout: 10_000 });
      const abandonedUrl = first.url(); // never read by the viewer — simulates a dropped navigation

      // Wait past the spike's 2s TTL, then create a second handoff record.
      // background.js runs sweepExpired() before every new handoff/create,
      // the same point ADR-0006 §2 specifies ("swept ... at service worker
      // start-up"), which this exercises indirectly via a live worker.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const second = await context.newPage();
      await second.goto(baseUrl + '/source', { waitUntil: 'commit' });
      await second.waitForURL(/chrome-extension:\/\/.*\/viewer\.html/, { timeout: 10_000 });

      const revisit = await context.newPage();
      await revisit.goto(abandonedUrl);
      await expect(revisit.locator('#status')).toHaveText('no-record');
    } finally {
      await context.close();
    }
  });
});

test.describe('Spike 4 — content-script path-glob matching', () => {
  let server: http.Server;
  let baseUrl: string;

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`served ${req.url}`);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('injects only into URLs whose path ends in .md', async () => {
    const context = await launchSpike(path.join(spikesDir, 'spike4-glob-match'));
    try {
      // NOTE: Chrome match patterns glob the path component against
      // pathname + search combined, not pathname alone — so a query string
      // ending in ".md" also matches, even though the resource is not
      // Markdown. Confirmed here; ADR-0001/Phase 1 must re-check
      // `location.pathname` (not rely on the manifest match alone) before
      // treating a navigation as Markdown.
      const cases: Array<[string, boolean]> = [
        ['/doc.md', true],
        ['/doc.markdown', false],
        ['/index.html', false],
        ['/doc.md.html', false],
        ['/doc.html?x=.md', true],
        ['/nested/path/readme.md', true],
      ];
      for (const [urlPath, shouldMatch] of cases) {
        const page = await context.newPage();
        await page.goto(baseUrl + urlPath);
        const injected = await page.evaluate(() =>
          document.documentElement.hasAttribute('data-markora-spike4-injected'),
        );
        expect(injected, `${urlPath} injected=${injected}, expected=${shouldMatch}`).toBe(
          shouldMatch,
        );
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
});
