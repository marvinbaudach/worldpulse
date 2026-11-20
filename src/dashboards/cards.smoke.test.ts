import { describe, it, expect } from 'vitest';
import { DASHBOARDS_BY_ID, SETTLED_T } from './index';
import type { Dashboard } from './index';
import type { Frame } from './draw';
import { createFakeContext } from '../test/fakeCanvas';

// The whole pool, keyed off the id map so every card is covered exactly once
// (independent of the tag-clustering that builds ALL_DASHBOARDS).
const CARDS: Dashboard[] = Object.values(DASHBOARDS_BY_ID);

// A card-sized frame (512px reference → u = 1). No live data is loaded,
// so each card must fall back to its bundled/seeded series to render — which is
// exactly the offline path we want to guarantee never throws.
function frameAt(t: number): Frame & { ctx: ReturnType<typeof createFakeContext> } {
  const w = 512;
  const h = 640; // 4:5, the panel aspect
  return { ctx: createFakeContext(w, h), w, h, t, u: w / 512 };
}

describe('card integrity (offline draw)', () => {
  it('registers a substantial pool', () => {
    expect(CARDS.length).toBeGreaterThan(50);
  });

  it('gives every card a draw function', () => {
    for (const card of CARDS) {
      expect(typeof card.draw).toBe('function');
    }
  });

  it.each(CARDS.map((c) => [c.id, c] as const))(
    'card "%s" draws without throwing (intro + settled)',
    (_id, card) => {
      for (const t of [0, SETTLED_T]) {
        const f = frameAt(t);
        expect(() => card.draw(f)).not.toThrow();
        // A panel that painted nothing is a bug in itself — every card draws a
        // surface at minimum.
        expect(f.ctx.calls.length).toBeGreaterThan(0);
      }
    },
  );
});
