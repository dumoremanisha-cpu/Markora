// Folder full-text search (F20). Reuses scanFolder's progressive/cancellable
// walk and exclusion list (Phase 4 plan task 6) and the existing
// substring-range finder from in-document search (F49) for both filename
// and content matching/highlighting, rather than a third implementation.
import { findMatchRanges } from '../../frontend/components/search/matches';
import type { MatchRange } from '../../frontend/components/search/matches';
import { matchesFileTypeFilter, scanFolder } from './folderScan';

export interface FolderSearchOptions {
  exclusions: string[];
  fileTypeFilter: 'markdownOnly' | 'allSupportedText';
  signal?: AbortSignal;
}

export interface FolderSearchMatch {
  path: string;
  name: string;
  handle: FileSystemFileHandle;
  filenameMatchRanges: MatchRange[];
  /** First content match only, previewed with surrounding context (F20 "result highlighting"). */
  contentSnippet?: string;
  contentMatchRange?: MatchRange;
}

const SNIPPET_CONTEXT = 40;

export async function* searchFolder(
  root: FileSystemDirectoryHandle,
  query: string,
  options: FolderSearchOptions,
): AsyncGenerator<FolderSearchMatch> {
  if (!query.trim()) return;

  for await (const entry of scanFolder(root, {
    exclusions: options.exclusions,
    signal: options.signal,
  })) {
    if (options.signal?.aborted) return;
    if (entry.kind !== 'file') continue;
    if (!matchesFileTypeFilter(entry.name, options.fileTypeFilter)) continue;

    const fileHandle = entry.handle as FileSystemFileHandle;
    const filenameMatchRanges = findMatchRanges(entry.name, query);

    let contentSnippet: string | undefined;
    let contentMatchRange: MatchRange | undefined;
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      const first = findMatchRanges(text, query)[0];
      if (first) {
        const [start, end] = first;
        const from = Math.max(0, start - SNIPPET_CONTEXT);
        const to = Math.min(text.length, end + SNIPPET_CONTEXT);
        // Replace newlines/tabs 1:1 with spaces (not a whitespace-collapsing
        // regex) so the computed highlight offsets below stay exact.
        const raw = text.slice(from, to).replace(/[\n\r\t]/g, ' ');
        const prefix = from > 0 ? '…' : '';
        const suffix = to < text.length ? '…' : '';
        contentSnippet = prefix + raw + suffix;
        contentMatchRange = [start - from + prefix.length, end - from + prefix.length];
      }
    } catch {
      // Unreadable file (permission revoked mid-scan, race with an external
      // delete): filename match, if any, still counts; content is skipped.
    }

    if (filenameMatchRanges.length > 0 || contentSnippet) {
      yield {
        path: entry.path,
        name: entry.name,
        handle: fileHandle,
        filenameMatchRanges,
        contentSnippet,
        contentMatchRange,
      };
    }
  }
}
