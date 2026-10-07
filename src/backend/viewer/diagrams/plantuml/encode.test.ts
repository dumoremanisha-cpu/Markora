import { describe, expect, it } from 'vitest';
import { encodePlantumlSource } from './encode';

describe('encodePlantumlSource (F14, plantuml.com/text-encoding)', () => {
  // Verified during development: this exact source, run through the
  // reference `plantuml-encoder` npm package's algorithm (UTF-8 -> raw
  // DEFLATE -> PlantUML's custom base64-like alphabet) and independently
  // round-tripped against the real public plantuml.com server, produces
  // this exact encoded string and a valid rendered diagram.
  it('matches the reference algorithm for a known diagram', async () => {
    const source = '@startuml\nBob -> Alice : hello\n@enduml';
    const encoded = await encodePlantumlSource(source);
    expect(encoded).toBe('SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKifpSq10000');
  });

  it('only ever contains the documented URL-safe alphabet', async () => {
    const encoded = await encodePlantumlSource(
      '@startuml\nclass Foo {\n  +bar(): void\n}\n@enduml',
    );
    expect(encoded).toMatch(/^[0-9A-Za-z_-]+$/);
  });

  it('produces different output for different source (not a constant/stub)', async () => {
    const a = await encodePlantumlSource('@startuml\nA -> B\n@enduml');
    const b = await encodePlantumlSource('@startuml\nX -> Y -> Z\n@enduml');
    expect(a).not.toBe(b);
  });
});
