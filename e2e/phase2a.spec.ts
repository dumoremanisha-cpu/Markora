import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
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

async function getExtensionId(context: Awaited<ReturnType<typeof launchExtension>>) {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker.url().split('/')[2] as string;
}

async function dropFile(page: import('@playwright/test').Page, name: string, content: string) {
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
}

test.describe('Phase 2-A — deep-link URL fragment scrolls to and highlights a heading (F60)', () => {
  let server: http.Server;
  let baseUrl: string;
  const docBody = [
    '# Top',
    '',
    ...Array.from(
      { length: 80 },
      (_, n) =>
        `Filler paragraph number ${n}, with enough text to take up a full line of height.\n`,
    ),
    '## Target Heading',
    '',
    'Content under the target.',
  ].join('\n');

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/doc.md') {
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

  test('scrolls to and highlights the fragment heading on load', async () => {
    const context = await launchExtension();
    try {
      const page = await context.newPage();
      await page.goto(baseUrl + '/doc.md#heading-target-heading', { waitUntil: 'commit' });
      await page.waitForURL(/chrome-extension:\/\/.*\/viewer\/index\.html/, { timeout: 10_000 });
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });

      const target = page.locator('#heading-target-heading');
      await expect(target).toHaveClass(/markora-anchor-target/, { timeout: 2_000 });

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-A — syntax highlighting: copy button (F10)', () => {
  test('copies the code block text and shows a success toast', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      await dropFile(page, 'code.md', '```javascript\nconst x = 1;\n```');
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });

      await page.locator('.markora-code-block__copy-btn').click();
      await expect(page.getByText('Copied to clipboard')).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-A — sticky table headers (F26)', () => {
  test('wraps the table in a scroll container with a sticky header row', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      await dropFile(page, 'table.md', '| a | b |\n| - | - |\n| 1 | 2 |');
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });

      await expect(page.locator('.markora-table-wrap table')).toBeVisible();
      const position = await page
        .locator('.markora-table-wrap thead th')
        .first()
        .evaluate((el) => getComputedStyle(el).position);
      expect(position).toBe('sticky');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-A — selectable highlight theme loads on demand (F70)', () => {
  test('loads the configured theme stylesheet at boot', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.evaluate(async () => {
        await chrome.storage.local.set({
          'markora.settings': {
            theme: 'system',
            language: 'auto',
            licenseStatus: { tier: 'free' },
            extensionEnabled: true,
            markdown: {
              tables: true,
              footnotes: true,
              taskLists: true,
              definitionLists: true,
              frontMatter: true,
              containers: true,
              typographer: false,
              lineBreaks: false,
            },
            highlightTheme: 'monokai',
            codeLineNumbers: false,
            codeLineWrap: false,
            alertTitleMode: 'localized',
            externalLinkIndicator: true,
            externalLinkHoverPreview: false,
          },
        });
      });
      await page.reload();
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      const hasMonokaiStylesheet = await page.evaluate(() =>
        Array.from(document.styleSheets).some((sheet) => (sheet.href ?? '').includes('monokai')),
      );
      expect(hasMonokaiStylesheet).toBe(true);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-A — performance budgets (docs/specs/06-testing-quality-gate.md §1a)', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  let server: http.Server;
  let baseUrl: string;

  // P1/P2/P4 measure the extension's own render pipeline, not test-harness
  // overhead. Passing a multi-MB string as a page.evaluate() argument
  // forces Playwright to JSON-serialize it and ship it across the CDP
  // connection before the page ever sees it, adding real (if unintended)
  // latency that has nothing to do with the extension. Serving the fixture
  // over a local static server and having the page fetch() its own content
  // keeps the same real 'drop' event path while measuring only the
  // extension's own work, which is what P1/P2/P4 are specified to budget.
  // (Phase 9's investigation into a P2 failure found two more real
  // contributors, both fixed alongside this: an O(n) countWords() loop in
  // src/utils/textStats.ts that blocked the main thread for ~1.8s on a 5MB
  // document, and scripts/generate-perf-fixtures.mjs bulking each section's
  // prose into one unbroken multi-KB paragraph, which pathologically
  // stressed the browser's own text-layout pass in a way real prose —
  // which breaks every few sentences — never does.)
  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      const name = (req.url ?? '').replace(/^\//, '');
      try {
        const body = readFileSync(path.join(fixturesDir, name));
        res.writeHead(200, { 'Content-Type': 'text/markdown' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function dropFileFromUrl(page: import('@playwright/test').Page, name: string) {
    await page.evaluate(
      async ({ url, name }) => {
        const text = await fetch(url).then((r) => r.text());
        const file = new File([text], name, { type: 'text/markdown' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
        document.dispatchEvent(event);
      },
      { url: `${baseUrl}/${name}`, name },
    );
  }

  test('P1: first paint under 1s for the ~1MB fixture', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      const start = Date.now();
      await dropFileFromUrl(page, 'perf-1mb.md');
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 5_000,
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1_000);
    } finally {
      await context.close();
    }
  });

  test('P2: renders the ~5MB fixture in under 3s', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      const start = Date.now();
      await dropFileFromUrl(page, 'perf-5mb.md');
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3_000);
    } finally {
      await context.close();
    }
  });

  test('P4: no single load task exceeds 500ms while rendering the ~1MB fixture', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      await page.evaluate(() => {
        (window as unknown as { __longTasks: number[] }).__longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      });

      await dropFileFromUrl(page, 'perf-1mb.md');
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 5_000,
      });

      const longTasks = await page.evaluate(
        () => (window as unknown as { __longTasks: number[] }).__longTasks,
      );
      const worst = longTasks.length ? Math.max(...longTasks) : 0;
      expect(worst).toBeLessThan(500);
    } finally {
      await context.close();
    }
  });

  test('P13: opening and closing 20 documents in sequence returns the heap within 10% of baseline', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
      await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });

      const cdp = await context.newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      const measureHeap = async (): Promise<number> => {
        await cdp.send('HeapProfiler.collectGarbage');
        const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
        return usedSize;
      };

      // A moderate, varied ~50KB document per iteration — large enough that
      // a real per-document leak (a retained DOM tree, listener, or
      // annotation index) would show up, without the run taking minutes.
      const docFor = (n: number) =>
        Array.from(
          { length: 40 },
          (_, i) => `## Doc ${n} Section ${i}\n\nParagraph ${n}-${i} with some **bold** text.\n`,
        ).join('\n');

      async function drop(n: number): Promise<void> {
        await page.evaluate((content) => {
          const file = new File([content], `doc-${Date.now()}.md`, { type: 'text/markdown' });
          const dt = new DataTransfer();
          dt.items.add(file);
          const event = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          });
          document.dispatchEvent(event);
        }, docFor(n));
        await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
          timeout: 5_000,
        });
      }

      await drop(0);
      const baseline = await measureHeap();

      for (let i = 1; i <= 20; i++) {
        await drop(i);
      }
      const final = await measureHeap();

      const deltaPct = ((final - baseline) / baseline) * 100;
      console.log(
        `P13 heap: baseline=${(baseline / 1024 / 1024).toFixed(2)}MB final=${(final / 1024 / 1024).toFixed(2)}MB delta=${deltaPct.toFixed(1)}%`,
      );
      expect(Math.abs(deltaPct)).toBeLessThan(10);
    } finally {
      await context.close();
    }
  });
});
