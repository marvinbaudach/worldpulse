import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { RefObject } from 'react';
import type { RingMotion } from '../components/cameraMotion';

// The ring lives in an R3F <Canvas>: `useThree` hands it the WebGL renderer
// (only `gl.domElement` is used, as the event surface) and `useFrame` registers
// the per-frame animation. Stub both so the whole gesture + animation loop runs
// in jsdom, with the frame callback captured for manual stepping.
const h = vi.hoisted(() => ({
  gl: null as { domElement: HTMLCanvasElement } | null,
  frames: [] as Array<(state: { clock: { elapsedTime: number } }, delta: number) => void>,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { gl: unknown }) => unknown) => selector({ gl: h.gl }),
  useFrame: (cb: (state: { clock: { elapsedTime: number } }, delta: number) => void) => {
    h.frames.push(cb);
  },
}));

import { useCarouselRotation } from './useCarouselRotation';

type Group = { rotation: { x: number; y: number; z: number }; position: { x: number; y: number; z: number } };

function makeGroup(): Group {
  return { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } };
}

let el: HTMLCanvasElement;

beforeEach(() => {
  el = document.createElement('canvas');
  // jsdom implements neither, and the drag path calls both.
  (el as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn();
  (el as unknown as { releasePointerCapture: () => void }).releasePointerCapture = vi.fn();
  h.gl = { domElement: el };
  h.frames.length = 0;
});

afterEach(() => {
  cleanup();
});

type Options = Parameters<typeof useCarouselRotation>[0];

function setup(opts: Options = {}) {
  const motion: RefObject<RingMotion> = {
    current: { rotation: 0, velocity: 0, dragging: false } as RingMotion,
  };
  const pausedBox = { value: false };
  const { result, unmount } = renderHook(() =>
    useCarouselRotation({ motion, paused: () => pausedBox.value, ...opts }),
  );
  const group = makeGroup();
  const tilt = makeGroup();
  result.current.groupRef.current = group as never;
  result.current.tiltRef.current = tilt as never;
  return { api: result.current, motion, pausedBox, group, tilt, unmount };
}

function frame(t = 0, dt = 1 / 60): void {
  act(() => h.frames[0]({ clock: { elapsedTime: t } }, dt));
}

function pointer(type: string, clientX: number, clientY: number): void {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { clientX, clientY, pointerId: 1, bubbles: true }));
  });
}

function keydown(key: string): void {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key })));
}

function wheel(deltaY: number, ctrlKey = false): void {
  act(() => {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey, cancelable: true, bubbles: true }));
  });
}

describe('useCarouselRotation', () => {
  it('exposes the ring handle (refs + gesture helpers)', () => {
    const { api } = setup();
    expect(api.groupRef).toBeDefined();
    expect(api.tiltRef).toBeDefined();
    expect(typeof api.wasDrag).toBe('function');
    expect(typeof api.spinTo).toBe('function');
  });

  it('coasts at the idle auto-spin when untouched', () => {
    const { motion } = setup({ autoSpin: 0.12 });
    frame(0);
    frame(2); // past the assemble swirl
    expect(motion.current.velocity).toBeCloseTo(0.12, 5);
    expect(motion.current.dragging).toBe(false);
  });

  it('publishes the applied rotation and breathes vertically each frame', () => {
    const { motion, group } = setup();
    frame(0.5);
    expect(motion.current.rotation).toBe(group.rotation.y);
    // Idle "breathing" bob — never dead still.
    expect(group.position.y).not.toBe(0);
  });

  it('kicks the spin left on ArrowLeft and right on ArrowRight', () => {
    const left = setup();
    keydown('ArrowLeft');
    frame();
    expect(left.motion.current.velocity).toBeGreaterThan(0.5);

    cleanup();
    h.frames.length = 0;
    const right = setup();
    keydown('ArrowRight');
    frame();
    expect(right.motion.current.velocity).toBeLessThan(0);
  });

  it('spins from a mouse wheel but ignores Ctrl+wheel (that is the zoom)', () => {
    const spun = setup({ wheelSensitivity: 0.004 });
    wheel(-100);
    frame();
    expect(spun.motion.current.velocity).toBeGreaterThan(0.3);

    cleanup();
    h.frames.length = 0;
    const zoomed = setup({ autoSpin: 0.12 });
    wheel(-100, true);
    frame();
    expect(zoomed.motion.current.velocity).toBeCloseTo(0.12, 5);
  });

  it('reports a real drag apart from a click via wasDrag()', () => {
    const { api } = setup();
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 2, 1); // 3px total — under the click threshold
    pointer('pointerup', 2, 1);
    expect(api.wasDrag()).toBe(false);

    pointer('pointerdown', 0, 0);
    pointer('pointermove', 40, 0); // well past the 6px threshold
    expect(api.wasDrag()).toBe(true);
  });

  it('tilts the ring on a vertical drag', () => {
    const { tilt } = setup({ initialTilt: -0.32, tiltSensitivity: 0.005 });
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 0, 100); // drag down → tip toward viewer
    frame();
    expect(tilt.rotation.x).toBeGreaterThan(-0.32);
  });

  it('holds still while paused, reporting a resting pose', () => {
    const { motion, pausedBox } = setup();
    pausedBox.value = true;
    frame();
    expect(motion.current.velocity).toBe(0);
    expect(motion.current.dragging).toBe(false);
  });

  it('is not grabbable while paused', () => {
    const { api, pausedBox } = setup();
    pausedBox.value = true;
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 40, 0);
    expect(api.wasDrag()).toBe(false); // the drag never started
  });

  it('eases a requested slot to the front while paused (spinTo)', () => {
    const { api, group, pausedBox } = setup();
    pausedBox.value = true;
    act(() => api.spinTo(Math.PI / 2)); // front rotation is the negated azimuth
    for (let i = 0; i < 30; i++) frame(i / 60);
    expect(group.rotation.y).toBeLessThan(-1.0); // converging toward -π/2
  });

  it('sets a grab cursor while mounted and clears it on unmount', () => {
    const { unmount } = setup();
    expect(el.style.cursor).toBe('grab');
    unmount();
    expect(el.style.cursor).toBe('');
  });
});
