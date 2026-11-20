// localStorage cache for the *derived* dataset shapes (never the raw API
// payloads — the USGS feed alone is megabytes). Reloads within the TTL skip
// the network entirely, which keeps the free public APIs' rate limits happy.

const PREFIX = 'gallery:data:v1:';
// The prefix this cache used while the app was a 3D carousel. Nothing reads
// those entries any more; sweepLegacyCache() drops them once per page load.
const LEGACY_PREFIX = 'carousel3d:';

export async function cached<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const k = PREFIX + key;
  try {
    const hit = localStorage.getItem(k);
    if (hit) {
      const { at, data } = JSON.parse(hit) as { at: number; data: T };
      if (Date.now() - at < ttlMs) return data;
    }
  } catch {
    // Corrupt entry or storage blocked — fall through to a fresh compute.
  }
  const data = await compute();
  try {
    localStorage.setItem(k, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Quota exceeded / private mode: fine, we just refetch next visit.
  }
  return data;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

function removeByPrefix(prefix: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked (lockdown/private mode) — nothing was cached then, so
    // there is nothing to remove; same style as cached().
  }
}

/** Drop every cached derived dataset — a user-initiated refresh must hit the
    network, not the TTL cache. */
export function clearDataCache(): void {
  removeByPrefix(PREFIX);
}

/** Remove entries left behind by the pre-gallery cache prefix. */
export function sweepLegacyCache(): void {
  removeByPrefix(LEGACY_PREFIX);
}
