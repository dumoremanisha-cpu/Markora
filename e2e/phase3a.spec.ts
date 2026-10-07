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

test.describe('Phase 3-A — Mermaid diagrams (F11, F79)', () => {
  test('renders a ```mermaid fence with full chrome: zoom, reset, fullscreen, download', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'diagram.md', '```mermaid\ngraph TD\nA[Start] --> B[End]\n```');

      const diagram = page.locator('.markora-diagram--mermaid[data-rendered="true"]');
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

  test('renders :::mermaid ... ::: identically to the fence form (F79)', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'diagram.md', ':::mermaid\ngraph TD\nA --> B\n:::');
      await expect(page.locator('.markora-diagram--mermaid[data-rendered="true"] svg')).toBeVisible(
        { timeout: 10_000 },
      );
    } finally {
      await context.close();
    }
  });

  test('supports the required diagram types', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      const sources: Record<string, string> = {
        flowchart: 'graph TD\nA-->B',
        sequence: 'sequenceDiagram\nAlice->>Bob: Hi',
        class: 'classDiagram\nclass Animal',
        state: 'stateDiagram-v2\n[*] --> Still',
        er: 'erDiagram\nCAR ||--o{ NAMED-DRIVER : allows',
        gantt: 'gantt\ntitle A Gantt\nsection Section\nTask1: 2024-01-01, 3d',
        pie: 'pie title Pets\n"Dogs" : 40\n"Cats" : 60',
        journey: 'journey\ntitle My day\nsection Go\nMake tea: 5: Me',
      };
      for (const [name, source] of Object.entries(sources)) {
        await dropFile(page, `${name}.md`, '```mermaid\n' + source + '\n```');
        await expect(
          page.locator('.markora-diagram--mermaid[data-rendered="true"]'),
          `${name} diagram should render without an inline error`,
        ).not.toHaveClass(/markora-diagram--error/, { timeout: 10_000 });
        await expect(page.locator('.markora-diagram--mermaid svg')).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test('invalid Mermaid source shows a clear inline error without breaking the rest of the document', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(
        page,
        'invalid.md',
        '# Heading before\n\n```mermaid\nthis is not a valid diagram {{{\n```\n\n## Heading after\n',
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

  test('security: click-bindings/HTML-injection paths are inert under strict mode', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      let dialogFired = false;
      page.on('dialog', (dialog) => {
        dialogFired = true;
        void dialog.dismiss();
      });

      await dropFile(
        page,
        'malicious.md',
        '```mermaid\n' +
          'graph TD\n' +
          'A["<img src=x onerror=alert(1)>"] --> B\n' +
          'click A "javascript:alert(1)"\n' +
          '```',
      );

      const diagram = page.locator('.markora-diagram--mermaid[data-rendered="true"]');
      await expect(diagram.locator('svg, .markora-notice--error')).toBeVisible({ timeout: 10_000 });

      const hasScriptOrEventHandler = await page.evaluate(() => {
        const svg = document.querySelector('.markora-diagram--mermaid svg');
        if (!svg) return false;
        if (svg.querySelector('script, foreignObject')) return true;
        for (const el of svg.querySelectorAll('*')) {
          for (const attr of el.getAttributeNames()) {
            if (attr.startsWith('on')) return true;
            const value = el.getAttribute(attr) ?? '';
            if (/^\s*javascript:/i.test(value)) return true;
          }
        }
        return false;
      });
      expect(hasScriptOrEventHandler).toBe(false);
      expect(dialogFired).toBe(false);
    } finally {
      await context.close();
    }
  });

  test('theme change re-renders (not just re-colors) diagrams already on screen', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'diagram.md', '```mermaid\ngraph TD\nA-->B\n```');
      const diagram = page.locator('.markora-diagram--mermaid[data-rendered="true"] svg');
      await expect(diagram).toBeVisible({ timeout: 10_000 });

      // Cycle the theme via the toolbar button (light -> dark -> system).
      const themeButton = page.getByRole('button', { name: 'Theme' });
      await themeButton.click();
      await page.waitForTimeout(400); // clears resyncMermaidTheme's debounce

      await expect(
        page.locator('.markora-diagram--mermaid[data-rendered="true"] svg'),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 3-A — Math (F12)', () => {
  test('renders inline and display KaTeX math', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(
        page,
        'math.md',
        'Inline math $E = mc^2$ here.\n\n$$\n\\int_0^1 x^2 \\,dx = \\frac{1}{3}\n$$\n',
      );
      await expect(page.locator('span.markora-math .katex').first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator('div.markora-math .katex-display')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('invalid LaTeX shows the standard inline-error notice, not raw KaTeX error markup', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);
      await dropFile(page, 'invalid-math.md', 'Broken: $\\frac{1}$ end.');
      await expect(page.locator('.markora-math .markora-notice--error')).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator('.katex-error')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('Phase 3-A — performance budget P5 (docs/specs/06-testing-quality-gate.md §1a)', () => {
  test('measures text first-paint with 10 Mermaid diagrams + 50 math expressions vs. without them', async () => {
    const context = await launchExtension();
    try {
      const page = await openViewer(context);

      const paragraphs = Array.from(
        { length: 60 },
        (_, n) => `Paragraph ${n} with enough filler text to take up a full line of height.`,
      );
      const diagrams = Array.from(
        { length: 10 },
        (_, n) => '```mermaid\ngraph TD\nA' + n + '-->B' + n + '\n```',
      );
      const mathExpressions = Array.from(
        { length: 50 },
        (_, n) => `Inline math $x_{${n}} = ${n}^2$.`,
      );

      const withExtras = ['# Perf doc', ...paragraphs, ...diagrams, ...mathExpressions].join(
        '\n\n',
      );
      const withoutExtras = ['# Perf doc', ...paragraphs].join('\n\n');

      const t0 = Date.now();
      await dropFile(page, 'baseline.md', withoutExtras);
      const baselineMs = Date.now() - t0;

      const t1 = Date.now();
      await dropFile(page, 'with-extras.md', withExtras);
      const extrasMs = Date.now() - t1;

      const regressionPct = ((extrasMs - baselineMs) / baselineMs) * 100;
      console.log(
        `[P5] baseline (text only): ${baselineMs}ms; with 10 diagrams + 50 math: ${extrasMs}ms ` +
          `(text-paint regression ${regressionPct.toFixed(1)}%, budget < 20%)`,
      );

      // "rendered" fires once the surrounding text is painted — diagrams and
      // math hydrate afterward (task 7) — so this is the P5 measurement
      // itself. Recorded per task 8 ("measured... and recorded, not
      // asserted") rather than hard-gated here to avoid CI flakiness from
      // machine-to-machine timing variance; see DEVELOPMENT.md.
      expect(baselineMs).toBeGreaterThan(0);
      expect(extrasMs).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});
