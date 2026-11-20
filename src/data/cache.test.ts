import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cached, clearDataCache, fetchJson } from './cache';

const PREFIX = 'gallery:data:v1:';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('cached', () => {
  it('computes on a miss and serves the cached value within the TTL', async () => {
    const compute = vi.fn().mockResolvedValue({ v: 1 });
    const first = await cached('k', 1000, compute);
    const second = await cached('k', 1000, compute);
    expect(first).toEqual({ v: 1 });
    expect(second).toEqual({ v: 1 });
    expect(compute).toHaveBeenCalledTimes(1); // second call was a cache hit
  });

  it('recomputes once the TTL has expired', async () => {
    const compute = vi.fn().mockResolvedValue({ v: 1 });
    await cached('k', 1000, compute);
    vi.setSystemTime(1500); // past the 1000ms TTL
    await cached('k', 1000, compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('falls through to a fresh compute on a corrupt cache entry', async () => {
    localStorage.setItem(`${PREFIX}k`, 'not valid json');
    const result = await cached('k', 1000, () => Promise.resolve('fresh'));
    expect(result).toBe('fresh');
  });
});

describe('clearDataCache', () => {
  it('removes only the prefixed derived-data entries', () => {
    localStorage.setItem(`${PREFIX}a`, '1');
    localStorage.setItem(`${PREFIX}b`, '2');
    localStorage.setItem('worldpulse-favorites', 'keep-me');
    clearDataCache();
    expect(localStorage.getItem(`${PREFIX}a`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}b`)).toBeNull();
    expect(localStorage.getItem('worldpulse-favorites')).toBe('keep-me');
  });
});

describe('fetchJson', () => {
  it('resolves the parsed body on a 2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ a: 1 }) }),
    );
    await expect(fetchJson('https://example.test/data')).resolves.toEqual({ a: 1 });
  });

  it('throws with the status code on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );
    await expect(fetchJson('https://example.test/down')).rejects.toThrow(/503/);
  });
});
