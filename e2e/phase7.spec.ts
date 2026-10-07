import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import JSZip from 'jszip';

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
  await page.waitForTimeout(50);
}

// The toolbar's Export button now opens the full `new_ui/export.png` dialog
// (a card grid + Cancel/Export footer) rather than a small dropdown menu —
// select the format card, then confirm with the footer's Export button.
async function exportHtmlAndRead(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'Export as HTML' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.markora-export-dialog__export').click(),
  ]);
  const filePath = await download.path();
  if (!filePath) throw new Error('download produced no local path');
  return fs.readFileSync(filePath, 'utf-8');
}

async function exportDocxAndUnzip(page: Page): Promise<JSZip> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'Export as Word (.docx)' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.markora-export-dialog__export').click(),
  ]);
  const filePath = await download.path();
  if (!filePath) throw new Error('download produced no local path');
  return JSZip.loadAsync(fs.readFileSync(filePath));
}

async function readZipEntry(zip: JSZip, entryPath: string): Promise<string> {
  const entry = zip.file(entryPath);
  if (!entry) throw new Error(`missing zip entry: ${entryPath}`);
  return entry.async('text');
}

test.describe('Phase 7-A — HTML export (F30)', () => {
  test('produces a standalone file preserving typography, tables, code and a rendered diagram, with no script tags', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(
        page,
        'doc.md',
        '# Title\n\n' +
          '**bold** and *italic* text.\n\n' +
          '| A | B |\n|---|---|\n| 1 | 2 |\n\n' +
          '```js\nconst x = 1;\n```\n\n' +
          '```mermaid\ngraph TD\nA --> B\n```\n',
      );
      await page
        .locator('.markora-diagram--mermaid[data-rendered="true"] svg')
        .waitFor({ timeout: 10_000 });

      const html = await exportHtmlAndRead(page);

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<title>doc.md</title>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<table');
      expect(html).toContain('markora-code-block');
      expect(html.replace(/<[^>]+>/g, '')).toContain('const x = 1;');
      expect(html).toContain('<svg');
      expect(html).not.toContain('<script');
      // Interactive diagram chrome makes no sense in a JS-free static file.
      expect(html).not.toContain('markora-diagram-chrome__toolbar');
    } finally {
      await context.close();
    }
  });

  test('a mermaid diagram with attempted script/event-handler injection exports with no script tag or inline event handler', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(
        page,
        'malicious.md',
        '```mermaid\n' +
          'graph TD\n' +
          'A["<img src=x onerror=alert(1)>"] --> B\n' +
          'click A "javascript:alert(1)"\n' +
          '```',
      );
      await page
        .locator('.markora-diagram--mermaid[data-rendered="true"] svg, .markora-notice--error')
        .waitFor({ timeout: 10_000 });

      const html = await exportHtmlAndRead(page);

      expect(html).not.toContain('<script');
      expect(html).not.toMatch(/\son\w+\s*=/i);
      expect(html).not.toMatch(/javascript:/i);
    } finally {
      await context.close();
    }
  });

  test('annotations: a comment appears as a numbered marker plus an endnote list by default, and is excluded when the setting is off', async () => {
    const context = await launchExtension();
    try {
      const { page, extensionId } = await openViewer(context);
      await dropFile(page, 'comment.md', 'Some text worth commenting on here.');

      await selectTextAndTriggerToolbar(page, 'worth commenting');
      await page.getByRole('button', { name: 'Comment' }).click();
      await page.locator('.markora-annotations-composer__input').fill('interesting point');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.markora-annotation--comment')).toHaveText('worth commenting');

      const htmlOn = await exportHtmlAndRead(page);
      expect(htmlOn).toContain('markora-export-annotation-marker');
      expect(htmlOn).toContain('interesting point');

      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Navigation' }).click();
      await settingsPage.getByLabel('Include annotations in exports').uncheck();
      await settingsPage.close();
      // chrome.storage.onChanged propagation to the still-open viewer tab.
      await page.waitForTimeout(100);

      const htmlOff = await exportHtmlAndRead(page);
      const bodyOff = htmlOff.slice(htmlOff.indexOf('<body>'));
      expect(bodyOff).not.toContain('markora-export-annotation-marker');
      expect(bodyOff).not.toContain('interesting point');
      // No annotation mark elements in the body — the CSS may still carry
      // an unused `:root[data-theme='dark'] .markora-annotation--*` rule
      // (always kept regardless of usage, see cssTreeShake.ts), which is
      // harmless dead weight, not a functional or security concern.
      expect(bodyOff).not.toContain('markora-annotation');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 7-A — Print/PDF export (F32)', () => {
  test('the Print/PDF menu item invokes the browser print, and print CSS hides app chrome and resets diagram pan/zoom', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'doc.md', '# Title\n\n```mermaid\ngraph TD\nA --> B\n```\n');
      await page
        .locator('.markora-diagram--mermaid[data-rendered="true"] svg')
        .waitFor({ timeout: 10_000 });

      await page.locator('.markora-diagram-chrome [data-action="zoom-in"]').click();

      await page.evaluate(() => {
        (window as unknown as { __printed?: boolean }).__printed = false;
        window.print = () => {
          (window as unknown as { __printed?: boolean }).__printed = true;
        };
      });

      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByRole('radio', { name: 'Print / Save as PDF' }).click();
      await page.locator('.markora-export-dialog__export').click();
      await page.waitForFunction(
        () => (window as unknown as { __printed?: boolean }).__printed === true,
      );

      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.markora-toolbar')).toBeHidden();
      const panZoomTransform = await page
        .locator('.markora-diagram-chrome__pan-zoom')
        .evaluate((el) => getComputedStyle(el).transform);
      expect(panZoomTransform === 'none' || panZoomTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(
        true,
      );
    } finally {
      await context.close();
    }
  });

  test('injects and then removes annotation endnotes around printing when the setting is on', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'comment.md', 'Some text worth commenting on here.');
      await selectTextAndTriggerToolbar(page, 'worth commenting');
      await page.getByRole('button', { name: 'Comment' }).click();
      await page.locator('.markora-annotations-composer__input').fill('interesting point');
      await page.getByRole('button', { name: 'Save' }).click();

      await page.evaluate(() => {
        window.print = () => {};
      });

      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByRole('radio', { name: 'Print / Save as PDF' }).click();
      await page.locator('.markora-export-dialog__export').click();

      await expect(page.locator('.markora-export-annotations')).toBeVisible();
      await expect(page.locator('.markora-export-annotation-marker')).toHaveText('[1]');

      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await expect(page.locator('.markora-export-annotations')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 7-B — DOCX export (F31)', () => {
  test('preserves headings, formatting, lists, a table, code, a link, and native OOXML math/footnotes', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(
        page,
        'doc.md',
        '# Title\n\n' +
          '**bold** and *italic* and ~~gone~~.\n\n' +
          '- one\n- two\n\n' +
          '1. first\n2. second\n\n' +
          '- [ ] todo\n- [x] done\n\n' +
          '| A | B |\n|---|---|\n| 1 | 2 |\n\n' +
          '```js\nconst x = 1;\n```\n\n' +
          '[link](https://example.com)\n\n' +
          'Inline $x^2$ math.\n\n' +
          'A footnote.[^1]\n\n[^1]: The note.\n',
      );

      const zip = await exportDocxAndUnzip(page);
      const documentXml = await readZipEntry(zip, 'word/document.xml');
      const footnotesXml = await readZipEntry(zip, 'word/footnotes.xml');
      const relsXml = await readZipEntry(zip, 'word/_rels/document.xml.rels');

      expect(documentXml).toContain('Heading1');
      expect(documentXml).toContain('<w:b/>');
      expect(documentXml).toContain('<w:i/>');
      expect(documentXml).toContain('<w:strike/>');
      expect(documentXml).toContain('<w:tbl>');
      expect(documentXml).toContain('Consolas');
      expect(documentXml).toContain('☐');
      expect(documentXml).toContain('☑');
      expect(documentXml).toContain('m:oMath');
      expect(documentXml).toContain('footnoteReference');
      expect(footnotesXml).toContain('The note.');
      expect(relsXml).toContain('https://example.com');
    } finally {
      await context.close();
    }
  });

  test('applies highlight/underline/comment annotations as native runs and a native Word comment', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'annotated.md', 'Some text worth commenting on here.');

      await selectTextAndTriggerToolbar(page, 'worth commenting');
      await page.getByRole('button', { name: 'Comment' }).click();
      await page.locator('.markora-annotations-composer__input').fill('interesting point');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.markora-annotation--comment')).toHaveText('worth commenting');

      const zip = await exportDocxAndUnzip(page);
      const documentXml = await readZipEntry(zip, 'word/document.xml');
      const commentsXml = await readZipEntry(zip, 'word/comments.xml');

      expect(documentXml).toContain('commentReference');
      expect(commentsXml).toContain('interesting point');
    } finally {
      await context.close();
    }
  });

  test('only fetches the exact image URL the document references, never a general network capability', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      const requestedUrls: string[] = [];
      await page.route('https://example.com/**', (route) => {
        requestedUrls.push(route.request().url());
        void route.fulfill({
          status: 200,
          contentType: 'image/png',
          // 1x1 transparent PNG.
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
          ),
        });
      });

      await dropFile(page, 'image.md', '![a photo](https://example.com/photo.png)');
      // The live render also loads this same `<img src>` to display it
      // on-screen (an already-approved document-referenced subresource
      // fetch, unrelated to export) — reset the log so only what DOCX
      // export itself requests is asserted below.
      requestedUrls.length = 0;
      await exportDocxAndUnzip(page);

      expect(requestedUrls.every((url) => url === 'https://example.com/photo.png')).toBe(true);
      expect(requestedUrls.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 9 — performance budget P12 (docs/specs/06-testing-quality-gate.md §1a)', () => {
  test('HTML export of a ~1MB document with 20 images completes under 5s', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await page.route('https://example.com/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
          ),
        }),
      );

      const filler =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
        'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
        'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
      const sections: string[] = ['# P12 Export Fixture', ''];
      let size = 0;
      let i = 0;
      // 20 images spread evenly across ~1MB of surrounding text/headings.
      while (size < 1_000_000) {
        i++;
        const withImage = i % 25 === 0 && i / 25 <= 20;
        const section = [
          `## Section ${i}`,
          '',
          `Paragraph ${i}. ${filler} ${filler}`,
          '',
          withImage ? `![diagram ${i}](https://example.com/img-${i}.png)` : '',
          '',
        ].join('\n');
        sections.push(section);
        size += section.length;
      }
      await dropFile(page, 'p12.md', sections.join('\n'));

      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByRole('radio', { name: 'Export as HTML' }).click();
      // Timed from the actual export-confirm click, not the dialog-open/
      // format-select UI interaction above — this budget is about the
      // export pipeline's own performance, not dialog click overhead.
      const start = Date.now();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('.markora-export-dialog__export').click(),
      ]);
      const elapsed = Date.now() - start;
      const filePath = await download.path();
      expect(filePath).toBeTruthy();

      console.log(`P12 HTML export (1MB, 20 images) measured at ${elapsed}ms`);
      expect(elapsed).toBeLessThan(5_000);
    } finally {
      await context.close();
    }
  });
});
