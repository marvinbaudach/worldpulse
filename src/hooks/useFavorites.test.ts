import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFavorites } from './useFavorites';
import { getFavorites, toggleFavorite } from '../favorites';

// Two real, long-lived card ids (see dashboards). The favorites store is a
// module singleton shared with the hook, so drain it around every test —
// vi.resetModules() is off-limits (it would split the store from the hook).
const A = 'us-debt';
const B = 'nukes';

function drainFavorites(): void {
  for (const id of getFavorites()) toggleFavorite(id);
}

beforeEach(() => {
  drainFavorites();
});

afterEach(() => {
  cleanup();
  drainFavorites();
});

describe('useFavorites', () => {
  it('starts empty when nothing is starred', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current).toEqual([]);
  });

  it('reflects a star added after mount, in insertion order', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => toggleFavorite(A));
    act(() => toggleFavorite(B));
    expect(result.current).toEqual([A, B]);
  });

  it('drops an id when it is un-starred', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => toggleFavorite(A));
    act(() => toggleFavorite(B));
    act(() => toggleFavorite(A));
    expect(result.current).toEqual([B]);
  });

  it('hands out a stable reference between changes (safe for useSyncExternalStore)', () => {
    const { result, rerender } = renderHook(() => useFavorites());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('seeds from the store when a star already exists at mount', () => {
    act(() => toggleFavorite(A));
    const { result } = renderHook(() => useFavorites());
    expect(result.current).toEqual([A]);
  });

  it('stops updating once unmounted', () => {
    const { result, unmount } = renderHook(() => useFavorites());
    unmount();
    act(() => toggleFavorite(A));
    expect(result.current).toEqual([]);
  });
});
