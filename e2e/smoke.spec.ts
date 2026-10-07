import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './extension-fixtures.ts';

test('unpacked extension loads and the popup renders', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.locator('.markora-popup__header h1')).toHaveText('Markora');

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.reload();
  expect(consoleErrors).toEqual([]);
});

test('popup passes a baseline accessibility scan', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  // Phase 18 fix: the popup's async render (getSettings() before its <h1>
  // is appended) raced this scan on a loaded host — axe ran against a
  // still-empty <body> and flagged "page-has-heading-one". The sibling
  // test above already waits on this same element; this one didn't.
  await expect(page.locator('.markora-popup__header h1')).toHaveText('Markora');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
