import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { RefObject } from 'react';
import { useLoaderGlobe } from './useLoaderGlobe';
import { CONVERGE_MS } from './loaderConstants';
import { installMatchMedia, type MatchMediaControl } from '../../test/matchMedia';

const REDUCE = '(prefers-reduced-motion: reduce)';

// jsdom has no 2D canvas context; a no-op stand-in lets the draw loop run so the
// hook's observable contract (schedule → converge → onLeave → cancel) is what we
// assert, not the pixels (those belong to the Playwright suite).
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: () => () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

let mm: MatchMediaControl;
let raf: number;
let frame: FrameRequestCallback | null;
let rafSpy: ReturnType<typeof vi.spyOn>;
let cancelSpy: ReturnType<typeof vi.spyOn>;

function canvasWith2d(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.getContext = (() => fakeCtx()) as HTMLCanvasElement['getContext'];
  return canvas;
}

function refs(canvas: HTMLCanvasElement | null, onLeave = vi.fn()) {
  return {
    canvasRef: { current: canvas } as RefObject<HTMLCanvasElement | null>,
    pctRef: { current: 0 } as RefObject<number>,
    doneRef: { current: false } as RefObject<boolean>,
    onLeave,
  };
}

function step(now: number): void {
  const cb = frame;
  if (!cb) throw new Error('no animation frame scheduled');
  act(() => cb(now));
}

beforeEach(() => {
  mm = installMatchMedia(() => false); // not reduced-motion, not mobile
  raf = 0;
  frame = null;
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb;
    return ++raf;
  });
  cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  mm.restore();
});

describe('useLoaderGlobe', () => {
  it('renders nothing and never animates under reduced motion', () => {
    mm.restore();
    mm = installMatchMedia((q) => q === REDUCE);
    const props = refs(canvasWith2d());
    renderHook(() => useLoaderGlobe(props));

    expect(rafSpy).not.toHaveBeenCalled();
    expect(props.onLeave).not.toHaveBeenCalled();
  });

  it('bails out when the canvas ref is empty', () => {
    const props = refs(null);
    expect(() => renderHook(() => useLoaderGlobe(props))).not.toThrow();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('degrades gracefully when no 2D context is available', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => null) as HTMLCanvasElement['getContext'];
    const props = refs(canvas);

    expect(() => renderHook(() => useLoaderGlobe(props))).not.toThrow();
    expect(rafSpy).not.toHaveBeenCalled();
    expect(props.onLeave).not.toHaveBeenCalled();
  });

  it('starts the animation loop on mount', () => {
    const props = refs(canvasWith2d());
    renderHook(() => useLoaderGlobe(props));
    expect(rafSpy).toHaveBeenCalled();
    expect(frame).toBeTypeOf('function');
  });

  it('fires onLeave once the convergence passes its 45% mark', () => {
    const props = refs(canvasWith2d());
    renderHook(() => useLoaderGlobe(props));

    step(1000); // boot still running
    expect(props.onLeave).not.toHaveBeenCalled();

    props.doneRef.current = true;
    step(2000); // converge clock starts here (doneAt = 2000)
    expect(props.onLeave).not.toHaveBeenCalled();

    step(2000 + CONVERGE_MS * 0.5); // past the 0.45 iris hand-off
    expect(props.onLeave).toHaveBeenCalledTimes(1);

    step(2000 + CONVERGE_MS * 0.6); // stays a single hand-off
    expect(props.onLeave).toHaveBeenCalledTimes(1);
  });

  it('cancels its pending frame on unmount', () => {
    const props = refs(canvasWith2d());
    const { unmount } = renderHook(() => useLoaderGlobe(props));
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
