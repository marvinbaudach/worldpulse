import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useDismissOnOutsideTap } from './useDismissOnOutsideTap';

const ATTR = 'data-dismiss-test';

let inside: HTMLElement;
let insideChild: HTMLElement;
let outside: HTMLElement;

function tap(target: HTMLElement): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}

beforeEach(() => {
  inside = document.createElement('div');
  inside.setAttribute(ATTR, '');
  insideChild = document.createElement('button');
  inside.appendChild(insideChild);

  outside = document.createElement('div');
  document.body.append(inside, outside);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useDismissOnOutsideTap', () => {
  it('does nothing while closed', () => {
    const close = vi.fn();
    renderHook(() => useDismissOnOutsideTap(false, ATTR, close));
    tap(outside);
    expect(close).not.toHaveBeenCalled();
  });

  it('dismisses on a tap outside the marked element', () => {
    const close = vi.fn();
    renderHook(() => useDismissOnOutsideTap(true, ATTR, close));
    tap(outside);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps open when tapping the marked element itself', () => {
    const close = vi.fn();
    renderHook(() => useDismissOnOutsideTap(true, ATTR, close));
    tap(inside);
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps open when tapping a descendant of the marked element', () => {
    const close = vi.fn();
    renderHook(() => useDismissOnOutsideTap(true, ATTR, close));
    tap(insideChild);
    expect(close).not.toHaveBeenCalled();
  });

  it('detaches the listener when it toggles closed', () => {
    const close = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useDismissOnOutsideTap(open, ATTR, close),
      { initialProps: { open: true } },
    );
    rerender({ open: false });
    tap(outside);
    expect(close).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const close = vi.fn();
    const { unmount } = renderHook(() => useDismissOnOutsideTap(true, ATTR, close));
    unmount();
    tap(outside);
    expect(close).not.toHaveBeenCalled();
  });
});
