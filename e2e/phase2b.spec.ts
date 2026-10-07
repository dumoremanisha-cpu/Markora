import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

// A minimal valid 1x1 transparent PNG, used to serve a real, loadable image
// for the lightbox tests without any external network dependency.
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
  return { page, extensionId };
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

test.describe('Phase 2-B — Table of contents (F15)', () => {
  test('renders nested headings, and clicking a link navigates to it', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(
        page,
        'toc.md',
        '# Intro\n\ntext\n\n## Installation\n\ntext\n\n## Usage\n\ntext\n\n# FAQ\n\ntext',
      );

      const links = page.locator('.markora-toc__link');
      await expect(links).toHaveCount(4);

      // Filtering keeps a matched heading plus its ancestor for context, so
      // "usage" (a child of "Intro") yields 2 links, not 1.
      await page.locator('.markora-toc__filter').fill('usage');
      await expect(links).toHaveCount(2);
      await page.locator('.markora-toc__filter').fill('');
      await expect(links).toHaveCount(4);

      await page.getByRole('link', { name: 'Usage' }).click();
      await expect(page).toHaveURL(/#heading-usage$/);
    } finally {
      await context.close();
    }
  });

  test('toolbar TOC toggle and the Ctrl+Shift+L shortcut both hide/show it', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'toc2.md', '# Only Heading\n\ntext');

      const toc = page.locator('.markora-toc');
      await expect(toc).toHaveClass(/markora-toc--visible/);

      await page.getByRole('button', { name: 'Contents' }).click();
      await expect(toc).not.toHaveClass(/markora-toc--visible/);

      await page.keyboard.press('Control+Shift+L');
      await expect(toc).toHaveClass(/markora-toc--visible/);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — In-document search (F49)', () => {
  test('finds, counts, navigates matches, and restores the DOM cleanly on close', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'search.md', 'banana one\n\nbanana two\n\nbanana three');

      await page.getByRole('button', { name: 'Search' }).click();
      await page.locator('.markora-search__input').fill('banana');
      await expect(page.locator('.markora-search__count')).toHaveText('1 of 3');

      await page.locator('.markora-search').getByRole('button', { name: 'Next match' }).click();
      await expect(page.locator('.markora-search__count')).toHaveText('2 of 3');

      const textBefore = await page.locator('.markora-content').textContent();
      await page.keyboard.press('Escape');
      await expect(page.locator('.markora-search')).toBeHidden();
      await expect(page.locator('mark.markora-search-match')).toHaveCount(0);
      const textAfter = await page.locator('.markora-content').textContent();
      expect(textAfter).toBe(textBefore);
    } finally {
      await context.close();
    }
  });

  test('whole-word and regex toggles narrow/expand matches', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'search-modes.md', 'cat catalog cat food\n\nfoo1 foo22 foo333');

      await page.getByRole('button', { name: 'Search' }).click();
      await page.locator('.markora-search__input').fill('cat');
      await expect(page.locator('.markora-search__count')).toHaveText('1 of 3');

      await page.getByRole('checkbox', { name: 'Whole word' }).check();
      await expect(page.locator('.markora-search__count')).toHaveText('1 of 2');

      await page.getByRole('checkbox', { name: 'Whole word' }).uncheck();
      await page.locator('.markora-search__input').fill('foo\\d+');
      await expect(page.locator('.markora-search__count')).toHaveText('No matches');

      await page.getByRole('checkbox', { name: 'Regex' }).check();
      await expect(page.locator('.markora-search__count')).toHaveText('1 of 3');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Image lightbox (F24)', () => {
  let server: http.Server;
  let baseUrl: string;

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/pic.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(ONE_PX_PNG);
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

  test('opens on image click, shows a counter, and Escape closes it', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'img.md', `![a photo](${baseUrl}/pic.png)`);

      await page.locator('.markora-content img').click();
      await expect(page.locator('.markora-lightbox')).toBeVisible();
      await expect(page.locator('.markora-lightbox__counter')).toHaveText('1 of 1');

      await page.keyboard.press('Escape');
      await expect(page.locator('.markora-lightbox')).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('a broken image gets a placeholder instead of a bare broken-image icon', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'broken.md', `![missing](${baseUrl}/does-not-exist.png)`);

      await expect(page.locator('.markora-image-wrap--broken')).toBeVisible();
      await expect(page.locator('.markora-image-placeholder')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Drag-to-resize TOC sidebar (F73)', () => {
  test('keyboard resize (accessible alternative to dragging) widens the sidebar and persists it', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'resize.md', '# Heading\n\ntext');

      const before = await page
        .locator('.markora-toc')
        .evaluate((el) => el.getBoundingClientRect().width);

      // Scoped to the TOC's own handle: Phase 4 added a second
      // `.markora-sidebar__resize-handle` for the file-browser sidebar,
      // reusing the same shared component (src/components/sidebar/).
      const handle = page.locator('.markora-toc .markora-sidebar__resize-handle');
      await handle.focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');

      const after = await page
        .locator('.markora-toc')
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(after).toBeGreaterThan(before);

      // Persisted (debounced) to settings, not just applied visually. The
      // key may not exist in storage yet at the first poll attempt (nothing
      // has called setSettings() before this), so default to 0 rather than
      // throwing — a thrown error would fail expect.poll() immediately
      // instead of letting it retry past the debounce window.
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const stored = await chrome.storage.local.get('markora.settings');
            const settings = stored['markora.settings'] as { tocSidebarWidth: number } | undefined;
            return settings?.tocSidebarWidth ?? 0;
          }),
        )
        .toBeGreaterThan(240);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Live-apply typography settings, no reload (F81, budget P10)', () => {
  test('a font-size change from one viewer tab reaches a second open viewer tab instantly', async () => {
    const context = await launchExtension();
    try {
      const { page: pageA } = await openViewer(context);
      const { page: pageB } = await openViewer(context);
      await dropFile(pageB, 'doc.md', '# Heading\n\ntext');

      const start = Date.now();
      await pageA.evaluate(async () => {
        const stored = await chrome.storage.local.get('markora.settings');
        const settings = stored['markora.settings'] as Record<string, unknown>;
        await chrome.storage.local.set({
          'markora.settings': { ...settings, fontSize: 22 },
        });
      });

      await expect
        .poll(() =>
          pageB.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue(
              '--markora-content-font-size',
            ),
          ),
        )
        .toBe('22px');
      const elapsed = Date.now() - start;

      console.log(`P10 live-apply propagation measured at ${elapsed}ms`);
      // docs/specs/06-testing-quality-gate.md §1a: P10's actual budget is
      // < 100ms (this test previously asserted a looser 500ms placeholder
      // that never matched the spec table — tightened here since the real
      // measured value, ~36ms, comfortably clears it).
      expect(elapsed).toBeLessThan(100);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B/8/9 — Live language switch, no reload (F37, budget P11)', () => {
  test('changing the language setting updates already-rendered viewer chrome text within budget', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'doc.md', '# Heading\n\ntext');
      await expect(page.locator('.markora-header__copy')).toHaveText('Copy link');

      const start = Date.now();
      await page.evaluate(async () => {
        const stored = await chrome.storage.local.get('markora.settings');
        const settings = stored['markora.settings'] as Record<string, unknown>;
        await chrome.storage.local.set({
          'markora.settings': { ...settings, language: 'es' },
        });
      });

      await expect(page.locator('.markora-header__copy')).toHaveText('Copiar enlace');
      const elapsed = Date.now() - start;

      console.log(`P11 language switch measured at ${elapsed}ms`);
      expect(elapsed).toBeLessThan(300);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Shortcut-help modal (F39)', () => {
  test('Ctrl+/ opens it, lists shortcuts, Escape closes and returns focus', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'doc.md', '# Heading\n\ntext');

      await page.keyboard.press('Control+/');
      await expect(page.locator('.markora-shortcut-help')).toBeVisible();
      // 3 in-page shortcuts + the openPreferences shortcut (Phase 13's
      // floating Preferences dialog) + the one global (chrome.commands)
      // theme-toggle row = 5.
      await expect(page.locator('.markora-shortcut-help__list dt')).toHaveCount(5);

      await page.keyboard.press('Escape');
      await expect(page.locator('.markora-shortcut-help')).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Full options page (F41)', () => {
  test('populated sections are wired to storage; stub sections say so; no console errors', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await expect(page.locator('h1')).toHaveText('Markora settings');

      // Markdown feature toggle (F69) round-trips to storage.
      await page.getByRole('tab', { name: 'Markdown' }).click();
      const tablesCheckbox = page.getByRole('checkbox', { name: 'Tables' });
      await expect(tablesCheckbox).toBeChecked();
      await tablesCheckbox.uncheck();
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const stored = await chrome.storage.local.get('markora.settings');
            return (stored['markora.settings'] as { markdown: { tables: boolean } }).markdown
              .tables;
          }),
        )
        .toBe(false);

      // Highlight theme selector (F70) is present.
      await page.getByRole('tab', { name: 'Appearance' }).click();
      await expect(page.getByLabel('Code syntax theme')).toBeVisible();

      // Shortcuts (F48) became a real, wired section in Phase 7 — no
      // section is a stub any more (STUB_SECTIONS is now empty), so this
      // checks the Shortcuts section renders its real recorder UI instead
      // of the old "comes in a later update" placeholder.
      await page.getByRole('tab', { name: 'Shortcuts' }).click();
      const visibleSection = page.locator('.markora-settings__main > section:not([hidden])');
      await expect(
        visibleSection.getByText('Customize keyboard shortcuts for actions inside the viewer.', {
          exact: false,
        }),
      ).toBeVisible();

      expect(consoleErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('passes a baseline accessibility scan', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await page.locator('h1').waitFor();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Accessibility baseline on the viewer (task 10)', () => {
  test('the loaded viewer passes a baseline accessibility scan', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'a11y.md', '# Heading\n\nSome text with a [link](https://example.com).');
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('keyboard-only: Tab reaches the toolbar and TOC filter without a mouse', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await dropFile(page, 'kbd.md', '# Heading\n\ntext');

      let reachedFilter = false;
      for (let i = 0; i < 30 && !reachedFilter; i++) {
        await page.keyboard.press('Tab');
        reachedFilter = await page.evaluate(
          () => document.activeElement?.classList.contains('markora-toc__filter') ?? false,
        );
      }
      expect(reachedFilter).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('prefers-reduced-motion suppresses the reading-progress celebration and the presentation overflow-bounce animations (F38, F62)', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await dropFile(page, 'motion.md', '# Heading\n\ntext');

      // Force each animated state directly rather than driving the real
      // trigger (scrolling to 100%, overflowing a slide) — this test is
      // about whether the CSS respects the media query, not about
      // re-testing how each state gets triggered (already covered
      // elsewhere in phases 5/6).
      const celebrateAnimationName = await page.evaluate(() => {
        const el = document.querySelector('.markora-reading-progress');
        el?.classList.add('markora-reading-progress--celebrate');
        const bar = el?.querySelector('.markora-reading-progress__bar');
        return bar ? getComputedStyle(bar).animationName : null;
      });
      expect(celebrateAnimationName).toBe('none');

      const bounceAnimationName = await page.evaluate(() => {
        const indicator = document.createElement('div');
        indicator.className =
          'markora-slide__overflow-indicator markora-slide__overflow-indicator--visible';
        document.body.appendChild(indicator);
        const name = getComputedStyle(indicator).animationName;
        indicator.remove();
        return name;
      });
      expect(bounceAnimationName).toBe('none');
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 2-B — Responsive layout (F50)', () => {
  test('at a narrow viewport the TOC close button becomes visible (drawer mode)', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      await page.setViewportSize({ width: 375, height: 667 });
      await dropFile(page, 'mobile.md', '# Heading\n\ntext');

      const closeButtonDisplay = await page
        .locator('.markora-toc__close')
        .evaluate((el) => getComputedStyle(el).display);
      expect(closeButtonDisplay).not.toBe('none');
    } finally {
      await context.close();
    }
  });

  // Phase 9 — 06-testing-quality-gate.md §3 "UI" asks for "responsive
  // layout at multiple widths (desktop, laptop, narrow window, tablet)";
  // only the one narrow-viewport TOC check above existed before this. A
  // horizontal-scrollbar check is a blunt instrument, but it catches the
  // single most common class of real responsive bugs (a fixed-width
  // element blowing out the layout) across every major surface in one
  // pass, at every named width, without hand-writing a per-surface,
  // per-width assertion for each.
  const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'narrow', width: 375, height: 667 },
  ] as const;

  async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
    return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  }

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name} width (${viewport.width}px) across major surfaces`, async () => {
      const context = await launchExtension();
      try {
        const { page } = await openViewer(context);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await dropFile(
          page,
          'responsive.md',
          '# Title\n\n## Section\n\nSome text.\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n\n```js\nconst x = 1;\n```\n',
        );
        // TOC is visible by default (showToc defaults to true — see the
        // Phase 2-B toggle test), so the "bare viewer" check above already
        // covers the TOC-open state; clicking "Contents" here would
        // toggle it *closed*, not open.
        expect(await hasHorizontalOverflow(page), 'bare viewer').toBe(false);

        // Phase 9 finding: at <=768px the TOC becomes a fixed, full-height
        // drawer (z-index 25) that sits *above* the sticky toolbar
        // (z-index 20) — confirmed via elementFromPoint that it visually
        // and functionally covers toolbar buttons, not just overlaps
        // their box. Whether that's the intended "close the drawer first"
        // pattern or worth revisiting is a product call (recorded in
        // TESTING.md); either way, a real narrow-viewport user would need
        // to dismiss it via its own close button before reaching the
        // toolbar, so this test does the same rather than asserting
        // through an element that isn't actually clickable.
        if (viewport.width <= 768) {
          await page.locator('.markora-toc__close').click();
          await expect(page.locator('.markora-toc')).not.toHaveClass(/markora-toc--visible/);
        }

        await page.getByRole('button', { name: 'Annotations' }).click();
        await expect(page.locator('.markora-annotations-panel')).toBeVisible();
        expect(await hasHorizontalOverflow(page), 'with annotations panel open').toBe(false);

        const extensionId = await page.evaluate(() => location.href.split('/')[2]);
        const settingsPage = await context.newPage();
        await settingsPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
        await settingsPage.locator('h1').waitFor();
        expect(await hasHorizontalOverflow(settingsPage), 'settings page').toBe(false);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe('Phase 2-B — performance budget P6 (search < 150ms @ ~1MB)', () => {
  test('searching a ~1MB rendered document completes well under budget', async () => {
    const context = await launchExtension();
    try {
      const { page } = await openViewer(context);
      const paragraph = 'The quick brown fox jumps over the lazy dog. '.repeat(200) + '\n\n';
      const content = '# Perf\n\n' + paragraph.repeat(110) + 'findme-unique-token\n';
      await dropFile(page, 'perf-search.md', content);

      await page.getByRole('button', { name: 'Search' }).click();
      const start = Date.now();
      await page.locator('.markora-search__input').fill('findme-unique-token');
      await expect(page.locator('.markora-search__count')).toHaveText('1 of 1');
      const elapsed = Date.now() - start;

      console.log(`P6 search measured at ${elapsed}ms`);
      expect(elapsed).toBeLessThan(150);
    } finally {
      await context.close();
    }
  });
});
