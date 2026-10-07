import { describe, expect, it } from 'vitest';
import { createHandoff, readAndDeleteHandoff, sweepExpiredHandoffs } from './handoff';

describe('handoff store (ADR-0006 §2)', () => {
  it('round-trips a record and deletes it on read (single-use)', async () => {
    const token = await createHandoff('https://example.com/readme.md', 'hello world', {
      addressBarEntered: true,
    });

    const first = await readAndDeleteHandoff(token);
    expect(first?.text).toBe('hello world');
    expect(first?.url).toBe('https://example.com/readme.md');
    expect(first?.hints.addressBarEntered).toBe(true);

    const second = await readAndDeleteHandoff(token);
    expect(second).toBeUndefined();
  });

  it('sweeps a record older than the TTL', async () => {
    const token = await createHandoff('https://example.com/old.md', 'stale', {
      addressBarEntered: false,
    });

    // Simulate the record having been created well past the TTL.
    await sweepExpiredHandoffs(Date.now() + 10 * 60_000);

    const record = await readAndDeleteHandoff(token);
    expect(record).toBeUndefined();
  });

  it('leaves an unexpired record alone when sweeping', async () => {
    const token = await createHandoff('https://example.com/fresh.md', 'fresh', {
      addressBarEntered: false,
    });
    await sweepExpiredHandoffs();
    const record = await readAndDeleteHandoff(token);
    expect(record?.text).toBe('fresh');
  });
});
