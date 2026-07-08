// Persistent favorites: card ids in the order they were starred. Backed by
// localStorage with a silent in-memory fallback (private-mode Safari), and a
// tiny pub/sub in the same shape as data/store.ts. Ids of cards that have
// since left the pool are dropped on load.
import { ALL_DASHBOARDS, DASHBOARDS_BY_ID } from './dashboards';
import type { Dashboard } from './dashboards';

const KEY = 'worldpulse-favorites';
const KNOWN = new Set(ALL_DASHBOARDS.map((d) => d.id));

function load(): readonly string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && KNOWN.has(id));
  } catch {
    return [];
  }
}

let favorites: readonly string[] = load();
const listeners = new Set<() => void>();

/** Stable reference between changes — safe for useSyncExternalStore. */
export function getFavorites(): readonly string[] {
  return favorites;
}

export function isFavorite(id: string): boolean {
  return favorites.includes(id);
}

export function toggleFavorite(id: string): void {
  favorites = favorites.includes(id)
    ? favorites.filter((f) => f !== id)
    : [...favorites, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(favorites));
  } catch {
    // Storage unavailable (private mode / quota): keep working in memory.
  }
  for (const fn of listeners) fn();
}

export function onFavoritesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Snapshot of the starred cards as dashboards, in starring order. Both views
 * assemble their FAVORITEN deck from this at stage time — a snapshot, not a
 * live binding, so un-starring while browsing never restructures the deck.
 */
export function favoriteDashboards(limit = Infinity): Dashboard[] {
  return favorites
    .slice(0, limit)
    .map((id) => DASHBOARDS_BY_ID[id])
    .filter((d): d is Dashboard => d !== undefined);
}
