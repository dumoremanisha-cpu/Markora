// Pure, DOM-free folder-scan logic shared by the folder browser (F19, F65)
// and folder search (F20) — both must "reuse the same progressive/
// cancellable scan and exclusion list" (Phase 4 plan task 6). Depends only
// on the File System Access API surface (works against a real
// FileSystemDirectoryHandle or an in-memory fake — see
// src/utils/testFsFixtures.ts), never the DOM, so it's directly
// unit-testable.
export interface ScanEntry {
  /** Slash-joined path relative to the scan root, e.g. "docs/guide.md". */
  path: string;
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  depth: number;
}

export interface ScanOptions {
  /** F63 — directory names skipped entirely (not descended into, not yielded). */
  exclusions: string[];
  /** Stops the scan early; checked before processing each entry so Cancel takes effect quickly (P7: <100ms). */
  signal?: AbortSignal;
}

/**
 * Depth-first walk of `root`, yielding every directory and file entry not
 * under an excluded directory. Each `for await` step is a real async
 * boundary (the underlying FileSystemDirectoryHandle iterator is
 * inherently I/O-bound), which is what keeps a long scan from blocking the
 * main thread for any single long stretch — see ARCHITECTURE.md's Phase 4
 * entry for why this is main-thread-cooperative rather than a dedicated
 * Worker. File-type filtering is deliberately not applied here (see
 * `matchesFileTypeFilter`) so changing the filter never requires a rescan.
 */
export async function* scanFolder(
  root: FileSystemDirectoryHandle,
  options: ScanOptions,
  basePath = '',
  depth = 0,
): AsyncGenerator<ScanEntry> {
  for await (const handle of root.values()) {
    if (options.signal?.aborted) return;
    const path = basePath ? `${basePath}/${handle.name}` : handle.name;
    if (handle.kind === 'directory') {
      if (options.exclusions.includes(handle.name)) continue;
      yield { path, name: handle.name, kind: 'directory', handle, depth };
      yield* scanFolder(handle, options, path, depth + 1);
    } else {
      yield { path, name: handle.name, kind: 'file', handle, depth };
    }
  }
}

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdx'];
export const ALL_SUPPORTED_TEXT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, '.txt'];

/** F64 — Markdown-only vs. all-supported-text file-list narrowing. */
export function matchesFileTypeFilter(
  name: string,
  filter: 'markdownOnly' | 'allSupportedText',
): boolean {
  const lower = name.toLowerCase();
  const extensions =
    filter === 'markdownOnly' ? MARKDOWN_EXTENSIONS : ALL_SUPPORTED_TEXT_EXTENSIONS;
  return extensions.some((ext) => lower.endsWith(ext));
}

/** Convenience collector for callers (tests, quick-open) that want the whole scan rather than progressive consumption. */
export async function collectScan(
  root: FileSystemDirectoryHandle,
  options: ScanOptions,
): Promise<ScanEntry[]> {
  const entries: ScanEntry[] = [];
  for await (const entry of scanFolder(root, options)) entries.push(entry);
  return entries;
}
