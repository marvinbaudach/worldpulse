import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMotionPermission } from './useMotionPermission';

const MOTION_KEY = 'worldpulse-motion';

type RequestPermission = () => Promise<'granted' | 'denied'>;
type DOE = typeof DeviceOrientationEvent & { requestPermission?: RequestPermission };

// jsdom's DeviceOrientationEvent has no requestPermission (i.e. it looks like a
// non-iOS browser). Adding one flips the hook into its iOS gated-permission
// branch; removing it restores the implicit-grant path.
function setRequestPermission(fn: RequestPermission | undefined): void {
  if (fn) (DeviceOrientationEvent as DOE).requestPermission = fn;
  else delete (DeviceOrientationEvent as DOE).requestPermission;
}

afterEach(() => {
  cleanup();
  setRequestPermission(undefined);
});

describe('useMotionPermission', () => {
  it('grants implicitly where no permission prompt exists (non-iOS)', () => {
    const { result } = renderHook(() => useMotionPermission());
    expect(result.current.motion).toBe('granted');
  });

  describe('on an iOS-style gated browser', () => {
    it('starts in "ask" when the user has not answered yet', () => {
      setRequestPermission(vi.fn());
      const { result } = renderHook(() => useMotionPermission());
      expect(result.current.motion).toBe('ask');
    });

    it('restores a previously stored decision', () => {
      setRequestPermission(vi.fn());
      localStorage.setItem(MOTION_KEY, 'denied');
      const { result } = renderHook(() => useMotionPermission());
      expect(result.current.motion).toBe('denied');
    });

    it('ignores a corrupt stored value and falls back to "ask"', () => {
      setRequestPermission(vi.fn());
      localStorage.setItem(MOTION_KEY, 'maybe');
      const { result } = renderHook(() => useMotionPermission());
      expect(result.current.motion).toBe('ask');
    });

    it('grants and persists when the prompt is accepted', async () => {
      setRequestPermission(vi.fn().mockResolvedValue('granted'));
      const { result } = renderHook(() => useMotionPermission());

      await act(async () => {
        await result.current.askMotion();
      });

      expect(result.current.motion).toBe('granted');
      expect(localStorage.getItem(MOTION_KEY)).toBe('granted');
    });

    it('denies and persists when the prompt is rejected', async () => {
      setRequestPermission(vi.fn().mockResolvedValue('denied'));
      const { result } = renderHook(() => useMotionPermission());

      await act(async () => {
        await result.current.askMotion();
      });

      expect(result.current.motion).toBe('denied');
      expect(localStorage.getItem(MOTION_KEY)).toBe('denied');
    });

    it('treats a thrown permission request as a denial', async () => {
      setRequestPermission(vi.fn().mockRejectedValue(new Error('gesture required')));
      const { result } = renderHook(() => useMotionPermission());

      await act(async () => {
        await result.current.askMotion();
      });

      expect(result.current.motion).toBe('denied');
      expect(localStorage.getItem(MOTION_KEY)).toBe('denied');
    });

    it('silently re-arms a prior grant on the first tap of the session', async () => {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      setRequestPermission(requestPermission);
      localStorage.setItem(MOTION_KEY, 'granted');

      renderHook(() => useMotionPermission());
      // The re-grant piggybacks on the first pointer gesture, not on mount.
      expect(requestPermission).not.toHaveBeenCalled();

      await act(async () => {
        window.dispatchEvent(new PointerEvent('pointerdown'));
      });

      expect(requestPermission).toHaveBeenCalledTimes(1);
    });
  });
});
