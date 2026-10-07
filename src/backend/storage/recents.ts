// Pure recents logic (F22, F59, F75) — kept dependency-free of chrome.* so
// it's unit-testable without a browser/extension context, matching this
// codebase's convention (src/content/detect.ts, src/components/toc/tree.ts).
import type { RecentEntry } from './schema';
import { RECENTS_CAP } from './schema';

/**
 * Inserts `candidate` at the front of `list`, removing any existing entry
 * with the same `sourceType`+`identifier` first (F75 duplicate detection:
 * reopening updates the existing entry's timestamp/position rather than
 * appending a new row) and enforcing the soft cap (oldest pruned first,
 * ADR-0004).
 */
export function upsertRecent(
  list: RecentEntry[],
  candidate: RecentEntry,
  cap: number = RECENTS_CAP,
): RecentEntry[] {
  const withoutDuplicate = list.filter(
    (entry) =>
      !(entry.sourceType === candidate.sourceType && entry.identifier === candidate.identifier),
  );
  return [candidate, ...withoutDuplicate].slice(0, cap);
}

export function removeRecentById(list: RecentEntry[], id: string): RecentEntry[] {
  return list.filter((entry) => entry.id !== id);
}

export interface RemoteRecentGroup {
  domain: string;
  entries: RecentEntry[];
}

export interface GroupedRecents {
  local: RecentEntry[];
  remoteGroups: RemoteRecentGroup[];
}

/**
 * Groups recents for the popup's display (F59): local files in one
 * collapsible group, remote entries further grouped by domain. Assumes
 * `list` is already ordered most-recent-first (the storage wrapper
 * maintains this via `upsertRecent`) — group order follows first
 * appearance, so the most recently active domain's group sorts first.
 */
export function groupRecents(list: RecentEntry[]): GroupedRecents {
  const local: RecentEntry[] = [];
  const remoteGroups: RemoteRecentGroup[] = [];
  const groupByDomain = new Map<string, RemoteRecentGroup>();

  for (const entry of list) {
    if (entry.sourceType === 'local') {
      local.push(entry);
      continue;
    }
    const domain = entry.domain ?? '';
    let group = groupByDomain.get(domain);
    if (!group) {
      group = { domain, entries: [] };
      groupByDomain.set(domain, group);
      remoteGroups.push(group);
    }
    group.entries.push(entry);
  }

  return { local, remoteGroups };
}

/** Extracts the hostname for domain grouping (F75); returns undefined for non-URL identifiers. */
export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function matchesRecentQuery(entry: RecentEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return entry.title.toLowerCase().includes(q) || entry.identifier.toLowerCase().includes(q);
}
