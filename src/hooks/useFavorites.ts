import { useSyncExternalStore } from 'react';
import { getFavorites, onFavoritesChange } from '../favorites';

/** Reactive favorites id list (insertion order). */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(onFavoritesChange, getFavorites);
}
