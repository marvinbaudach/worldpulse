import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial } from 'three';
import type { HeroStart } from './HeroCard';
import { GlassPlate, GLASS_OPACITY, GLASS_THICKNESS } from './GlassPlate';
import type { Slot } from '../layouts';
import { createDashboardTexture, SETTLED_T, type Dashboard } from '../dashboards';
import { onLiveUpdate } from '../data/store';

interface CarouselItemProps {
  /** The animated dashboard this panel renders. */
  dashboard: Dashboard;
  /** Target transform in the current formation (see layouts.ts). */
  slot: Slot;
  /** Index in the formation — staggers the fly-to-slot morph. */
  index: number;
  /** Ring radius; still the reference extent for the depth dimming. */
  radius: number;
  width: number;
  height: number;
  /** Hide this panel while its hero copy is on screen. */
  hidden: boolean;
  /** Click -> open the hero card starting from this panel's world transform. */
  onSelect: (id: string, start: HeroStart) => void;
  /** Guard so the end of a drag is not treated as a click. */
  wasDrag: () => boolean;
  /** Per-panel delay (seconds) for the staggered entrance fly-out. */
  entranceDelay: number;
  /** False while a hero is open, so panels stop absorbing click-away taps. */
  interactive: boolean;
  /** While a hero is open, every panel writes its live world pose here each
      frame — the hero flies back to (or, on arrow-key switches, in from)
      the slot's current position, which may have moved meanwhile. */
  poses?: RefObject<Map<string, HeroStart>>;
}

/** Shape of drei's Image shader material, as far as this component needs it. */
type ImageMaterial = {
  opacity: number;
  grayscale: number;
  zoom: number;
};

const worldPos = new Vector3();

// Per-panel delay when flying to a new formation, so the morph ripples
// through the set instead of moving as one rigid block.
const MORPH_STAGGER = 0.06;

/** Lerp an angle along the shortest arc (so yaws never unwind the long way). */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

// Ring panel canvas resolution (4:5, matching the panel geometry). 768 wide
// keeps the chart text crisp on hidpi screens where a front panel can cover
// well over 512 device pixels.
const TEX_W = 768;
const TEX_H = 960;

// Duration of the one-time entrance fly-out per panel.
const ENTRANCE_DURATION = 0.9;

// Hover press: the cursor side of the panel gets pushed down (away from the
// viewer) while the edge opposite the cursor stays put — the panel pivots on
// that far edge, so it reads as being pressed, not as spinning around its
// center. Max tilt per axis (radians) — deliberately tiny: the press should
// add life, not read as a playful 3D rotation.
const TILT_X = 0.03; // vertical cursor offset -> rotation around x
const TILT_Y = 0.035; // horizontal cursor offset -> rotation around y
const PRESS_SINK = 0.015; // the glass settles slightly onto the panel too
// Small gap between the dashboard image and the glass plate's back face.
const GLASS_GAP = 0.01;

export function CarouselItem({
  dashboard,
  slot,
  index,
  radius,
  width,
  height,
  hidden,
  onSelect,
  wasDrag,
  entranceDelay,
  interactive,
  poses,
}: CarouselItemProps) {
  const groupRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const glassRef = useRef<Mesh>(null);
  const canvasEl = useThree((s) => s.gl.domElement);
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const entranceStart = useRef<number | null>(null);
  // True on the frame the panel stops being hidden, so it can snap back to full
  // opacity instead of fading in and leaving a transparent gap after the hero.
  const wasHidden = useRef(false);

  // The dashboard is rendered once in its settled state and only refreshed
  // when live data lands — hovering no longer replays the intro animation.
  const dash = useMemo(() => createDashboardTexture(dashboard, TEX_W, TEX_H), [dashboard]);
  // Hover state; the frame loop eases `press` toward 1 while hovered so the
  // glass plate tilts down toward the cursor.
  const hovered = useRef(false);
  const press = useRef(0);
  // Cursor position on the panel, -1..1 from the center on both axes.
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    dash.tex.anisotropy = Math.min(8, maxAnisotropy);
    return () => dash.dispose();
  }, [dash, maxAnisotropy]);

  // Refresh the settled render when live data lands. Price ticks only touch
  // the two socket-fed panels, so idle texture uploads stay at ~2/second.
  useEffect(
    () =>
      onLiveUpdate((kind) => {
        if (kind === 'tick' && !dashboard.live) return;
        dash.render(SETTLED_T);
      }),
    [dash, dashboard.live],
  );

  // Drop this panel's pose when it unmounts, so a hero never flies toward
  // a slot that no longer exists (e.g. after the count shrank).
  useEffect(
    () => () => {
      poses?.current.delete(dashboard.id);
    },
    [poses, dashboard.id],
  );

  // Formation morph: when the slot changes, the old target is held for a
  // per-index beat (see MORPH_STAGGER) so the flight ripples through the set.
  const slotRef = useRef(slot);
  const heldSlot = useRef(slot);
  const switchAt = useRef(0);

  // Sphere slots pitch the panel; 'YXZ' applies yaw before pitch so the
  // pitch stays a clean "lean back" in every direction.
  useEffect(() => {
    if (groupRef.current) groupRef.current.rotation.order = 'YXZ';
  }, []);

  useFrame((state) => {
    const group = groupRef.current;
    const img = imgRef.current;
    if (!group || !img) return;

    const mat = img.material as unknown as ImageMaterial;
    const glassMat = glassRef.current?.material as MeshPhysicalMaterial | undefined;

    // While the hero copy is on screen the panel is invisible, but it keeps
    // flying toward its slot below, so formation or count changes made with
    // the hero open still move it to the right place.
    if (hidden) hovered.current = false;

    // With a hero open, publish the live world pose (from last frame's
    // transform) — fly-back and arrow-key switch targets.
    if (poses && !interactive) {
      img.updateWorldMatrix(true, false);
      let pose = poses.current.get(dashboard.id);
      if (!pose) {
        pose = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
        poses.current.set(dashboard.id, pose);
      }
      img.matrixWorld.decompose(pose.position, pose.quaternion, pose.scale);
    }

    const now = state.clock.elapsedTime;

    // Formation switch: hold the previous target for a per-index beat so the
    // panels ripple over to the new formation one after another.
    if (slotRef.current !== slot) {
      heldSlot.current = slotRef.current;
      slotRef.current = slot;
      switchAt.current = now + index * MORPH_STAGGER;
    }
    const target = now >= switchAt.current ? slot : heldSlot.current;

    // One-time entrance: panels fly out from the center to their slot,
    // staggered and scaling up as they arrive.
    if (entranceStart.current === null) entranceStart.current = now;
    const p = MathUtils.clamp(
      (now - entranceStart.current - entranceDelay) / ENTRANCE_DURATION,
      0,
      1,
    );
    if (p < 1) {
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      group.position.set(target.x * e, target.y * e, target.z * e);
      group.rotation.x = target.rotX;
      group.rotation.y = target.rotY;
      const s = 0.5 + 0.5 * e;
      group.scale.set(s, s, 1);
      mat.opacity = e;
      mat.grayscale = 0;
      mat.zoom = 1;
      if (glassMat) glassMat.opacity = GLASS_OPACITY * e;
      return;
    }

    // Hover press: tilt the whole panel toward the cursor. Combined with the
    // sink below, the panel pivots on the edge opposite the cursor — only the
    // cursor side moves, down and away; nothing swings toward the viewer. The
    // glass rides along and additionally settles slightly onto the dashboard.
    press.current = MathUtils.lerp(press.current, hovered.current ? 1 : 0, 0.18);
    const pressed = press.current;
    // Positive rotation.x lifts the top edge toward the viewer, so the
    // cursor side (pointer.y = +1 at the top) needs the negative direction.
    group.rotation.x = lerpAngle(
      group.rotation.x,
      target.rotX - pointer.current.y * TILT_X * pressed,
      0.15,
    );
    group.rotation.y = lerpAngle(
      group.rotation.y,
      target.rotY + pointer.current.x * TILT_Y * pressed,
      0.12,
    );
    const glass = glassRef.current;
    if (glass) {
      glass.position.z = GLASS_GAP + GLASS_THICKNESS / 2 - pressed * PRESS_SINK;
    }

    // Push the panel back by exactly the distance the far edge would have
    // swung forward, turning the center-pivot press tilt into an edge-pivot
    // press: the edge opposite the cursor stays fixed in space.
    const sink =
      (height / 2) * Math.abs(Math.sin(group.rotation.x - target.rotX)) +
      (width / 2) * Math.abs(Math.sin(group.rotation.y - target.rotY));

    // The slot's outward normal ('YXZ': yaw, then pitch) — the press sink
    // pushes the panel along it, away from the viewer side.
    const nx = Math.sin(target.rotY) * Math.cos(target.rotX);
    const ny = -Math.sin(target.rotX);
    const nz = Math.cos(target.rotY) * Math.cos(target.rotX);

    // Damped flight toward the slot: fast enough to feel pinned when settled,
    // slow enough that a formation switch reads as panels flying over.
    const k = 0.085;
    group.position.x += (target.x - nx * sink - group.position.x) * k;
    group.position.y += (target.y - ny * sink - group.position.y) * k;
    group.position.z += (target.z - nz * sink - group.position.z) * k;

    // World position determines closeness to the camera (camera looks along +Z).
    group.getWorldPosition(worldPos);
    // facing: 1 = right up front (near), 0 = at the back of the ring.
    const facing = (worldPos.z / radius + 1) / 2;
    const eased = Math.pow(MathUtils.clamp(facing, 0, 1), 1.5);

    // Back panels: darker, desaturated and slightly zoomed out -> depth.
    // Minimum opacity kept higher so the back sides stay recognizable.
    const targetOpacity = 0.4 + eased * 0.6;
    const targetGray = (1 - eased) * 0.7;
    const targetZoom = 1 + (1 - eased) * 0.15;
    // Pressed glass catches a touch more light, selling the contact.
    const targetGlass = GLASS_OPACITY + pressed * 0.08;
    if (hidden) {
      // Fade out under the hero copy; the pose keeps being published above.
      mat.opacity = MathUtils.lerp(mat.opacity, 0, 0.2);
      if (glassMat) glassMat.opacity = MathUtils.lerp(glassMat.opacity, 0, 0.2);
      wasHidden.current = true;
      return;
    }
    if (wasHidden.current) {
      // Just returned from the hero: snap to the settled look, no fade-in gap.
      mat.opacity = targetOpacity;
      mat.grayscale = targetGray;
      mat.zoom = targetZoom;
      if (glassMat) glassMat.opacity = targetGlass;
      wasHidden.current = false;
    } else {
      mat.opacity = MathUtils.lerp(mat.opacity, targetOpacity, 0.15);
      mat.grayscale = MathUtils.lerp(mat.grayscale, targetGray, 0.15);
      mat.zoom = MathUtils.lerp(mat.zoom, targetZoom, 0.15);
      if (glassMat) glassMat.opacity = MathUtils.lerp(glassMat.opacity, targetGlass, 0.15);
    }

    // Front panels slightly larger -> "focus" feel (scales the whole group).
    // Eased toward, not snapped: the entrance ends at scale 1, so setting the
    // focus scale directly would pop a front panel to 1.08 in a single frame —
    // the little jolt right as a panel finished settling (most visible after a
    // filter, when every panel replays the entrance in a staggered ripple).
    const focus = 1 + eased * 0.08;
    const s = MathUtils.lerp(group.scale.x, focus, 0.15);
    group.scale.set(s, s, 1);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (wasDrag()) return; // it was a drag, not a click
    const img = imgRef.current;
    if (!img) return;
    img.updateWorldMatrix(true, false);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    img.matrixWorld.decompose(position, quaternion, scale);
    onSelect(dashboard.id, { position, quaternion, scale });
  };

  return (
    // Position and rotation are driven entirely from useFrame (the entrance
    // starts at the center anyway), so no transform props that React could
    // re-apply mid-morph.
    <group ref={groupRef}>
      <Image
        ref={imgRef}
        texture={dash.tex}
        transparent
        toneMapped={false}
        side={DoubleSide}
        radius={0.06}
        scale={[width, height]}
        // Lets the hand-gesture raycast identify which panel it grabbed.
        userData={{ dashboardId: dashboard.id }}
        onClick={interactive ? handleClick : undefined}
        onPointerOver={
          interactive
            ? () => {
                // The rotation hook keeps cursor:grab on the canvas itself,
                // which overrides document.body — so set it on the canvas.
                canvasEl.style.cursor = 'pointer';
                hovered.current = true;
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (e: ThreeEvent<PointerEvent>) => {
                if (!e.uv) return;
                pointer.current.x = e.uv.x * 2 - 1;
                pointer.current.y = e.uv.y * 2 - 1;
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                canvasEl.style.cursor = 'grab';
                hovered.current = false;
              }
            : undefined
        }
      />

      <GlassPlate width={width} height={height} meshRef={glassRef} />
    </group>
  );
}
