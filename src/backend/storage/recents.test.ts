import { describe, expect, it } from 'vitest';
import {
  extractDomain,
  groupRecents,
  matchesRecentQuery,
  removeRecentById,
  upsertRecent,
} from './recents';
import type { RecentEntry } from './schema';

function entry(overrides: Partial<RecentEntry>): RecentEntry {
  return {
    id: 'id-1',
    title: 'doc.md',
    sourceType: 'local',
    identifier: '/path/doc.md',
    lastOpenedAt: 1,
    ...overrides,
  };
}

describe('upsertRecent', () => {
  it('prepends a new entry', () => {
    const list = upsertRecent([], entry({ id: 'a' }));
    expect(list).toEqual([entry({ id: 'a' })]);
  });

  it('updates timestamp/position instead of duplicating on reopen (F75)', () => {
    const first = entry({ id: 'a', identifier: '/x.md', lastOpenedAt: 1 });
    const other = entry({ id: 'b', identifier: '/y.md', lastOpenedAt: 2 });
    const reopened = entry({ id: 'a', identifier: '/x.md', lastOpenedAt: 3, title: 'renamed.md' });

    const list = upsertRecent(upsertRecent([first], other), reopened);

    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(reopened);
    expect(list.filter((e) => e.identifier === '/x.md')).toHaveLength(1);
  });

  it('treats local and remote entries with the same identifier as distinct', () => {
    const local = entry({ id: 'a', sourceType: 'local', identifier: 'README.md' });
    const remote = entry({ id: 'b', sourceType: 'remote', identifier: 'README.md' });
    const list = upsertRecent(upsertRecent([], local), remote);
    expect(list).toHaveLength(2);
  });

  it('enforces the cap, dropping the oldest (least-recently-touched) entries', () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < 5; i++) {
      list = upsertRecent(list, entry({ id: `id-${i}`, identifier: `/${i}.md` }), 3);
    }
    expect(list).toHaveLength(3);
    expect(list.map((e) => e.id)).toEqual(['id-4', 'id-3', 'id-2']);
  });
});

describe('removeRecentById', () => {
  it('removes exactly the matching entry', () => {
    const list = [entry({ id: 'a' }), entry({ id: 'b' })];
    expect(removeRecentById(list, 'a')).toEqual([entry({ id: 'b' })]);
  });
});

describe('groupRecents', () => {
  it('separates local from remote and groups remote by domain, most-recent group first', () => {
    const list: RecentEntry[] = [
      entry({ id: '1', sourceType: 'remote', identifier: 'https://a.com/x', domain: 'a.com' }),
      entry({ id: '2', sourceType: 'local', identifier: '/local.md' }),
      entry({ id: '3', sourceType: 'remote', identifier: 'https://b.com/y', domain: 'b.com' }),
      entry({ id: '4', sourceType: 'remote', identifier: 'https://a.com/z', domain: 'a.com' }),
    ];

    const { local, remoteGroups } = groupRecents(list);

    expect(local.map((e) => e.id)).toEqual(['2']);
    expect(remoteGroups.map((g) => g.domain)).toEqual(['a.com', 'b.com']);
    expect(remoteGroups[0]?.entries.map((e) => e.id)).toEqual(['1', '4']);
    expect(remoteGroups[1]?.entries.map((e) => e.id)).toEqual(['3']);
  });
});

describe('extractDomain', () => {
  it('extracts the hostname', () => {
    expect(extractDomain('https://raw.githubusercontent.com/a/b/README.md')).toBe(
      'raw.githubusercontent.com',
    );
  });

  it('returns undefined for a non-URL', () => {
    expect(extractDomain('not a url')).toBeUndefined();
  });
});

describe('matchesRecentQuery', () => {
  it('matches on title or identifier, case-insensitively', () => {
    const e = entry({ title: 'Getting Started', identifier: '/docs/GETTING.md' });
    expect(matchesRecentQuery(e, 'started')).toBe(true);
    expect(matchesRecentQuery(e, 'getting.md')).toBe(true);
    expect(matchesRecentQuery(e, 'nope')).toBe(false);
    expect(matchesRecentQuery(e, '')).toBe(true);
  });
});
