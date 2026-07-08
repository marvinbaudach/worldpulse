// localStorage cache for the *derived* dataset shapes (never the raw API
// payloads — the USGS feed alone is megabytes). Reloads within the TTL skip
// the network entirely, which keeps the free public APIs' rate limits happy.

const PREFIX = 'carousel3d:data:v1:';

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

/** Drop every cached derived dataset — a user-initiated refresh must hit the
    network, not the TTL cache. */
export function clearDataCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked (lockdown/private mode) — nothing was cached then, so
    // the refresh proceeds against the network anyway; same style as cached().
  }
}
