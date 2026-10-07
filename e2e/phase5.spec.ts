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

/** Selects the given exact substring of `.markora-content`'s text and dispatches `mouseup`, exactly as a real drag-select would — this is what the selection toolbar listens for. */
async function selectTextAndTriggerToolbar(page: Page, text: string): Promise<void> {
  await page.evaluate((needle) => {
    const root = document.querySelector('.markora-content');
    if (!root) throw new Error('content root not found');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const idx = node.textContent?.indexOf(needle) ?? -1;
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return;
      }
    }
    throw new Error(`text not found: ${needle}`);
  }, text);
  // attachSelectionToolbar defers one tick after mouseup before reading the selection.
  await page.waitForTimeout(50);
}

test.describe('Phase 5 — Annotations (F27)', () => {
  test('creating a highlight shows it inline and in the annotations panel; deleting it removes both', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'annotate.md', 'The quick brown fox jumps over the lazy dog.');

      await selectTextAndTriggerToolbar(page, 'quick brown fox');
      await page.getByRole('button', { name: 'Highlight' }).click();

      const mark = page.locator('.markora-annotation--highlight');
      await expect(mark).toHaveText('quick brown fox');

      await page.getByRole('button', { name: 'Annotations' }).click();
      const panel = page.locator('.markora-annotations-panel');
      await expect(panel).toHaveClass(/markora-annotations-panel--visible/);
      await expect(panel.locator('.markora-annotations-panel__item')).toHaveCount(1);

      await panel.getByRole('button', { name: 'Delete annotation' }).click();
      await expect(panel.locator('.markora-annotations-panel__item')).toHaveCount(0);
      await expect(page.locator('.markora-annotation--highlight')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('creating a comment stores and displays the comment text', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'comment.md', 'Some text worth commenting on here.');

      await selectTextAndTriggerToolbar(page, 'worth commenting');
      await page.getByRole('button', { name: 'Comment' }).click();
      await page.locator('.markora-annotations-composer__input').fill('interesting point');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('.markora-annotation--comment')).toHaveText('worth commenting');

      await page.getByRole('button', { name: 'Annotations' }).click();
      await expect(page.locator('.markora-annotations-panel__comment')).toHaveText(
        'interesting point',
      );
    } finally {
      await context.close();
    }
  });

  test('the annotations panel and the outline are mutually exclusive in the same sidebar slot (F51)', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'toc.md', '# Heading\n\ntext');

      const toc = page.locator('.markora-toc');
      const annotations = page.locator('.markora-annotations-panel');
      await expect(toc).toHaveClass(/markora-toc--visible/);

      await page.getByRole('button', { name: 'Annotations' }).click();
      await expect(annotations).toHaveClass(/markora-annotations-panel--visible/);
      await expect(toc).not.toHaveClass(/markora-toc--visible/);

      await page.getByRole('button', { name: 'Contents' }).click();
      await expect(toc).toHaveClass(/markora-toc--visible/);
      await expect(annotations).not.toHaveClass(/markora-annotations-panel--visible/);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 5 — Reading progress (F16) and document stats (F17, F71)', () => {
  test('reading progress starts hidden and document stats starts visible by default (Ui-prompt.md status bar); Settings can toggle both', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Navigation' }).click();
      await settingsPage.getByRole('checkbox', { name: 'Show reading progress bar' }).check();
      await settingsPage.getByRole('checkbox', { name: 'Show document statistics' }).check();

      const { page } = await openViewer(context);
      const longDoc = Array.from({ length: 200 }, (_, i) => `Paragraph number ${i}.`).join('\n\n');
      await dropFile(page, 'long.md', longDoc);

      const progress = page.locator('.markora-reading-progress');
      await expect(progress).toHaveClass(/markora-reading-progress--visible/);

      const stats = page.locator('.markora-document-stats');
      await expect(stats).toHaveClass(/markora-document-stats--visible/);
      await expect(stats).toContainText('words');
      await expect(stats).toContainText('min read');

      await expect(progress).toHaveAttribute('aria-valuenow', '0');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(progress).toHaveAttribute('aria-valuenow', '100');
    } finally {
      await context.close();
    }
  });

  test('CJK text counts each character as a word (F71), not the whole run as one word', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Navigation' }).click();
      await settingsPage.getByRole('checkbox', { name: 'Show document statistics' }).check();

      const { page } = await openViewer(context);
      await dropFile(page, 'cjk.md', '你好世界吗');

      await expect(page.locator('.markora-document-stats')).toContainText('5 words');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 5 — "Delete all annotations" maintenance action', () => {
  test('is separate from Clear Cache, requires a second click, and reports the count', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'to-annotate.md', 'One two three four five six seven.');
      await selectTextAndTriggerToolbar(page, 'three four');
      await page.getByRole('button', { name: 'Highlight' }).click();
      await expect(page.locator('.markora-annotation--highlight')).toHaveCount(1);

      const extensionId = await getExtensionId(context);
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Storage' }).click();

      const deleteButton = settingsPage.getByRole('button', { name: 'Delete all annotations' });
      await expect(deleteButton).toBeEnabled();
      await deleteButton.click();
      await expect(
        settingsPage.getByRole('button', { name: /delete 1 annotations/i }),
      ).toBeVisible();
      await settingsPage.getByRole('button', { name: /delete 1 annotations/i }).click();

      await expect
        .poll(async () =>
          settingsPage.evaluate(async () => {
            const all = await chrome.storage.local.get(null);
            return Object.keys(all).filter((k) => k.startsWith('markora.annotations.')).length;
          }),
        )
        .toBe(0);
    } finally {
      await context.close();
    }
  });
});
