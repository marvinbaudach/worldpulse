// The demo formations the panels can morph between. All of them are
// rotation-symmetric around the Y axis, so the drag/auto-spin, the fog and
// the depth dimming keep working unchanged in every mode.

import { RING_MAX } from './dashboards';

export type LayoutMode = 'ring' | 'helix' | 'sphere';

// Panel dimensions in world units (4:5 aspect ratio).
export const PANEL_W = 2.4;
export const PANEL_H = 3.0;
// Per-panel pitch as a multiple of the panel width: the bare 1.0 packs the
// panels edge-to-edge, so at any grazing viewing angle (the arc curving away
// on a wide screen) they visibly overlap. The extra headroom leaves a real gap
// between neighbours so the ring reads as separate plates, not a smeared strip.
const PANEL_PITCH = 1.4;
// Radius chosen so the panels do not overlap on the ring; grows with the
// panel count, and CameraRig dollies the camera along smoothly.
export const radiusFor = (count: number) =>
  (PANEL_W * PANEL_PITCH * count) / (2 * Math.PI) + 0.6;
export const DEFAULT_RADIUS = radiusFor(RING_MAX);

export const LAYOUT_MODES: { id: LayoutMode; label: string }[] = [
  { id: 'ring', label: 'RING' },
  { id: 'helix', label: 'HELIX' },
  { id: 'sphere', label: 'KUGEL' },
];

/** Target transform of one panel inside the (spinning) carousel group. */
export interface Slot {
  x: number;
  y: number;
  z: number;
  /** Pitch (radians) so sphere panels face outward; 0 on the other modes. */
  rotX: number;
  /** Yaw (radians) — the panel's outward direction. */
  rotY: number;
}

/** Compute the slot for every panel in the given formation. */
export function layoutSlots(
  mode: LayoutMode,
  n: number,
  radius: number,
  panelH: number,
): Slot[] {
  switch (mode) {
    case 'ring':
      return Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return { x: Math.sin(a) * radius, y: 0, z: Math.cos(a) * radius, rotX: 0, rotY: a };
      });

    // A spiral staircase: 1.5 turns from top to bottom. The height grows
    // with the panel count (capped so it stays inside the camera frame).
    case 'helix': {
      const turns = 1.5;
      const height = Math.min(panelH * 2.6 * (n / 9), panelH * 4.4);
      return Array.from({ length: n }, (_, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const a = t * 2 * Math.PI * turns;
        const r = radius * 0.92;
        return {
          x: Math.sin(a) * r,
          y: (0.5 - t) * height,
          z: Math.cos(a) * r,
          rotX: 0,
          rotY: a,
        };
      });
    }

    // Fibonacci sphere; every panel faces outward from the center. The
    // radius grows with the square root of the count (surface area), not
    // with the ring radius — a 30-panel ring is far wider than the frame.
    case 'sphere': {
      const R = Math.sqrt(n) * 1.4;
      const golden = Math.PI * (3 - Math.sqrt(5));
      return Array.from({ length: n }, (_, i) => {
        const v = 1 - (2 * (i + 0.5)) / n; // -1..1 top to bottom
        const rr = Math.sqrt(Math.max(0, 1 - v * v));
        const a = i * golden;
        return {
          x: Math.sin(a) * rr * R,
          y: v * R,
          z: Math.cos(a) * rr * R,
          rotX: -Math.asin(v),
          rotY: Math.atan2(Math.sin(a) * rr, Math.cos(a) * rr),
        };
      });
    }
  }
}
