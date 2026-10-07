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

interface FakeNode {
  name: string;
  kind: 'file' | 'directory';
  content?: string;
  children?: FakeNode[];
}

/** Mutable per-file state (content + lastModified), keyed by filename — lets a test simulate an external edit via `editFakeFile()` after the picker has already handed out handles. */
interface FakeFileState {
  content: string;
  lastModified: number;
}

/**
 * A real `showDirectoryPicker()` routes through Chromium's native
 * file-chooser interception, which Playwright cannot drive (DEVELOPMENT.md
 * Spike 3). But shadowing `window.showDirectoryPicker` with a page-level
 * fake — via `addInitScript`, before the real API is ever called — sidesteps
 * that native dialog entirely: our code calls the shadowed (plain JS)
 * function instead of the native one, so no CDP interception is involved.
 * Everything downstream of obtaining a handle (browse/search/bookmark/
 * auto-refresh) becomes genuinely testable this way, even though the picker
 * *itself* still isn't (see DEVELOPMENT.md's Phase 4 entry).
 */
async function installFakeFolderPicker(
  page: Page,
  tree: FakeNode[],
  folderName = 'test-folder',
): Promise<void> {
  await page.addInitScript(
    ({ tree, folderName }: { tree: FakeNode[]; folderName: string }) => {
      const store = new Map<string, FakeFileState>();
      function seed(nodes: FakeNode[]): void {
        for (const node of nodes) {
          if (node.kind === 'file')
            store.set(node.name, { content: node.content ?? '', lastModified: Date.now() });
          else seed(node.children ?? []);
        }
      }
      seed(tree);
      (window as unknown as { __markoraFakeFiles: Map<string, FakeFileState> }).__markoraFakeFiles =
        store;

      function makeFileHandle(node: FakeNode) {
        return {
          kind: 'file' as const,
          name: node.name,
          async getFile() {
            const state = store.get(node.name) ?? {
              content: node.content ?? '',
              lastModified: Date.now(),
            };
            return new File([state.content], node.name, { lastModified: state.lastModified });
          },
        };
      }
      function makeDirHandle(name: string, children: FakeNode[]): unknown {
        return {
          kind: 'directory' as const,
          name,
          async *values() {
            for (const child of children) {
              // A tiny per-entry delay stands in for real disk I/O latency
              // — real FileSystemDirectoryHandle iteration is genuinely
              // async, which is what makes the scan cooperative in the
              // first place (see ARCHITECTURE.md's Phase 4 entry). Without
              // this, iterating a fake tree completes synchronously enough
              // that the P7/P8 performance test below wouldn't exercise the
              // batching/yielding logic at all.
              await new Promise((resolve) => setTimeout(resolve, 1));
              yield child.kind === 'directory'
                ? makeDirHandle(child.name, child.children ?? [])
                : makeFileHandle(child);
            }
          },
          async getDirectoryHandle(n: string) {
            const c = children.find((x) => x.kind === 'directory' && x.name === n);
            if (!c) throw new DOMException('Not found', 'NotFoundError');
            return makeDirHandle(c.name, c.children ?? []);
          },
          async getFileHandle(n: string) {
            const c = children.find((x) => x.kind === 'file' && x.name === n);
            if (!c) throw new DOMException('Not found', 'NotFoundError');
            return makeFileHandle(c);
          },
          async queryPermission() {
            return 'granted';
          },
          async requestPermission() {
            return 'granted';
          },
        };
      }
      (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker =
        async () => makeDirHandle(folderName, tree);
    },
    { tree, folderName },
  );
}

/** Simulates an external edit to a fake file already handed out by the installed picker — bumps `lastModified` so Flow B's poll detects it, exactly as a real editor save would. */
async function editFakeFile(page: Page, name: string, content: string): Promise<void> {
  await page.evaluate(
    ({ name, content }: { name: string; content: string }) => {
      const store = (window as unknown as { __markoraFakeFiles: Map<string, FakeFileState> })
        .__markoraFakeFiles;
      store.set(name, { content, lastModified: Date.now() });
    },
    { name, content },
  );
}

async function openViewerWithFakeFolder(
  context: Awaited<ReturnType<typeof launchExtension>>,
  tree: FakeNode[],
  folderName = 'test-folder',
) {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await installFakeFolderPicker(page, tree, folderName);
  await page.goto(`chrome-extension://${extensionId}/src/viewer/index.html`);
  await page.locator('.markora-empty-state').waitFor({ state: 'attached', timeout: 10_000 });
  return page;
}

async function openFolder(page: Page): Promise<void> {
  // The file-browser sidebar's own "Open folder" button shares the same
  // accessible name and exists in the DOM (hidden) from page load, so this
  // is scoped to the empty-state's button specifically to avoid Playwright
  // resolving to the hidden one.
  await page.locator('.markora-empty-state').getByRole('button', { name: 'Open folder' }).click();
  await expect(page.locator('.markora-file-browser--visible')).toBeVisible();
  await expect(page.locator('.markora-file-browser__status')).toHaveText(/files/, {
    timeout: 10_000,
  });
}

const SAMPLE_TREE: FakeNode[] = [
  { name: 'README.md', kind: 'file', content: '# Welcome\n\nInstallation instructions here.' },
  { name: 'notes.txt', kind: 'file', content: 'plain notes' },
  {
    name: 'docs',
    kind: 'directory',
    children: [{ name: 'guide.md', kind: 'file', content: 'Guide content, nothing special.' }],
  },
  {
    name: 'node_modules',
    kind: 'directory',
    children: [{ name: 'ignored.md', kind: 'file', content: 'should never appear' }],
  },
];

/** A 1,000-file synthetic tree (20 directories × 50 files), for the P7/P8 performance budgets. */
function buildLargeTree(): FakeNode[] {
  const dirs: FakeNode[] = [];
  for (let d = 0; d < 20; d++) {
    const files: FakeNode[] = [];
    for (let f = 0; f < 50; f++) {
      files.push({ name: `file-${d}-${f}.md`, kind: 'file', content: `content ${d}-${f}` });
    }
    dirs.push({ name: `dir-${d}`, kind: 'directory', children: files });
  }
  return dirs;
}

test.describe('Phase 4 — Folder browser (F19, F63-F65)', () => {
  test('opens a folder, scans it, and shows the tree — respecting the exclusion list', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      await openFolder(page);

      await expect(
        page.locator('.markora-file-browser__file-button', { hasText: 'README.md' }),
      ).toBeVisible();
      await expect(
        page.locator('.markora-file-browser__file-button', { hasText: 'guide.md' }),
      ).toBeVisible();
      await expect(
        page.locator('.markora-file-browser__file-button', { hasText: 'ignored.md' }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('opening a file renders it and highlights it as the active file', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      await openFolder(page);

      await page.locator('.markora-file-browser__file-button', { hasText: 'README.md' }).click();
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
      await expect(
        page.locator('.markora-file-browser__file-button--active', { hasText: 'README.md' }),
      ).toBeVisible();
      // Phase 17: a real File.lastModified (the fake folder's getFile() sets
      // one, same as a real FileSystemFileHandle would) drives a genuine
      // "Modified ..." status-bar field — never a fabricated value.
      await expect(page.locator('.markora-status-bar__modified')).toBeVisible();
      await expect(page.locator('.markora-status-bar__modified')).toContainText('Modified');
    } finally {
      await context.close();
    }
  });

  test('the file-type filter narrows the list without a rescan', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      await openFolder(page);

      await expect(
        page.locator('.markora-file-browser__file-button', { hasText: 'notes.txt' }),
      ).toHaveCount(0);

      // Phase 20: the sidebar's own filter dropdown was removed (user
      // feedback — cluttered the panel); Settings → Files → "Default
      // folder-browser file filter" is now the only control for this, and
      // fileBrowser's setFilterSettings() live-rebuilds already-open trees
      // from a Settings-driven change (previously only the removed
      // dropdown's own change handler did that, for itself).
      const extensionId = await getExtensionId(context);
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Files' }).click();
      await settingsPage
        .getByLabel('Default folder-browser file filter')
        .selectOption('allSupportedText');
      await settingsPage.close();

      await expect(
        page.locator('.markora-file-browser__file-button', { hasText: 'notes.txt' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('folder search matches filename and content, with a highlighted snippet, and respects exclusions', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      await openFolder(page);

      await page.locator('.markora-file-browser__search').fill('installation');
      await expect(page.locator('.markora-file-browser__result')).toHaveCount(1, { timeout: 5000 });
      const result = page.locator('.markora-file-browser__result').first();
      await expect(result.locator('.markora-file-browser__result-snippet mark')).toHaveText(
        /installation/i,
      );
      await expect(
        page.locator('.markora-file-browser__result-path', { hasText: 'node_modules' }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('security: browsing and searching a folder makes zero network requests', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      const externalRequests: string[] = [];
      page.on('request', (req) => {
        if (!req.url().startsWith('chrome-extension://')) externalRequests.push(req.url());
      });

      await openFolder(page);
      await page.locator('.markora-file-browser__search').fill('guide');
      await expect(page.locator('.markora-file-browser__result')).toHaveCount(1, { timeout: 5000 });

      expect(externalRequests).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 4 — performance budgets P7/P8 (docs/specs/06-testing-quality-gate.md §1a)', () => {
  test('P7: scanning a 1,000-file tree keeps every main-thread task under 200ms and shows first entries quickly', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, buildLargeTree(), 'big-folder');
      await page.evaluate(() => {
        (window as unknown as { __longTasks: number[] }).__longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      });

      const start = Date.now();
      await page
        .locator('.markora-empty-state')
        .getByRole('button', { name: 'Open folder' })
        .click();
      await expect(page.locator('.markora-file-browser__file-button').first()).toBeVisible({
        timeout: 2000,
      });
      const firstEntriesElapsed = Date.now() - start;

      await expect(page.locator('.markora-file-browser__status')).toHaveText(/1000 files/, {
        timeout: 15_000,
      });

      const longTasks = await page.evaluate(
        () => (window as unknown as { __longTasks: number[] }).__longTasks,
      );
      const worst = longTasks.length ? Math.max(...longTasks) : 0;

      console.log(
        `P7: first entries visible after ${firstEntriesElapsed}ms; worst main-thread task ${worst}ms`,
      );
      expect(firstEntriesElapsed).toBeLessThan(500);
      expect(worst).toBeLessThan(200);
    } finally {
      await context.close();
    }
  });

  test('P7: Cancel takes effect quickly on a large scan', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, buildLargeTree(), 'big-folder');
      await page
        .locator('.markora-empty-state')
        .getByRole('button', { name: 'Open folder' })
        .click();
      await expect(page.locator('.markora-file-browser__cancel')).toBeVisible();

      const start = Date.now();
      await page.locator('.markora-file-browser__cancel').click();
      await expect(page.locator('.markora-file-browser__status')).toHaveText('Cancelled', {
        timeout: 2000,
      });
      const elapsed = Date.now() - start;

      console.log(`P7: Cancel took effect after ${elapsed}ms`);
      // Budget is <100ms at the application level; this also carries
      // Playwright's own click-dispatch/evaluate round-trip overhead, so a
      // looser bound is used here to avoid CI-noise flakiness while still
      // catching a real regression (e.g. cancellation stuck behind a full
      // scan completing first).
      expect(elapsed).toBeLessThan(500);
    } finally {
      await context.close();
    }
  });

  test('P8: folder search across 1,000 files keeps every main-thread task under 50ms (P3 holds)', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, buildLargeTree(), 'big-folder');
      await openFolder(page);

      await page.evaluate(() => {
        (window as unknown as { __longTasks: number[] }).__longTasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      });

      await page.locator('.markora-file-browser__search').fill('file-5');
      // Cross-workspace search status is its own element now (Phase 13
      // multi-workspace) — deliberately not `.markora-file-browser__status`,
      // which stays scoped to one workspace's own scan status so it's
      // unambiguous with N workspaces open.
      await expect(page.locator('.markora-file-browser__search-status')).toHaveText(/results/, {
        timeout: 15_000,
      });

      const longTasks = await page.evaluate(
        () => (window as unknown as { __longTasks: number[] }).__longTasks,
      );
      const worst = longTasks.length ? Math.max(...longTasks) : 0;
      console.log(`P8: worst main-thread task during search ${worst}ms`);
      expect(worst).toBeLessThan(50);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 4 — Folder bookmarks (F21)', () => {
  test('bookmarking the open folder adds it to the list; removing it clears the toggle', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewerWithFakeFolder(context, SAMPLE_TREE);
      await openFolder(page);

      const toggle = page.locator('.markora-file-browser__bookmark-toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(
        page.locator('.markora-file-browser__bookmark-open', { hasText: 'test-folder' }),
      ).toBeVisible();
      await expect(toggle).toHaveClass(/--active/);

      await page.locator('.markora-file-browser__bookmark-remove').click();
      await expect(page.locator('.markora-file-browser__bookmark-open')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 4 — Auto-refresh (F23, F74)', () => {
  test('an external edit to the open file (Flow B) is reflected within one polling interval', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const settingsPage = await context.newPage();
      await settingsPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await settingsPage.getByRole('tab', { name: 'Files' }).click();
      await settingsPage.getByLabel('Auto-refresh interval (ms)').fill('300');
      await settingsPage.getByLabel('Auto-refresh interval (ms)').press('Tab');
      await settingsPage.close();

      const tree: FakeNode[] = [{ name: 'live.md', kind: 'file', content: 'version one' }];
      const page = await openViewerWithFakeFolder(context, tree);
      await openFolder(page);
      await page.locator('.markora-file-browser__file-button', { hasText: 'live.md' }).click();
      await expect(page.locator('body')).toHaveAttribute('data-markora-status', 'rendered', {
        timeout: 10_000,
      });
      await expect(page.locator('.markora-content')).toContainText('version one');

      await editFakeFile(page, 'live.md', 'version two');

      await expect(page.locator('.markora-content')).toContainText('version two', {
        timeout: 5000,
      });
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 4 — Recent documents (F22, F59, F75) and Clear Cache (F55)', () => {
  test('popup groups recents by source/domain, supports search, remove-one and clear-all', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const seedPage = await context.newPage();
      await seedPage.goto(`chrome-extension://${extensionId}/src/settings/index.html`);
      await seedPage.evaluate(async () => {
        const recents = [
          {
            id: 'r1',
            title: 'local-doc.md',
            sourceType: 'local',
            identifier: 'file:///local-doc.md',
            lastOpenedAt: 3,
          },
          {
            id: 'r2',
            title: 'readme',
            sourceType: 'remote',
            identifier: 'https://raw.githubusercontent.com/a/b/README.md',
            domain: 'raw.githubusercontent.com',
            lastOpenedAt: 2,
          },
        ];
        await chrome.storage.local.set({ 'markora.recents': recents });
      });

      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
      await popupPage.getByRole('tab', { name: 'Recent' }).click();

      // Exact locators, not getByText substring matches: Phase 10's popup
      // card layout added a real relative-time + identifier meta line under
      // each entry (docs/MARKORA_UI_UX_IMPLEMENTATION_PLAN.md Phase 10), and
      // both real identifiers here ('file:///local-doc.md',
      // '.../raw.githubusercontent.com/...') contain these same substrings,
      // which made a plain getByText ambiguous (title button + meta line).
      await expect(popupPage.getByRole('button', { name: 'local-doc.md' })).toBeVisible();
      await expect(
        popupPage.locator('.markora-popup__recent-group summary', {
          hasText: 'raw.githubusercontent.com',
        }),
      ).toBeVisible();

      await popupPage.locator('.markora-popup__recent-search').fill('local-doc');
      await expect(popupPage.getByText('readme')).toHaveCount(0);
      await popupPage.locator('.markora-popup__recent-search').fill('');

      await popupPage.locator('.markora-popup__recent-remove').first().click();
      await expect(popupPage.locator('.markora-popup__recent-entry')).toHaveCount(1);

      // Two-step arm/disarm confirmation (Phase 4 UI/UX polish), same
      // pattern as Settings' Clear Cache / Delete all annotations: the
      // first click only arms it, the second actually clears.
      const clearAllButton = popupPage.getByRole('button', { name: 'Clear all', exact: true });
      await clearAllButton.click();
      await expect(popupPage.getByText('Click again to confirm')).toBeVisible();
      await expect(popupPage.locator('.markora-popup__recent-entry')).toHaveCount(1);

      await popupPage.getByRole('button', { name: 'Click again to confirm' }).click();
      await expect(popupPage.getByText('No recent documents yet.')).toBeVisible();

      await seedPage.close();
      await popupPage.close();
    } finally {
      await context.close();
    }
  });

  test('Clear Cache clears exactly recents/bookmarks/handoffs, never settings', async () => {
    const context = await launchExtension();
    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/settings/index.html`);

      await page.evaluate(async () => {
        await chrome.storage.local.set({
          'markora.recents': [
            { id: 'r1', title: 'x', sourceType: 'local', identifier: '/x.md', lastOpenedAt: 1 },
          ],
          'markora.bookmarks': [{ id: 'b1', name: 'docs', handleId: 'h1', createdAt: 1 }],
          'markora.settings': { theme: 'dark' },
        });
      });

      await page.getByRole('tab', { name: 'Storage' }).click();
      const clearButton = page.getByRole('button', { name: 'Clear cache' });
      await clearButton.click();
      await page.getByRole('button', { name: 'Click again to confirm' }).click();
      await expect(page.getByText('Cache cleared')).toBeVisible();

      const remaining = await page.evaluate(async () => {
        const stored = await chrome.storage.local.get([
          'markora.recents',
          'markora.bookmarks',
          'markora.settings',
        ]);
        return stored;
      });
      expect(remaining['markora.recents']).toEqual([]);
      expect(remaining['markora.bookmarks']).toEqual([]);
      expect((remaining['markora.settings'] as { theme: string }).theme).toBe('dark');
    } finally {
      await context.close();
    }
  });
});
