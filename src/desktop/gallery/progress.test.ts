import { describe, expect, it } from 'vitest';
import { progressPct } from './progress';

describe('progressPct', () => {
  it('is 100 when there is nothing to render', () => expect(progressPct(0, 0)).toBe(100));
  it('is 0 at the start', () => expect(progressPct(0, 200)).toBe(0));
  it('floors to an integer percent', () => expect(progressPct(1, 3)).toBe(33));
  it('never exceeds 100', () => expect(progressPct(210, 200)).toBe(100));
  it('only reads 100 when truly complete (199/200 is 99, not done)', () => {
    expect(progressPct(199, 200)).toBe(99);
    expect(progressPct(200, 200)).toBe(100);
  });
});
