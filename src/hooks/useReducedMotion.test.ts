import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';
import { installMatchMedia, type MatchMediaControl } from '../test/matchMedia';

const QUERY = '(prefers-reduced-motion: reduce)';

let mm: MatchMediaControl;

afterEach(() => {
  cleanup();
  mm?.restore();
});

describe('useReducedMotion', () => {
  it('reports false when the OS is not asking for reduced motion', () => {
    mm = installMatchMedia(() => false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('reports true when the reduce query already matches at mount', () => {
    mm = installMatchMedia((q) => q === QUERY);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('tracks a live change from the OS setting', () => {
    mm = installMatchMedia(() => false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => mm.emit(QUERY, true));
    expect(result.current).toBe(true);

    act(() => mm.emit(QUERY, false));
    expect(result.current).toBe(false);
  });

  it('subscribes to exactly the reduced-motion query', () => {
    mm = installMatchMedia(() => false);
    renderHook(() => useReducedMotion());
    expect(mm.fn).toHaveBeenCalledWith(QUERY);
  });

  it('stops tracking changes after unmount', () => {
    mm = installMatchMedia(() => false);
    const { result, unmount } = renderHook(() => useReducedMotion());
    unmount();
    // Listener was removed on cleanup; emitting must not throw or resurface.
    act(() => mm.emit(QUERY, true));
    expect(result.current).toBe(false);
  });
});
