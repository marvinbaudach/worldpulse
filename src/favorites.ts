// Persistent favorites: card ids in the order they were starred. Backed by
// localStorage with a silent in-memory fallback (private-mode Safari), and a
// tiny pub/sub in the same shape as data/store.ts. Ids of cards that have
// since left the pool are dropped on load.
import { ALL_DASHBOARDS } from './dashboards';

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
