import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { type RefObject } from 'react';
import { useDeviceTilt } from './useDeviceTilt';

// The damping loop reschedules itself; capture the frame so a test can step it.
let frame: FrameRequestCallback | null = null;

function step(now = 16): void {
  const cb = frame;
  if (!cb) throw new Error('no animation frame scheduled');
  act(() => cb(now));
}

// jsdom's DeviceOrientationEvent constructor does not accept gamma/beta in its
// init dict, so hang the sensor readings straight off a base Event — the hook
// only reads `e.gamma` / `e.beta`.
function orient(gamma: number, beta: number): void {
  const event = Object.assign(new Event('deviceorientation'), { gamma, beta });
  act(() => window.dispatchEvent(event));
}

function ref<T extends HTMLElement>(el: T): RefObject<T | null> {
  return { current: el };
}

/** Read the ring's Y-lean (deg) back out of the imperative transform string. */
function rotateYDeg(target: HTMLElement | null): number {
  const match = target?.style.transform.match(/rotateY\(([-\d.]+)deg\)/);
  return match ? Number(match[1]) : Number.NaN;
}

let card: RefObject<HTMLDivElement | null>;
let bg: RefObject<HTMLElement | null>;

beforeEach(() => {
  frame = null;
  card = ref(document.createElement('div'));
  bg = ref(document.createElement('div'));
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe('useDeviceTilt', () => {
  it('does nothing while disabled', () => {
    renderHook(() => useDeviceTilt(false, card, bg));
    orient(30, 60); // no listener is attached, so this is inert
    expect(frame).toBeNull();
    expect(card.current?.style.transform).toBe('');
    expect(bg.current?.style.transform).toBe('');
  });

  it('stays idle on a gyro-less device (no orientation ever fires)', () => {
    renderHook(() => useDeviceTilt(true, card, bg));
    expect(frame).toBeNull();
    expect(card.current?.style.transform).toBe('');
  });

  it('leans the card and parallaxes the background once a sensor reports', () => {
    renderHook(() => useDeviceTilt(true, card, bg));
    orient(30, 45); // gamma at the edge, beta at the resting point
    step();

    expect(card.current?.style.transform).toMatch(/rotateY\(.*deg\) rotateX\(.*deg\)/);
    // Background shifts opposite the deck for parallax.
    expect(bg.current?.style.transform).toMatch(/translate\(.*px, .*px\)/);
  });

  it('drifts toward the target across successive frames', () => {
    renderHook(() => useDeviceTilt(true, card, bg));
    orient(30, 45);
    step();
    const firstY = rotateYDeg(card.current);
    step();
    const secondY = rotateYDeg(card.current);
    // Low-pass filter eases toward the tilt, so the angle grows frame over frame.
    expect(secondY).toBeGreaterThan(firstY);
  });

  it('resets both layers when disabled mid-tilt', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useDeviceTilt(enabled, card, bg),
      { initialProps: { enabled: true } },
    );
    orient(30, 45);
    step();
    expect(card.current?.style.transform).not.toBe('');

    rerender({ enabled: false });
    expect(card.current?.style.transform).toBe('');
    expect(bg.current?.style.transform).toBe('');
  });

  it('clears its transforms on unmount', () => {
    const { unmount } = renderHook(() => useDeviceTilt(true, card, bg));
    orient(30, 45);
    step();
    unmount();
    expect(card.current?.style.transform).toBe('');
    expect(bg.current?.style.transform).toBe('');
  });
});
