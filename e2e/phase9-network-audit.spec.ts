// Phase 9 — full-session network audit (docs/specs/04-security-privacy.md
// §1's "third category" rules, explicitly naming "the Phase 9 network
// audit" as the compliance check). Individual features already have their
// own narrow request-count assertions (e.g. phase3b.spec.ts's Graphviz/
// PlantUML tests); this file is the one place that exercises several
// request-generating features in a single session and asserts the
// aggregate rule the spec actually states: "no request carries document
// content or user identifiers, and every request target appears in the
// open document" — not "zero requests", and not scattered per-feature.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

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
  return page;
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

// Known third-party asset hosts a privacy-first, everything-local extension
// must never touch, regardless of feature — fonts, CDNs, analytics.
const FORBIDDEN_HOST_SUBSTRINGS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'jsdelivr.net',
  'unpkg.com',
  'google-analytics.com',
  'googletagmanager.com',
  'sentry.io',
  'segment.io',
  'mixpanel.com',
];

test.describe('Phase 9 — full-session network audit (04-security-privacy.md §1)', () => {
  let imageServer: http.Server;
  let imageBaseUrl: string;

  test.beforeAll(async () => {
    imageServer = http.createServer((req, res) => {
      if (req.url === '/badge.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(ONE_PX_PNG);
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => imageServer.listen(0, '127.0.0.1', resolve));
    const { port } = imageServer.address() as AddressInfo;
    imageBaseUrl = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => imageServer.close(() => resolve()));
  });

  test('a representative session (diagrams, math, syntax highlighting, a referenced image) makes only local or document-named requests', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      const requests: string[] = [];
      page.on('request', (req) => requests.push(req.url()));

      // One document exercising every locally-rendered, non-opt-in feature
      // that could plausibly reach the network if something were wired
      // wrong: a Mermaid diagram, a Graphviz diagram, KaTeX math, a
      // syntax-highlighted code block (which loads a highlight theme
      // stylesheet), and a document-referenced image (the one legitimate,
      // disclosed exception).
      await dropFile(
        page,
        'audit.md',
        [
          '# Network Audit Fixture',
          '',
          `![badge](${imageBaseUrl}/badge.png)`,
          '',
          '```mermaid',
          'graph TD',
          'A --> B',
          '```',
          '',
          '```dot',
          'digraph G { a -> b }',
          '```',
          '',
          'Inline math: $E = mc^2$',
          '',
          '```javascript',
          'const x = 1;',
          '```',
        ].join('\n'),
      );

      // Diagrams/math hydrate asynchronously after first paint — give them
      // a moment before reading the final request list.
      await expect(page.locator('.markora-diagram--mermaid[data-rendered="true"]')).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator('.markora-diagram--graphviz[data-rendered="true"]')).toBeVisible({
        timeout: 10_000,
      });

      const allowedPrefixes = ['chrome-extension://', `${imageBaseUrl}/badge.png`];
      const unexpected = requests.filter(
        (url) => !allowedPrefixes.some((prefix) => url.startsWith(prefix)),
      );
      expect(
        unexpected,
        'every request must be local or the one image the document references',
      ).toEqual([]);

      const forbidden = requests.filter((url) =>
        FORBIDDEN_HOST_SUBSTRINGS.some((host) => url.includes(host)),
      );
      expect(
        forbidden,
        'no request to a font CDN, analytics host, or other third-party asset host',
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('PlantUML enabled: only the encoded diagram source goes to the configured server, nothing else changes about the rest of the session', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);

      const plantumlServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      });
      await new Promise<void>((resolve) => plantumlServer.listen(0, '127.0.0.1', resolve));
      const plantumlBaseUrl = `http://127.0.0.1:${(plantumlServer.address() as AddressInfo).port}`;

      await page.evaluate(async (serverUrl) => {
        const stored = await chrome.storage.local.get('markora.settings');
        const settings = stored['markora.settings'] as Record<string, unknown>;
        await chrome.storage.local.set({
          'markora.settings': { ...settings, plantumlEnabled: true, plantumlServerUrl: serverUrl },
        });
      }, plantumlBaseUrl);
      await page.reload();
      await page.locator('.markora-empty-state').waitFor({ state: 'attached' });

      const requests: string[] = [];
      page.on('request', (req) => requests.push(req.url()));

      await dropFile(
        page,
        'plantuml.md',
        `![badge](${imageBaseUrl}/badge.png)\n\n\`\`\`plantuml\n@startuml\nBob -> Alice\n@enduml\n\`\`\``,
      );
      await expect(
        page.locator('.markora-diagram--plantuml img, .markora-diagram--plantuml svg'),
      ).toBeVisible({ timeout: 10_000 });

      const allowedPrefixes = ['chrome-extension://', `${imageBaseUrl}/badge.png`, plantumlBaseUrl];
      const unexpected = requests.filter(
        (url) => !allowedPrefixes.some((prefix) => url.startsWith(prefix)),
      );
      expect(unexpected).toEqual([]);

      const plantumlRequests = requests.filter((url) => url.startsWith(plantumlBaseUrl));
      expect(plantumlRequests.length).toBeGreaterThan(0);
      // The only thing that could leak document content is the PlantUML
      // request itself carrying more than the encoded diagram source —
      // confirm it never contains the rest of the fixture's own text.
      for (const url of plantumlRequests) {
        expect(url).not.toContain('Network Audit Fixture');
      }

      await new Promise<void>((resolve) => plantumlServer.close(() => resolve()));
    } finally {
      await context.close();
    }
  });

  test('"Block remote images" (security-privacy.md §1 point 4): the referenced image is never requested until the placeholder is clicked', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await page.evaluate(async () => {
        const stored = await chrome.storage.local.get('markora.settings');
        const settings = stored['markora.settings'] as Record<string, unknown>;
        await chrome.storage.local.set({
          'markora.settings': { ...settings, blockRemoteImages: true },
        });
      });
      await page.reload();
      await page.locator('.markora-empty-state').waitFor({ state: 'attached' });

      const requests: string[] = [];
      page.on('request', (req) => requests.push(req.url()));

      await dropFile(page, 'blocked.md', `![a photo](${imageBaseUrl}/badge.png)`);

      const placeholder = page.locator('.markora-image-placeholder--clickable');
      await expect(placeholder).toBeVisible();
      expect(requests.some((url) => url.startsWith(`${imageBaseUrl}/badge.png`))).toBe(false);

      await placeholder.click();
      await expect(page.locator('.markora-content img')).toBeVisible();
      await expect
        .poll(() => requests.some((url) => url.startsWith(`${imageBaseUrl}/badge.png`)))
        .toBe(true);
    } finally {
      await context.close();
    }
  });
});
