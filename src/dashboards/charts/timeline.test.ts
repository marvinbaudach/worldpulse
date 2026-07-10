import { describe, it, expect } from 'vitest';
import { statusTimeline, type StatusTimelineCfg } from './timeline';
import { SETTLED_T } from '../types';
import type { Frame } from '../draw';
import { createFakeContext } from '../../test/fakeCanvas';

function frameAt(t: number, h = 640): Frame & { ctx: ReturnType<typeof createFakeContext> } {
  const w = 512;
  return { ctx: createFakeContext(w, h), w, h, t, u: w / 512 };
}

const CFG: StatusTimelineCfg = {
  label: 'Chatkontrolle · Nachrichtenscan',
  status: { text: 'Vorerst gestoppt', kind: 'blocked' },
  milestones: [
    { date: '05·2022', text: 'Kommission schlägt Aufdeckungsanordnungen vor', kind: 'proposed' },
    { date: '11·2023', text: 'EU-Parlament schützt Verschlüsselung', kind: 'blocked' },
    { date: '10·2025', text: 'Sperrminorität kippt die Scan-Pflicht', kind: 'blocked' },
  ],
  source: 'EU-Kommission · EU-Rat',
};

describe('statusTimeline', () => {
  it('draws intro and settled frames without throwing, and paints something', () => {
    for (const t of [0, SETTLED_T]) {
      const f = frameAt(t);
      expect(() => statusTimeline(f, CFG)).not.toThrow();
      expect(f.ctx.calls.length).toBeGreaterThan(0);
    }
  });

  it('handles a single milestone (skips the connecting spine)', () => {
    const f = frameAt(SETTLED_T);
    const one: StatusTimelineCfg = { ...CFG, milestones: [CFG.milestones[0]] };
    expect(() => statusTimeline(f, one)).not.toThrow();
  });

  it('renders each status kind without throwing', () => {
    const kinds = [
      'proposed',
      'adopted',
      'inforce',
      'blocked',
      'court',
      'past',
      'now',
      'forecast',
    ] as const;
    for (const kind of kinds) {
      const f = frameAt(SETTLED_T);
      const cfg: StatusTimelineCfg = {
        ...CFG,
        status: { text: 'X', kind },
        milestones: [{ date: '2024', text: 'y', kind }],
      };
      expect(() => statusTimeline(f, cfg)).not.toThrow();
    }
  });

  it('survives the compact (mobile) frame', () => {
    const f = { ...frameAt(SETTLED_T, 420), compact: true };
    expect(() => statusTimeline(f, CFG)).not.toThrow();
  });

  it('dashes the spine into a forecast milestone', () => {
    const f = frameAt(SETTLED_T);
    const cfg: StatusTimelineCfg = {
      ...CFG,
      status: { text: 'Wir stehen hier', kind: 'now' },
      milestones: [
        { date: '2022', text: 'passiert', kind: 'past' },
        { date: '~2033', text: 'Prognose', kind: 'forecast' },
      ],
    };
    statusTimeline(f, cfg);
    expect(f.ctx.calls).toContain('setLineDash');
  });
});
