import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useIsMobile, MOBILE_QUERY } from './useIsMobile';
import { installMatchMedia, type MatchMediaControl } from '../test/matchMedia';

let mm: MatchMediaControl;

afterEach(() => {
  cleanup();
  mm?.restore();
});

describe('useIsMobile', () => {
  it('is false on a wide, fine-pointer viewport', () => {
    mm = installMatchMedia(() => false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('is true when the mobile query matches at mount', () => {
    mm = installMatchMedia((q) => q === MOBILE_QUERY);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('re-evaluates when the viewport crosses the breakpoint', () => {
    mm = installMatchMedia(() => false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => mm.emit(MOBILE_QUERY, true));
    expect(result.current).toBe(true);

    act(() => mm.emit(MOBILE_QUERY, false));
    expect(result.current).toBe(false);
  });

  it('queries the exported MOBILE_QUERY (shared with the loader choreography)', () => {
    mm = installMatchMedia(() => false);
    renderHook(() => useIsMobile());
    expect(mm.fn).toHaveBeenCalledWith(MOBILE_QUERY);
    expect(MOBILE_QUERY).toBe('(max-width: 820px), (pointer: coarse)');
  });

  it('detaches its listener on unmount', () => {
    mm = installMatchMedia(() => false);
    const { result, unmount } = renderHook(() => useIsMobile());
    unmount();
    act(() => mm.emit(MOBILE_QUERY, true));
    expect(result.current).toBe(false);
  });
});
