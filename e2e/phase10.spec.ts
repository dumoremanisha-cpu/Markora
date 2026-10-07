import fs from 'node:fs';
import os from 'node:os';
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

test.describe('Phase 10 — first-run onboarding (F45)', () => {
  test('runs start-to-finish, opens the sample document, and marks itself complete', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/onboarding/index.html`);

      await expect(page.getByText('Welcome to Markora', { exact: false }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled();

      // welcome -> privacy
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Your documents stay on your device')).toBeVisible();

      // privacy -> fileAccess
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Open local files by double-clicking them')).toBeVisible();

      // fileAccess -> sample
      await page.getByRole('button', { name: 'Next' }).click();
      const [samplePage] = await Promise.all([
        context.waitForEvent('page'),
        page.getByRole('button', { name: 'Open sample document' }).click(),
      ]);
      await expect(samplePage.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      await expect(samplePage.locator('.markora-content h1').first()).toContainText(
        'Markora Demo Document',
      );
      await samplePage.close();

      // sample -> mermaid (live example renders an SVG, no network)
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('.markora-onboarding__example svg')).toBeVisible({
        timeout: 10_000,
      });

      // mermaid -> math (live example renders KaTeX output)
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('.markora-onboarding__example .katex').first()).toBeVisible({
        timeout: 10_000,
      });

      // math -> shortcuts
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Keyboard shortcuts', { exact: false }).first()).toBeVisible();
      await expect(page.locator('kbd')).not.toHaveCount(0);

      // shortcuts -> finish
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();

      await page.getByRole('button', { name: 'Finish' }).click();

      // Assert against storage (via a fresh page) rather than a tab-close
      // event: chrome.tabs.remove()-driven self-close is best-effort UX
      // polish, not the contract under test — completion must be durably
      // persisted regardless of whether the tab visibly closes in time.
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await expect
        .poll(
          async () => {
            const all = await settingsPage.evaluate(() =>
              chrome.storage.local.get('markora.settings'),
            );
            return (all as { 'markora.settings'?: { onboardingCompleted?: boolean } })[
              'markora.settings'
            ]?.onboardingCompleted;
          },
          { timeout: 10_000 },
        )
        .toBe(true);
      const stored = await settingsPage.evaluate(async () => {
        const all = await chrome.storage.local.get('markora.settings');
        return all['markora.settings'] as { lastSeenWhatsNewVersion: string };
      });
      expect(stored.lastSeenWhatsNewVersion).toBe(
        await settingsPage.evaluate(() => chrome.runtime.getManifest().version),
      );
    } finally {
      await context.close();
    }
  });

  test('Skip immediately completes onboarding without walking every step', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/onboarding/index.html`);
      await page.getByRole('button', { name: 'Skip' }).click();

      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await expect
        .poll(
          async () => {
            const all = await settingsPage.evaluate(() =>
              chrome.storage.local.get('markora.settings'),
            );
            return (all as { 'markora.settings'?: { onboardingCompleted?: boolean } })[
              'markora.settings'
            ]?.onboardingCompleted;
          },
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 10 — "What\'s New" panel (F52)', () => {
  test('shows once for an unseen version, then never again', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const seedPage = await context.newPage();
      await seedPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await seedPage.evaluate(async () => {
        const all = await chrome.storage.local.get('markora.settings');
        const settings = all['markora.settings'] ?? {};
        await chrome.storage.local.set({
          'markora.settings': {
            ...settings,
            onboardingCompleted: true,
            lastSeenWhatsNewVersion: '0.0.1',
          },
        });
      });
      await seedPage.close();

      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
      await expect(popup.locator('.markora-whats-new')).toBeVisible({ timeout: 10_000 });
      await popup.locator('.markora-whats-new__close').click();
      await expect(popup.locator('.markora-whats-new')).toBeHidden();

      await popup.reload();
      await expect(popup.locator('.markora-whats-new')).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 10 — settings import/export (F42)', () => {
  test('export then re-import round-trips a changed setting', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);

      await page.getByRole('tab', { name: 'Appearance' }).click();
      await page.locator('input[type="number"]').first().fill('21');
      await page.locator('input[type="number"]').first().dispatchEvent('change');
      await expect
        .poll(async () => {
          const all = await page.evaluate(() => chrome.storage.local.get('markora.settings'));
          return (all as { 'markora.settings'?: { fontSize: number } })['markora.settings']
            ?.fontSize;
        })
        .toBe(21);

      await page.getByRole('tab', { name: 'Import & Export' }).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export settings' }).click(),
      ]);
      const filePath = await download.path();
      if (!filePath) throw new Error('download produced no local path');
      const exported = fs.readFileSync(filePath, 'utf-8');
      expect(JSON.parse(exported).fontSize).toBe(21);

      // Reset, then re-import the export and confirm the value comes back.
      await page.evaluate(async () => {
        await chrome.storage.local.remove('markora.settings');
      });
      await page.reload();
      await page.getByRole('tab', { name: 'Import & Export' }).click();
      await page.setInputFiles('input[type="file"]', filePath);
      await expect(page.locator('.markora-toast--success')).toBeVisible({ timeout: 10_000 });

      const fontSize = await page.evaluate(async () => {
        const all = await chrome.storage.local.get('markora.settings');
        return (all['markora.settings'] as { fontSize: number }).fontSize;
      });
      expect(fontSize).toBe(21);
    } finally {
      await context.close();
    }
  });

  test('rejects a malformed import file without corrupting storage', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);

      // A throwaway fixture, not a committed one — written to the OS temp
      // dir so it never shows up as an untracked file under e2e/fixtures/
      // (which holds real, curated fixtures like the perf-*.md documents).
      const badFile = path.join(os.tmpdir(), `markora-malformed-settings-${Date.now()}.json`);
      fs.writeFileSync(badFile, JSON.stringify({ notARealSetting: true }));

      await page.getByRole('tab', { name: 'Import & Export' }).click();
      await page.setInputFiles('input[type="file"]', badFile);
      await expect(page.locator('.markora-toast--error')).toBeVisible({ timeout: 10_000 });

      const stored = await page.evaluate(async () => {
        const all = await chrome.storage.local.get('markora.settings');
        return all['markora.settings'];
      });
      expect(stored).toBeUndefined();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 10 — About section (F58)', () => {
  test('shows license status and the open-source attribution list', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await page.getByRole('tab', { name: 'About' }).click();

      await expect(page.getByText('License status: Free')).toBeVisible();
      const attributions = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '..', 'src', 'backend', 'assets', 'attributions.json'),
          'utf-8',
        ),
      ) as unknown[];
      await expect(page.locator('.markora-about__attributions li')).toHaveCount(
        attributions.length,
      );
    } finally {
      await context.close();
    }
  });
});
