import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import type { Dashboard } from '../dashboards';

// The hook lives inside an R3F <Canvas> in production. Stub the two pieces it
// borrows from that world — `useThree` (for the driver's max anisotropy) and
// the real texture factory (which rasterises a canvas) — so the memo/dispose
// lifecycle can be exercised in plain jsdom.
const h = vi.hoisted(() => ({
  maxAnisotropy: 16,
  instances: [] as Array<{
    dashboard: unknown;
    width: number;
    height: number;
    tex: { anisotropy: number };
    disposed: number;
    dispose: () => void;
  }>,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { gl: { capabilities: { getMaxAnisotropy: () => number } } } ) => unknown) =>
    selector({ gl: { capabilities: { getMaxAnisotropy: () => h.maxAnisotropy } } }),
}));

vi.mock('../dashboards', () => ({
  createDashboardTexture: (dashboard: unknown, width: number, height: number) => {
    const instance = {
      dashboard,
      width,
      height,
      tex: { anisotropy: 0 },
      disposed: 0,
      dispose(): void {
        this.disposed += 1;
      },
    };
    h.instances.push(instance);
    return instance;
  },
}));

import { useDashboardTexture } from './useDashboardTexture';

const dashA = { id: 'a' } as unknown as Dashboard;
const dashB = { id: 'b' } as unknown as Dashboard;

beforeEach(() => {
  h.maxAnisotropy = 16;
  h.instances.length = 0;
});

afterEach(() => {
  cleanup();
});

describe('useDashboardTexture', () => {
  it('builds one texture for the given dashboard and size', () => {
    const { result } = renderHook(() => useDashboardTexture(dashA, 320, 200));
    expect(h.instances).toHaveLength(1);
    expect(result.current).toBe(h.instances[0]);
    expect(h.instances[0]).toMatchObject({ dashboard: dashA, width: 320, height: 200 });
  });

  it('caps anisotropy at 8 even when the driver offers more', () => {
    renderHook(() => useDashboardTexture(dashA, 320, 200));
    expect(h.instances[0].tex.anisotropy).toBe(8);
  });

  it('honors a lower driver anisotropy ceiling', () => {
    h.maxAnisotropy = 4;
    renderHook(() => useDashboardTexture(dashA, 320, 200));
    expect(h.instances[0].tex.anisotropy).toBe(4);
  });

  it('reuses the texture across renders with unchanged inputs', () => {
    const { result, rerender } = renderHook(() => useDashboardTexture(dashA, 320, 200));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(h.instances).toHaveLength(1);
  });

  it('rebuilds and disposes the old texture when the dashboard swaps', () => {
    const { result, rerender } = renderHook(
      ({ d }) => useDashboardTexture(d, 320, 200),
      { initialProps: { d: dashA } },
    );
    const first = result.current;
    rerender({ d: dashB });

    expect(h.instances).toHaveLength(2);
    expect(result.current).toBe(h.instances[1]);
    expect(first.disposed).toBe(1); // old texture freed
    expect(result.current.disposed).toBe(0);
  });

  it('rebuilds when the panel is resized', () => {
    const { rerender } = renderHook(
      ({ w, hgt }) => useDashboardTexture(dashA, w, hgt),
      { initialProps: { w: 320, hgt: 200 } },
    );
    rerender({ w: 640, hgt: 200 });
    expect(h.instances).toHaveLength(2);
    expect(h.instances[0].disposed).toBe(1);
  });

  it('disposes the texture on unmount', () => {
    const { result, unmount } = renderHook(() => useDashboardTexture(dashA, 320, 200));
    const tex = result.current;
    unmount();
    expect(tex.disposed).toBe(1);
  });
});
