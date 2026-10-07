import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

test.describe('Phase 6 — Presentation mode (F28, F56, F76)', () => {
  test('splits on H1 headings, navigates with the keyboard, and exits cleanly', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'slides.md', '# One\n\nFirst\n\n# Two\n\nSecond\n\n# Three\n\nThird');

      await page.getByRole('button', { name: 'Presentation' }).click();
      const presentation = page.locator('.markora-presentation');
      await expect(presentation).toBeVisible();
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('1 / 3');

      await page.keyboard.press('ArrowRight');
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('2 / 3');

      await page.keyboard.press('End');
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('3 / 3');

      await page.keyboard.press('Home');
      await expect(presentation.locator('.markora-presentation__counter')).toHaveText('1 / 3');

      await page.keyboard.press('Escape');
      await expect(presentation).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('shows a "not enough structure" message for a document without slide boundaries', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'plain.md', '# Only heading\n\nJust one paragraph of text.');

      await page.getByRole('button', { name: 'Presentation' }).click();
      const presentation = page.locator('.markora-presentation');
      await expect(presentation).toBeVisible();
      await expect(presentation.locator('.markora-presentation__not-structured')).toBeVisible();
      await expect(presentation.locator('.markora-presentation__chrome')).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('the `?` key opens the keyboard-shortcut help overlay', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'slides.md', '# One\n\n---\n\n# Two\n\n---\n\n# Three');

      await page.getByRole('button', { name: 'Presentation' }).click();
      await page.keyboard.press('?');
      await expect(page.locator('.markora-presentation__help')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.markora-presentation__help')).toBeHidden();
      await expect(page.locator('.markora-presentation')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 6 — Mind map (F29)', () => {
  test('renders the heading hierarchy as an interactive SVG tree and closes cleanly', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(
        page,
        'headings.md',
        '# Root\n\n## Branch One\n\ntext\n\n## Branch Two\n\ntext',
      );

      await page.getByRole('button', { name: 'Mind Map' }).click();
      const mindMap = page.locator('.markora-mindmap');
      await expect(mindMap).toBeVisible();
      await expect(mindMap.locator('svg.markora-mindmap__svg')).toBeVisible();
      await expect(mindMap.locator('.markora-mindmap__node-text')).toHaveCount(3);

      await mindMap.getByRole('button', { name: 'Close' }).click();
      await expect(mindMap).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('shows an empty-state message for a document with no headings', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'no-headings.md', 'Just a paragraph, no headings at all.');

      await page.getByRole('button', { name: 'Mind Map' }).click();
      await expect(page.locator('.markora-mindmap__empty')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
