// The demo formations the panels can morph between. All of them are
// rotation-symmetric around the Y axis, so the drag/auto-spin, the fog and
// the depth dimming keep working unchanged in every mode.

export type LayoutMode = 'ring' | 'rows' | 'helix' | 'sphere';

export const LAYOUT_MODES: { id: LayoutMode; label: string }[] = [
  { id: 'ring', label: 'RING' },
  { id: 'rows', label: 'REIHEN' },
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

    // Two stacked rings, the lower one rotated by half a slot so the rows
    // interleave instead of forming columns.
    case 'rows': {
      const top = Math.ceil(n / 2);
      return Array.from({ length: n }, (_, i) => {
        const row = i < top ? 0 : 1;
        const count = row === 0 ? top : n - top;
        const j = row === 0 ? i : i - top;
        const a = (j * 2 * Math.PI) / count + row * (Math.PI / count);
        const y = (row === 0 ? 1 : -1) * panelH * 0.62;
        return { x: Math.sin(a) * radius, y, z: Math.cos(a) * radius, rotX: 0, rotY: a };
      });
    }

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
