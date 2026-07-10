import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useZoomControls } from './useZoomControls';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;

// The hold-to-zoom loop reschedules itself every frame. Capture the callback
// instead of letting a real rAF spin forever, so a test can step the clock by
// hand and assert deterministic zoom deltas.
let frame: FrameRequestCallback | null = null;

function step(nowMs: number): void {
  const cb = frame;
  if (!cb) throw new Error('no animation frame scheduled');
  act(() => cb(nowMs));
}

function wheel(init: WheelEventInit): void {
  act(() => {
    window.dispatchEvent(new WheelEvent('wheel', { cancelable: true, ...init }));
  });
}

function key(type: 'keydown' | 'keyup', k: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: k }));
  });
}

beforeEach(() => {
  frame = null;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe('useZoomControls', () => {
  it('starts framed at 1x', () => {
    const { result } = renderHook(() => useZoomControls(false));
    expect(result.current).toBe(1);
  });

  describe('Ctrl + wheel', () => {
    it('dollies in on an upward (negative) delta', () => {
      const { result } = renderHook(() => useZoomControls(false));
      wheel({ deltaY: -100, ctrlKey: true });
      expect(result.current).toBeCloseTo(Math.exp(0.15), 5);
      expect(result.current).toBeGreaterThan(1);
    });

    it('dollies out on a downward (positive) delta', () => {
      const { result } = renderHook(() => useZoomControls(false));
      wheel({ deltaY: 100, ctrlKey: true });
      expect(result.current).toBeLessThan(1);
    });

    it('ignores a plain wheel without Ctrl (that scrolls the page)', () => {
      const { result } = renderHook(() => useZoomControls(false));
      wheel({ deltaY: -100, ctrlKey: false });
      expect(result.current).toBe(1);
    });

    it('idles while a hero owns the screen', () => {
      const { result } = renderHook(() => useZoomControls(true));
      wheel({ deltaY: -100, ctrlKey: true });
      expect(result.current).toBe(1);
    });

    it('clamps zoom-in to the maximum framing', () => {
      const { result } = renderHook(() => useZoomControls(false));
      wheel({ deltaY: -100000, ctrlKey: true });
      expect(result.current).toBe(ZOOM_MAX);
    });

    it('clamps zoom-out to the minimum framing', () => {
      const { result } = renderHook(() => useZoomControls(false));
      wheel({ deltaY: 100000, ctrlKey: true });
      expect(result.current).toBe(ZOOM_MIN);
    });
  });

  describe('hold +/- keys', () => {
    it('glides in while "+" is held, then holds when released', () => {
      const { result } = renderHook(() => useZoomControls(false));
      key('keydown', '+');
      step(1000); // first frame only seeds the clock (dt = 0)
      step(1500); // half a second held → a real nudge inward
      const held = result.current;
      expect(held).toBeGreaterThan(1);

      key('keyup', '+');
      step(2000);
      step(2500);
      expect(result.current).toBe(held);
    });

    it('glides out while "-" is held', () => {
      const { result } = renderHook(() => useZoomControls(false));
      key('keydown', '-');
      step(1000);
      step(1500);
      expect(result.current).toBeLessThan(1);
    });

    it('does not zoom on a modified "+" (that is a browser shortcut)', () => {
      const { result } = renderHook(() => useZoomControls(false));
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true }));
      });
      step(1000);
      step(1500);
      expect(result.current).toBe(1);
    });

    it('stays put while a hero is open even with a key held', () => {
      const { result } = renderHook(() => useZoomControls(true));
      key('keydown', '+');
      step(1000);
      step(1500);
      expect(result.current).toBe(1);
    });
  });
});
