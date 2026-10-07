import { describe, expect, it } from 'vitest';
import { searchFolder } from './folderSearch';
import { makeFakeDirectoryHandle } from './testFsFixtures';

function buildTree() {
  return makeFakeDirectoryHandle('root', [
    { name: 'README.md', kind: 'file', content: 'Welcome to the project. Installation is easy.' },
    { name: 'guide.md', kind: 'file', content: 'Nothing relevant here.' },
    { name: 'install-notes.md', kind: 'file', content: 'Details about Installation steps.' },
    { name: 'image.png', kind: 'file', content: 'binary-ish' },
    {
      name: 'node_modules',
      kind: 'directory',
      children: [{ name: 'installation.md', kind: 'file', content: 'installation' }],
    },
  ]);
}

async function collect(gen: AsyncGenerator<unknown>) {
  const out = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe('searchFolder', () => {
  it('matches on filename', async () => {
    const results = await collect(
      searchFolder(buildTree(), 'install', {
        exclusions: ['node_modules'],
        fileTypeFilter: 'markdownOnly',
      }),
    );
    const paths = results.map((r) => (r as { path: string }).path).sort();
    expect(paths).toEqual(['README.md', 'install-notes.md']);
  });

  it('matches on content, case-insensitively, with a highlighted snippet', async () => {
    const results = (await collect(
      searchFolder(buildTree(), 'installation', {
        exclusions: ['node_modules'],
        fileTypeFilter: 'markdownOnly',
      }),
    )) as Array<{
      path: string;
      contentSnippet?: string;
      contentMatchRange?: [number, number];
    }>;

    const readme = results.find((r) => r.path === 'README.md');
    expect(readme?.contentSnippet).toContain('Installation');
    const [start, end] = readme!.contentMatchRange!;
    expect(readme!.contentSnippet!.slice(start, end).toLowerCase()).toBe('installation');
  });

  it('respects the exclusion list', async () => {
    const results = await collect(
      searchFolder(buildTree(), 'installation', {
        exclusions: ['node_modules'],
        fileTypeFilter: 'markdownOnly',
      }),
    );
    expect(results.some((r) => (r as { path: string }).path.includes('node_modules'))).toBe(false);
  });

  it('respects the file-type filter (markdownOnly skips non-Markdown files)', async () => {
    const results = await collect(
      searchFolder(buildTree(), 'binary', { exclusions: [], fileTypeFilter: 'markdownOnly' }),
    );
    expect(results).toHaveLength(0);
  });

  it('yields nothing for an empty query', async () => {
    const results = await collect(
      searchFolder(buildTree(), '   ', { exclusions: [], fileTypeFilter: 'markdownOnly' }),
    );
    expect(results).toHaveLength(0);
  });

  it('is cancellable via AbortSignal', async () => {
    const controller = new AbortController();
    const results = [];
    for await (const r of searchFolder(buildTree(), 'e', {
      exclusions: ['node_modules'],
      fileTypeFilter: 'markdownOnly',
      signal: controller.signal,
    })) {
      results.push(r);
      controller.abort();
    }
    expect(results.length).toBe(1);
  });
});
