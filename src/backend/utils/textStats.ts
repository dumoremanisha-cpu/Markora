// Document statistics (F17), with CJK-aware word counting (F71):
// docs/specs/01-functional-requirements.md §11. Pure, DOM-free — operates on
// already-extracted rendered plain text.

// CJK Unicode ranges relevant to word counting: Hiragana/Katakana, CJK
// Unified Ideographs (+ compatibility block), Hangul syllables. Each
// character in these ranges counts as one "word" — naive whitespace
// splitting drastically undercounts CJK text, which isn't whitespace-
// delimited the way Latin-script text is.
const CJK_CHAR_REGEX = /[぀-ヿ㐀-䶿一-鿿가-힣豈-﫿]/u;
const WHITESPACE_REGEX = /\s/;

// A global-flagged clone of CJK_CHAR_REGEX (built from its .source rather
// than a second literal, so the Unicode range stays defined in exactly one
// place) — needed for the match()/replace() calls below, which require the
// `g` flag CJK_CHAR_REGEX itself deliberately doesn't carry (a global regex
// object has mutable lastIndex state that a shared single-character
// CJK_CHAR_REGEX.test(ch) caller must not have to reason about).
const CJK_CHAR_REGEX_GLOBAL = new RegExp(CJK_CHAR_REGEX.source, 'gu');

export interface DocumentStats {
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
}

const WORDS_PER_MINUTE = 200;

// A large document (e.g. a multi-MB file) has millions of characters; a
// manual per-character loop calling RegExp#test() up to twice per
// character turns this into a single, unchunked, multi-second main-thread
// task when this runs from the deferred setTimeout(0) block in
// viewer/index.ts. Native String#match/replace/split do the same work as
// engine-level (C++) linear scans instead of a JS loop with per-character
// regex dispatch, cutting this to single-digit ms.
/** F71 — CJK script runs count one character as one word; everything else counts whitespace-delimited runs as words, same as ordinary text. */
export function countWords(text: string): number {
  const cjkCount = text.match(CJK_CHAR_REGEX_GLOBAL)?.length ?? 0;
  const withoutCjk = text.replace(CJK_CHAR_REGEX_GLOBAL, ' ');
  const latinWordCount = withoutCjk.split(WHITESPACE_REGEX).filter(Boolean).length;
  return cjkCount + latinWordCount;
}

export function computeDocumentStats(text: string): DocumentStats {
  const charCount = text.length;
  const wordCount = countWords(text);
  const readingTimeMinutes =
    wordCount === 0 ? 0 : Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return { wordCount, charCount, readingTimeMinutes };
}
