import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeChromeStorage {
  data: Record<string, unknown>;
}

function installFakeChrome(): FakeChromeStorage {
  const state: FakeChromeStorage = { data: {} };
  const local = {
    get: vi.fn(async (key?: string | string[] | null) => {
      if (key === null || key === undefined) return { ...state.data };
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      for (const k of keys) if (k in state.data) result[k] = state.data[k];
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(state.data, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete state.data[k];
    }),
  };
  const onChanged = { addListener: vi.fn(), removeListener: vi.fn() };
  (globalThis as { chrome: unknown }).chrome = { storage: { local, onChanged } };
  return state;
}

describe('annotation engine integration (create/edit/delete/reanchor across a reload)', () => {
  beforeEach(() => {
    installFakeChrome();
    vi.resetModules();
  });

  it('creates, persists, edits, and deletes an annotation for a document', async () => {
    const { createAnnotation, editAnnotationComment, removeAnnotation, loadAndReanchor } =
      await import('./index');

    const text = 'The quick brown fox jumps over the lazy dog';
    const start = text.indexOf('quick brown fox');
    const end = start + 'quick brown fox'.length;

    await createAnnotation({
      documentId: 'doc.md',
      plainText: text,
      start,
      end,
      exactText: 'quick brown fox',
      type: 'comment',
      commentText: 'nice phrase',
    });

    let result = await loadAndReanchor('doc.md', text);
    expect(result.active).toHaveLength(1);
    expect(result.orphaned).toHaveLength(0);
    const id = result.active[0]!.annotation.id;
    expect(result.active[0]!.annotation.commentText).toBe('nice phrase');
    expect(result.active[0]!.start).toBe(start);

    await editAnnotationComment('doc.md', id, 'updated note');
    result = await loadAndReanchor('doc.md', text);
    expect(result.active[0]!.annotation.commentText).toBe('updated note');

    await removeAnnotation('doc.md', id);
    result = await loadAndReanchor('doc.md', text);
    expect(result.active).toHaveLength(0);
  });

  it('re-anchors correctly after a minor external edit shifts the content, and orphans when the text is gone', async () => {
    const { createAnnotation, loadAndReanchor } = await import('./index');

    const original = 'The quick brown fox jumps over the lazy dog';
    const start = original.indexOf('quick brown fox');
    const end = start + 'quick brown fox'.length;
    await createAnnotation({
      documentId: 'doc.md',
      plainText: original,
      start,
      end,
      exactText: 'quick brown fox',
      type: 'highlight',
    });

    const editedButPresent = `Once upon a time, ${original}.`;
    const shiftedResult = await loadAndReanchor('doc.md', editedButPresent);
    expect(shiftedResult.active).toHaveLength(1);
    expect(shiftedResult.orphaned).toHaveLength(0);
    expect(
      editedButPresent.slice(shiftedResult.active[0]!.start, shiftedResult.active[0]!.end),
    ).toBe('quick brown fox');

    const rewritten = 'This paragraph has been completely rewritten with no trace of the original.';
    const orphanedResult = await loadAndReanchor('doc.md', rewritten);
    expect(orphanedResult.active).toHaveLength(0);
    expect(orphanedResult.orphaned).toHaveLength(1);
  });

  it('toExportableAnnotations includes only active annotations, never orphaned ones', async () => {
    const { createAnnotation, loadAndReanchor, toExportableAnnotations } = await import('./index');

    const text = 'alpha beta gamma';
    await createAnnotation({
      documentId: 'doc.md',
      plainText: text,
      start: text.indexOf('alpha'),
      end: text.indexOf('alpha') + 5,
      exactText: 'alpha',
      type: 'highlight',
    });
    await createAnnotation({
      documentId: 'doc.md',
      plainText: text,
      start: text.indexOf('gamma'),
      end: text.indexOf('gamma') + 5,
      exactText: 'gamma',
      type: 'underline',
    });

    const rewritten = 'alpha only remains here now';
    const result = await loadAndReanchor('doc.md', rewritten);
    expect(result.active).toHaveLength(1);
    expect(result.orphaned).toHaveLength(1);

    const exportable = toExportableAnnotations(result);
    expect(exportable).toHaveLength(1);
    expect(exportable[0]!.type).toBe('highlight');
  });
});
