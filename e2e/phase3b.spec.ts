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

async function openViewer(context: Awaited<ReturnType<typeof launchExtension>>) {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
  await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });
  return page;
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
  await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
    timeout: 10_000,
  });
}

async function readStoredSetting<T>(
  page: import('@playwright/test').Page,
  key: string,
): Promise<T> {
  return page.evaluate(async (key) => {
    const stored = await chrome.storage.local.get('markora.settings');
    return (stored['markora.settings'] as Record<string, unknown>)[key];
  }, key) as Promise<T>;
}

async function enablePlantuml(
  context: Awaited<ReturnType<typeof launchExtension>>,
  serverUrl: string,
) {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
  await page.getByRole('tab', { name: 'Privacy' }).click();

  // The two controls below each call the typed storage wrapper's
  // setSettings() independently, which reads-then-writes the whole settings
  // object rather than patching atomically — firing both close together (as
  // a scripted `.fill()` immediately followed by `.check()` can) risks the
  // second write's read racing ahead of the first write's completion and
  // silently reverting it. Confirming each one has actually persisted
  // before triggering the next avoids that race.
  await page.getByLabel('PlantUML server URL').fill(serverUrl);
  await page.getByLabel('PlantUML server URL').press('Tab');
  await expect.poll(() => readStoredSetting<string>(page, 'plantumlServerUrl')).toBe(serverUrl);

  await page.getByRole('checkbox', { name: 'Enable PlantUML rendering' }).check();
  await expect.poll(() => readStoredSetting<boolean>(page, 'plantumlEnabled')).toBe(true);
  await expect.poll(() => readStoredSetting<string>(page, 'plantumlServerUrl')).toBe(serverUrl);

  await page.close();
}

test.describe('Phase 3-B — Graphviz diagrams (F13)', () => {
  test('renders a ```dot fence with full chrome: zoom, reset, fullscreen, download', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'diagram.md', '```dot\ndigraph G {\n  a -> b\n}\n```');

      const diagram = page.locator('.markora-diagram--graphviz[data-rendered="true"]');
      await expect(diagram).toBeVisible({ timeout: 10_000 });
      await expect(diagram.locator('svg')).toBeVisible();

      const zoomIn = diagram.locator('[data-action="zoom-in"]');
      await zoomIn.click();
      const scaleAfterZoom = await diagram
        .locator('.markora-diagram-chrome__pan-zoom')
        .evaluate((el) => (el as HTMLElement).style.transform);
      expect(scaleAfterZoom).toContain('1.25');

      await diagram.locator('[data-action="reset"]').click();

      await diagram.locator('[data-action="fullscreen"]').click();
      await expect(diagram.locator('.markora-diagram-chrome__fullscreen')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(diagram.locator('.markora-diagram-chrome__fullscreen')).toBeHidden();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        diagram.locator('[data-action="download-svg"]').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.svg$/);
    } finally {
      await context.close();
    }
  });

  test('recognizes the ```graphviz language alias identically to ```dot', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'diagram.md', '```graphviz\ndigraph G {\n  a -> b\n}\n```');
      await expect(
        page.locator('.markora-diagram--graphviz[data-rendered="true"] svg'),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('invalid DOT source shows a clear inline error without breaking the rest of the document', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(
        page,
        'invalid.md',
        '# Heading before\n\n```dot\nthis is not valid dot {{{\n```\n\n## Heading after\n',
      );
      await expect(page.locator('.markora-diagram--error .markora-notice--error')).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('heading', { name: 'Heading before' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Heading after' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('security: rendering a Graphviz diagram makes zero network requests', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      const externalRequests: string[] = [];
      page.on('request', (req) => {
        if (!req.url().startsWith('chrome-extension://')) externalRequests.push(req.url());
      });

      await dropFile(page, 'diagram.md', '```dot\ndigraph G {\n  a -> b\n}\n```');
      await expect(
        page.locator('.markora-diagram--graphviz[data-rendered="true"] svg'),
      ).toBeVisible({ timeout: 10_000 });

      expect(externalRequests).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 3-B — PlantUML opt-in remote rendering (F14)', () => {
  test('off by default: shows a disabled notice and makes zero network requests, even with a plantuml fence present', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      const externalRequests: string[] = [];
      page.on('request', (req) => {
        if (!req.url().startsWith('chrome-extension://')) externalRequests.push(req.url());
      });

      await dropFile(page, 'diagram.md', '```plantuml\n@startuml\nBob -> Alice\n@enduml\n```');
      const diagram = page.locator('.markora-diagram--plantuml[data-rendered="true"]');
      await expect(diagram).toBeVisible({ timeout: 10_000 });
      await expect(diagram.locator('.markora-notice--warning')).toBeVisible();
      expect(externalRequests).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('enabling it sends only the encoded diagram source to the configured server, nothing else from the document', async () => {
    const context = await launchExtension();
    try {
      await enablePlantuml(context, 'https://plantuml.example/plantuml');
      const page = await openViewer(context);

      const requestedUrls: string[] = [];
      await page.route('https://plantuml.example/**', async (route) => {
        requestedUrls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
        });
      });

      const secretHeading = 'TopSecretDocumentHeading';
      await dropFile(
        page,
        'diagram.md',
        `# ${secretHeading}\n\n\`\`\`plantuml\n@startuml\nBob -> Alice\n@enduml\n\`\`\`\n`,
      );

      const diagram = page.locator('.markora-diagram--plantuml[data-rendered="true"]');
      await expect(diagram).toBeVisible({ timeout: 10_000 });
      await expect(diagram.locator('svg')).toBeVisible();

      expect(requestedUrls).toHaveLength(1);
      const requestedUrl = requestedUrls[0] ?? '';
      expect(requestedUrl).toMatch(/^https:\/\/plantuml\.example\/plantuml\/svg\/[0-9A-Za-z_-]+$/);
      // The rest of the document (the heading text) must never appear in the
      // request URL — only the diagram source is ever sent.
      expect(requestedUrl).not.toContain(secretHeading);
    } finally {
      await context.close();
    }
  });

  test('shows an unavailable notice, without breaking the rest of the document, when the server errors', async () => {
    const context = await launchExtension();
    try {
      await enablePlantuml(context, 'https://plantuml.example/plantuml');
      const page = await openViewer(context);
      await page.route('https://plantuml.example/**', async (route) => {
        await route.fulfill({ status: 502, body: 'bad gateway' });
      });

      await dropFile(
        page,
        'diagram.md',
        '# Heading before\n\n```plantuml\n@startuml\nBob -> Alice\n@enduml\n```\n\n## Heading after\n',
      );

      const diagram = page.locator('.markora-diagram--plantuml[data-rendered="true"]');
      await expect(diagram).toBeVisible({ timeout: 10_000 });
      await expect(diagram.locator('.markora-notice--error')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Heading before' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Heading after' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
