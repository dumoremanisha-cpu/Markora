import { describe, expect, it, vi, afterEach } from 'vitest';
import { Document, Packer } from 'docx';
import JSZip from 'jszip';
import { parseMarkdownTokens } from '../../viewer/markdown';
import { mapTokensToDocx } from './astMapper';
import type { MathRasterizer } from './math';
import type { Annotation } from '../../storage/schema';

const noRaster: MathRasterizer = async () => null;

interface BuildOptions {
  annotations?: Annotation[];
  includeAnnotations?: boolean;
  blockRemoteImages?: boolean;
}

async function buildZip(markdown: string, options: BuildOptions = {}) {
  const { tokens } = parseMarkdownTokens(markdown, {
    blockRemoteImages: options.blockRemoteImages,
  });
  const mapped = await mapTokensToDocx({
    tokens,
    lineBreaks: false,
    annotations: options.annotations ?? [],
    includeAnnotations: options.includeAnnotations ?? true,
    rasterizeMath: noRaster,
  });
  const doc = new Document({
    sections: [{ children: mapped.children }],
    footnotes: mapped.footnotes,
    endnotes: mapped.endnotes,
    comments: { children: mapped.comments },
    numbering: mapped.numbering,
  });
  const buffer = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buffer);
  return zip;
}

async function documentXml(markdown: string, options: BuildOptions = {}): Promise<string> {
  const zip = await buildZip(markdown, options);
  return zip.file('word/document.xml')!.async('text');
}

function makeAnnotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    documentId: 'doc',
    exactText: 'world',
    prefix: '',
    suffix: '',
    charOffsetAtCreation: 0,
    contentFingerprint: 'x',
    type: 'highlight',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    status: 'active',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('astMapper — headings and inline formatting', () => {
  it('maps an H1 heading', async () => {
    const xml = await documentXml('# Hello');
    expect(xml).toContain('Heading1');
    expect(xml).toContain('Hello');
  });

  it('maps bold, italic, and strikethrough', async () => {
    const xml = await documentXml('**bold** *italic* ~~gone~~');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('<w:strike/>');
  });

  it('maps inline code with a monospace font', async () => {
    const xml = await documentXml('Use `code()` here.');
    expect(xml).toContain('code()');
    expect(xml).toContain('Consolas');
  });
});

describe('astMapper — lists', () => {
  it('maps an unordered list with numbering properties', async () => {
    const xml = await documentXml('- one\n- two');
    expect(xml).toContain('one');
    expect(xml).toContain('<w:numPr>');
  });

  it('maps an ordered list with its own numbering reference', async () => {
    const zip = await buildZip('1. first\n2. second');
    const documentXmlText = await zip.file('word/document.xml')!.async('text');
    const numberingXml = await zip.file('word/numbering.xml')?.async('text');
    expect(documentXmlText).toContain('first');
    expect(numberingXml).toBeTruthy();
  });

  it('maps task list items with checkbox glyphs and checked state', async () => {
    const xml = await documentXml('- [ ] todo\n- [x] done');
    expect(xml).toContain('☐');
    expect(xml).toContain('☑');
    expect(xml).toContain('todo');
    expect(xml).toContain('done');
  });
});

describe('astMapper — blockquotes, code blocks, tables, hr', () => {
  it('maps a blockquote as indented paragraphs', async () => {
    const xml = await documentXml('> quoted text');
    expect(xml).toContain('quoted text');
    expect(xml).toContain('<w:ind ');
  });

  it('maps a fenced code block with shading', async () => {
    const xml = await documentXml('```js\nconst x = 1;\n```');
    // highlight.js splits this across several styled runs (keyword vs.
    // plain vs. number) — assert on the pieces, not one contiguous string.
    expect(xml).toContain('const');
    expect(xml).toContain('1');
    expect(xml).toContain('Consolas');
    expect(xml).toContain('F6F8FA');
  });

  it('maps a table with column alignment', async () => {
    const xml = await documentXml('| A | B |\n|:--|--:|\n| left | right |');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('left');
    expect(xml).toContain('right');
    expect(xml).toMatch(/<w:jc w:val="(left|right)"/);
  });

  it('maps a thematic break', async () => {
    const xml = await documentXml('above\n\n---\n\nbelow');
    expect(xml).toContain('above');
    expect(xml).toContain('below');
  });
});

describe('astMapper — links and footnotes', () => {
  it('maps an http(s) link as a hyperlink relationship', async () => {
    const zip = await buildZip('[go](https://example.com)');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('text');
    expect(rels).toContain('https://example.com');
  });

  it('does not create a hyperlink for a disallowed scheme, but keeps the text', async () => {
    const xml = await documentXml('[click](javascript:alert(1))');
    expect(xml).not.toContain('<w:hyperlink');
    expect(xml).toContain('click');
  });

  it('maps a footnote to a real OOXML footnote part', async () => {
    const zip = await buildZip('Body text.[^1]\n\n[^1]: The note.');
    const documentXmlText = await zip.file('word/document.xml')!.async('text');
    const footnotesXml = await zip.file('word/footnotes.xml')?.async('text');
    expect(documentXmlText).toContain('footnoteReference');
    expect(footnotesXml).toContain('The note.');
  });
});

describe('astMapper — math tiers', () => {
  it('renders a tier-1 construct as native OMML', async () => {
    const xml = await documentXml('Inline $x^2$ math.');
    expect(xml).toContain('m:oMath');
  });

  it('falls back to italic source text for an unsupported construct with no rasterizer available', async () => {
    const xml = await documentXml('Inline $\\int_0^1 x\\,dx$ math.');
    expect(xml).toContain('int_0^1');
  });
});

describe('astMapper — annotations', () => {
  it('applies highlight shading to the annotated run', async () => {
    const annotation = makeAnnotation({ type: 'highlight', exactText: 'world' });
    const xml = await documentXml('Hello world.', { annotations: [annotation] });
    expect(xml).toContain('w:highlight');
  });

  it('applies underline to the annotated run', async () => {
    const annotation = makeAnnotation({ type: 'underline', exactText: 'world' });
    const xml = await documentXml('Hello world.', { annotations: [annotation] });
    expect(xml).toMatch(/<w:u w:val="single"/);
  });

  it('places a resolvable comment as a native Word comment', async () => {
    const annotation = makeAnnotation({
      type: 'comment',
      exactText: 'world',
      commentText: 'a note',
    });
    const zip = await buildZip('Hello world.', { annotations: [annotation] });
    const documentXmlText = await zip.file('word/document.xml')!.async('text');
    const commentsXml = await zip.file('word/comments.xml')?.async('text');
    expect(documentXmlText).toContain('commentReference');
    expect(commentsXml).toContain('a note');
  });

  it('falls back to an endnote when a comment resolves but never overlaps an emitted run (never silently dropped)', async () => {
    // Math content counts toward the token-plain-text used for annotation
    // resolution (tokenPlainText.ts) but never routes through the
    // annotation-aware text-run emission path (astMapper.ts's `math_inline`
    // case) — so an annotation anchored entirely inside it resolves as
    // "active" yet can never actually be placed as a native comment.
    const annotation = makeAnnotation({
      type: 'comment',
      exactText: 'x^2',
      commentText: 'orphaned note',
    });
    const zip = await buildZip('Inline $x^2$ math.', { annotations: [annotation] });
    const documentXmlText = await zip.file('word/document.xml')!.async('text');
    const endnotesXml = await zip.file('word/endnotes.xml')?.async('text');
    const commentsXml = await zip.file('word/comments.xml')?.async('text');
    expect(documentXmlText).toContain('endnoteReference');
    expect(endnotesXml).toContain('orphaned note');
    expect(commentsXml ?? '').not.toContain('orphaned note');
  });

  it('omits all annotation formatting when includeAnnotations is false', async () => {
    const annotation = makeAnnotation({ type: 'highlight', exactText: 'world' });
    const xml = await documentXml('Hello world.', {
      annotations: [annotation],
      includeAnnotations: false,
    });
    expect(xml).not.toContain('w:highlight');
  });
});

describe('astMapper — images', () => {
  it('degrades to an alt-text placeholder when the image fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }) as Response),
    );
    const xml = await documentXml('![a broken image](https://example.com/missing.png)');
    expect(xml).toContain('a broken image');
  });

  it('security-privacy.md §1 point 4: a "Block remote images" image becomes a hyperlink, never fetched', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const zip = await buildZip('![a remote photo](https://example.com/photo.png)', {
      blockRemoteImages: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    const xml = await zip.file('word/document.xml')!.async('text');
    expect(xml).toContain('<w:hyperlink');
    expect(xml).toContain('a remote photo');

    const rels = await zip.file('word/_rels/document.xml.rels')!.async('text');
    expect(rels).toContain('https://example.com/photo.png');
  });
});
