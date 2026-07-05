import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial } from 'three';
import type { HeroStart } from './HeroCard';
import { GlassPlate, GLASS_OPACITY, GLASS_THICKNESS } from './GlassPlate';
import { createDashboardTexture, SETTLED_T, type Dashboard } from '../dashboards';
import { onLiveUpdate } from '../data/store';

interface CarouselItemProps {
  /** The animated dashboard this panel renders. */
  dashboard: Dashboard;
  /** Angular position on the ring (radians). */
  angle: number;
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
}

/** Shape of drei's Image shader material, as far as this component needs it. */
type ImageMaterial = {
  opacity: number;
  grayscale: number;
  zoom: number;
};

const worldPos = new Vector3();

// Ring panel canvas resolution (4:5, matching the panel geometry). 768 wide
// keeps the chart text crisp on hidpi screens where a front panel can cover
// well over 512 device pixels.
const TEX_W = 768;
const TEX_H = 960;

// Duration of the one-time entrance fly-out per panel.
const ENTRANCE_DURATION = 0.9;

// Hover press: the glass plate tilts toward the cursor as if pushed down on
// one side, pivoting on its center like a plate resting on a ball joint.
// Max tilt per axis (radians); kept small so the dipping edge only barely
// sinks past the dashboard plane.
const TILT_X = 0.055; // vertical cursor offset -> rotation around x
const TILT_Y = 0.07; // horizontal cursor offset -> rotation around y
const PRESS_SINK = 0.02; // slight overall sink while pressed (world units)
// Small gap between the dashboard image and the glass plate's back face.
const GLASS_GAP = 0.01;

export function CarouselItem({
  dashboard,
  angle,
  radius,
  width,
  height,
  hidden,
  onSelect,
  wasDrag,
  entranceDelay,
  interactive,
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

  // Position on the ring; the group faces outward toward the viewer.
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;

  useFrame((state) => {
    const group = groupRef.current;
    const img = imgRef.current;
    if (!group || !img) return;

    const mat = img.material as unknown as ImageMaterial;
    const glassMat = glassRef.current?.material as MeshPhysicalMaterial | undefined;

    // While the hero copy is flying, fade this panel (dashboard + glass) out.
    if (hidden) {
      hovered.current = false;
      mat.opacity = MathUtils.lerp(mat.opacity, 0, 0.2);
      if (glassMat) glassMat.opacity = MathUtils.lerp(glassMat.opacity, 0, 0.2);
      wasHidden.current = true;
      return;
    }

    // One-time entrance: panels fly out from the center to their ring slot,
    // staggered and scaling up as they arrive.
    const now = state.clock.elapsedTime;
    if (entranceStart.current === null) entranceStart.current = now;
    const p = MathUtils.clamp(
      (now - entranceStart.current - entranceDelay) / ENTRANCE_DURATION,
      0,
      1,
    );
    if (p < 1) {
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      group.position.set(x * e, 0, z * e);
      const s = 0.5 + 0.5 * e;
      group.scale.set(s, s, 1);
      mat.opacity = e;
      mat.grayscale = 0;
      mat.zoom = 1;
      if (glassMat) glassMat.opacity = GLASS_OPACITY * e;
      return;
    }

    // Hover press: tilt the glass plate toward the cursor, pivoting on its
    // center — the edge under the pointer dips down onto the dashboard while
    // the opposite edge lifts, plus a slight overall sink for contact. The
    // tilt keeps following the pointer as it moves across the panel.
    press.current = MathUtils.lerp(press.current, hovered.current ? 1 : 0, 0.18);
    const pressed = press.current;
    const glass = glassRef.current;
    if (glass) {
      // Positive rotation.x lifts the top edge toward the viewer, so the
      // cursor side (pointer.y = +1 at the top) needs the negative direction.
      glass.rotation.x = MathUtils.lerp(
        glass.rotation.x,
        -pointer.current.y * TILT_X * pressed,
        0.15,
      );
      glass.rotation.y = MathUtils.lerp(
        glass.rotation.y,
        pointer.current.x * TILT_Y * pressed,
        0.15,
      );
      glass.position.z = GLASS_GAP + GLASS_THICKNESS / 2 - pressed * PRESS_SINK;
    }

    // Settled: pin the panel to its ring slot every frame. The entrance branch
    // above only lands the panel here on its final frame, so if startup jank
    // makes the clock jump straight past the entrance window, the panels would
    // otherwise stay frozen wherever the fly-out left them — collapsed near
    // the center. Setting it here keeps the arrangement frame-rate independent.
    group.position.set(x, 0, z);

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
    const focus = 1 + eased * 0.08;
    group.scale.set(focus, focus, 1);
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
    <group ref={groupRef} position={[x, 0, z]} rotation={[0, angle, 0]}>
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
