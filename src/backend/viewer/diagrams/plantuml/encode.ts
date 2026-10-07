// PlantUML's own URL text-encoding (plantuml.com/text-encoding): UTF-8 ->
// raw DEFLATE -> a base64-like alphabet substitution. Hand-rolled (no
// dependency, ~25 lines) rather than pulling in a deflate library, using the
// browser's native CompressionStream — Chrome's 'deflate-raw' format is
// exactly the headerless DEFLATE PlantUML servers expect. Verified against
// the reference `plantuml-encoder` npm package's algorithm and round-tripped
// against the public plantuml.com server during development (see
// DEVELOPMENT.md).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encode6bit(b: number): string {
  return ALPHABET[b & 0x3f] ?? '?';
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function encodeBytes(bytes: Uint8Array<ArrayBuffer>): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b3 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    result += append3bytes(b1, b2, b3);
  }
  return result;
}

async function deflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Encodes PlantUML diagram source into the URL-path segment a PlantUML
 * server expects (`<server>/svg/<encoded>`) — the only thing this ever
 * sends is the diagram source itself, compressed and re-encoded, never any
 * other document content (ADR-0002, security-privacy.md §6).
 */
export async function encodePlantumlSource(source: string): Promise<string> {
  const compressed = await deflateRaw(new TextEncoder().encode(source));
  return encodeBytes(compressed);
}
