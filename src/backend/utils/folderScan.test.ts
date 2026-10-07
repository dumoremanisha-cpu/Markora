import { describe, expect, it } from 'vitest';
import { collectScan, matchesFileTypeFilter, scanFolder } from './folderScan';
import { makeFakeDirectoryHandle } from './testFsFixtures';

function buildTree() {
  return makeFakeDirectoryHandle('root', [
    { name: 'README.md', kind: 'file', content: '# Hi' },
    { name: 'notes.txt', kind: 'file', content: 'plain text' },
    {
      name: 'docs',
      kind: 'directory',
      children: [{ name: 'guide.md', kind: 'file', content: 'guide' }],
    },
    {
      name: 'node_modules',
      kind: 'directory',
      children: [{ name: 'ignored.md', kind: 'file', content: 'should not appear' }],
    },
    { name: '.git', kind: 'directory', children: [{ name: 'HEAD', kind: 'file' }] },
  ]);
}

describe('scanFolder', () => {
  it('walks nested directories, skipping excluded directory names entirely', async () => {
    const entries = await collectScan(buildTree(), {
      exclusions: ['node_modules', '.git', 'dist'],
    });
    const paths = entries.map((e) => e.path).sort();
    expect(paths).toEqual(['README.md', 'docs', 'docs/guide.md', 'notes.txt']);
  });

  it('yields directory entries in addition to files', async () => {
    const entries = await collectScan(buildTree(), { exclusions: [] });
    const dirs = entries.filter((e) => e.kind === 'directory').map((e) => e.name);
    expect(dirs.sort()).toEqual(['.git', 'docs', 'node_modules']);
  });

  it('respects an AbortSignal, stopping without throwing', async () => {
    const controller = new AbortController();
    const entries = [];
    for await (const entry of scanFolder(buildTree(), {
      exclusions: [],
      signal: controller.signal,
    })) {
      entries.push(entry);
      controller.abort();
    }
    expect(entries.length).toBe(1);
  });

  it('records correct depth', async () => {
    const entries = await collectScan(buildTree(), { exclusions: ['node_modules', '.git'] });
    const guide = entries.find((e) => e.path === 'docs/guide.md');
    expect(guide?.depth).toBe(1);
    const readme = entries.find((e) => e.path === 'README.md');
    expect(readme?.depth).toBe(0);
  });
});

describe('matchesFileTypeFilter', () => {
  it('markdownOnly excludes .txt', () => {
    expect(matchesFileTypeFilter('a.md', 'markdownOnly')).toBe(true);
    expect(matchesFileTypeFilter('a.mdx', 'markdownOnly')).toBe(true);
    expect(matchesFileTypeFilter('a.txt', 'markdownOnly')).toBe(false);
    expect(matchesFileTypeFilter('a.png', 'markdownOnly')).toBe(false);
  });

  it('allSupportedText includes .txt but not arbitrary extensions', () => {
    expect(matchesFileTypeFilter('a.txt', 'allSupportedText')).toBe(true);
    expect(matchesFileTypeFilter('a.md', 'allSupportedText')).toBe(true);
    expect(matchesFileTypeFilter('a.png', 'allSupportedText')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchesFileTypeFilter('A.MD', 'markdownOnly')).toBe(true);
  });
});
