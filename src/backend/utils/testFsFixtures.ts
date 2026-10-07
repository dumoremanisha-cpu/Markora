// In-memory fake File System Access handles for unit tests (vitest) and, via
// window.showDirectoryPicker shadowing, Playwright e2e tests. Real handles
// can't be fabricated outside a real Chrome window (DEVELOPMENT.md Spike
// 3), so this fixture stands in for the parts of the API this codebase
// actually calls: `values()`, `kind`, `name`, `getFile()`. Not a `.test.ts`
// file — a shared helper imported by test files, per vitest.config.ts's
// `include` glob.

export type FakeTreeNode =
  | { name: string; kind: 'file'; content?: string; lastModified?: number }
  | { name: string; kind: 'directory'; children: FakeTreeNode[] };

function makeFakeFileHandle(node: Extract<FakeTreeNode, { kind: 'file' }>): FileSystemFileHandle {
  return {
    kind: 'file',
    name: node.name,
    // A fake File-like object, not `new File(...)`: jsdom's File polyfill
    // doesn't implement `.text()` (only real browsers do), and production
    // code (folderSearch.ts) calls it — this fixture must actually work
    // under vitest's jsdom environment, not just type-check.
    getFile: async () =>
      ({
        name: node.name,
        lastModified: node.lastModified ?? Date.now(),
        text: async () => node.content ?? '',
      }) as unknown as File,
  } as unknown as FileSystemFileHandle;
}

export function makeFakeDirectoryHandle(
  name: string,
  children: FakeTreeNode[],
): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle> {
      const items = children.map((child) =>
        child.kind === 'directory'
          ? makeFakeDirectoryHandle(child.name, child.children)
          : makeFakeFileHandle(child),
      );
      let i = 0;
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        async next() {
          if (i < items.length) return { value: items[i++]!, done: false };
          return { value: undefined, done: true };
        },
      } as AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    },
    getDirectoryHandle: async (childName: string) => {
      const child = children.find((c) => c.kind === 'directory' && c.name === childName);
      if (!child || child.kind !== 'directory')
        throw new DOMException('Not found', 'NotFoundError');
      return makeFakeDirectoryHandle(child.name, child.children);
    },
    getFileHandle: async (childName: string) => {
      const child = children.find((c) => c.kind === 'file' && c.name === childName);
      if (!child || child.kind !== 'file') throw new DOMException('Not found', 'NotFoundError');
      return makeFakeFileHandle(child);
    },
    queryPermission: async () => 'granted' as PermissionState,
    requestPermission: async () => 'granted' as PermissionState,
  };
  return handle as unknown as FileSystemDirectoryHandle;
}
