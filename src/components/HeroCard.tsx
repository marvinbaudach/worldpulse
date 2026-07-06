import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial } from 'three';
import { GlassPlate, GLASS_OPACITY } from './GlassPlate';
import { createDashboardTexture, type Dashboard } from '../dashboards';

/** World-space transform captured from the clicked ring panel. */
export interface HeroStart {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

interface HeroCardProps {
  /** The dashboard to render, at hero resolution with its animation replayed. */
  dashboard: Dashboard;
  start: HeroStart;
  /** Front-and-center position the card flies to; its size is computed from
      the camera frustum there so every edge stays on screen. */
  targetPosition: Vector3;
  /** When true the card flies back and calls onClosed once it arrives. */
  closing: boolean;
  onClosed: () => void;
  /** Mount already front-and-center (progress 1) instead of flying in —
      used for the outgoing card of an arrow-key switch. */
  startOpen?: boolean;
  /** While non-null the flight progress follows this value (0..1) instead of
      running on time — this is how a hand gesture drags the card along its
      flight path. Back to null, the time-driven open/close takes over from
      wherever the scrub left the card. */
  scrub?: RefObject<number | null>;
  /** Live poses of all ring panels, written every frame while a hero is
      open. Used instead of `start` when available, so the fly-back lands on
      the slot's current position even after a formation or count change. */
  poses?: RefObject<Map<string, HeroStart>>;
}

const OPEN_TIME = 0.75; // seconds for the dramatic fly-in
const CLOSE_TIME = 0.5; // snappier fly-back
const IDENTITY = new Quaternion();
// Peak forward swing (radians) at mid-flight, as if grabbed at the top edge.
const MAX_HINGE = 0.8;
// Peak yaw swing (radians) at mid-flight: the card corkscrews slightly toward
// the side of the ring it launched from, so the flight reads as a swoop
// rather than a straight slide.
const MAX_YAW = 0.45;
// World-units the flight path arcs upward at mid-flight.
const ARC_LIFT = 0.55;
// How far position/scale punch past the target near the end of the flight
// before settling (fraction of the full travel). Reversed on close it reads
// as a small anticipation pop before the card flies back.
const OVERSHOOT = 0.06;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

// Hero canvas resolution (4:5) — double the ring panels, so it stays crisp.
const TEX_W = 1024;
const TEX_H = 1280;

// Fraction of the visible frustum (at the hero's depth) the card may fill,
// so all four edges sit comfortably inside the frame.
const FIT = 0.88;

// Glass opacity once the card faces the viewer head-on: at that angle the
// white sheen sits on the whole reading surface, so it thins out during the
// flight (from the ring plates' GLASS_OPACITY) instead of milking the charts.
const HERO_GLASS_OPACITY = 0.06;

const _pos = new Vector3();
const _scale = new Vector3();
const _target = new Vector3();
const _up = new Vector3();
const _qBase = new Quaternion();
const _hinge = new Quaternion();
const _yaw = new Quaternion();

// Ease that starts and ends gently for an elegant flight.
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * An enlarged panel that is "grabbed" at its top edge and pulled toward the
 * viewer: it hinges about that top edge, leading with the top and settling
 * flat and front-and-center. Rendered at the scene root so its target pose is
 * expressed in plain world space. The pivot group sits at the card's top edge;
 * the inner group hangs the card down from it.
 */
export function HeroCard({
  dashboard,
  start,
  targetPosition,
  closing,
  onClosed,
  startOpen,
  scrub,
  poses,
}: HeroCardProps) {
  const pivotRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const glassRef = useRef<Mesh>(null);
  const progress = useRef(startOpen ? 1 : 0);
  // The hero animates for as long as it is open: the intro replays during the
  // fly-in and the live elements keep moving afterwards.
  const openedAt = useRef<number | null>(null);

  const dash = useMemo(() => createDashboardTexture(dashboard, TEX_W, TEX_H), [dashboard]);
  useEffect(() => () => dash.dispose(), [dash]);

  useFrame((state, delta) => {
    const pivot = pivotRef.current;
    const inner = innerRef.current;
    const img = imgRef.current;
    if (!pivot || !inner || !img) return;

    if (openedAt.current === null) openedAt.current = state.clock.elapsedTime;
    dash.render(state.clock.elapsedTime - openedAt.current);

    const scrubT = scrub?.current ?? null;
    if (scrubT !== null) {
      // Gesture drag: chase the hand's pull with critically-damped smoothing
      // so the card feels attached without transmitting tracking jitter.
      progress.current = MathUtils.damp(progress.current, scrubT, 10, delta);
    } else {
      const dir = closing ? -1 : 1;
      progress.current = MathUtils.clamp(
        progress.current + (dir * delta) / (closing ? CLOSE_TIME : OPEN_TIME),
        0,
        1,
      );
    }
    // Ring-side end of the flight: the panel's live pose when available (the
    // slot may have moved since the click), the click-time capture otherwise.
    const from = poses?.current.get(dashboard.id) ?? start;
    const t = easeInOutCubic(progress.current);
    // Flourish envelope: 0 at both ends, 1 at mid-flight — every extra move
    // (arc, yaw) is scaled by it, so start and landing poses stay exact.
    const swing = Math.sin(Math.PI * t);
    // Late overshoot: punches past the target in the last stretch of the
    // flight and settles back to exactly 1 at t = 1.
    const tPunch =
      t + Math.sin(Math.PI * Math.max(0, (t - 0.55) / 0.45)) * OVERSHOOT;
    // Which side of the ring the card launched from drives the yaw direction.
    const side = Math.sign(from.position.x) || 1;

    // Largest size (keeping the panel's aspect) that fits the visible frustum
    // at the hero's depth, with a margin. Evaluated per frame because the
    // camera distance animates (portrait pull-back, parallax).
    const vp = state.viewport.getCurrentViewport(state.camera, targetPosition);
    const cardAspect = from.scale.x / from.scale.y;
    const h = Math.min(vp.height * FIT, (vp.width * FIT) / cardAspect);
    _target.set(h * cardAspect, h, 1);

    // Card center + size interpolate from the ring slot to the hero pose,
    // with a late overshoot (tPunch) and an upward arc so the flight swoops
    // instead of sliding on a straight line.
    _pos.lerpVectors(from.position, targetPosition, tPunch);
    _pos.y += swing * ARC_LIFT;
    _scale.lerpVectors(from.scale, _target, tPunch);
    const halfH = _scale.y / 2;

    // Base orientation eases from the tilted ring pose to facing the camera.
    _qBase.slerpQuaternions(from.quaternion, IDENTITY, t);

    // Hinge about the top edge: swing toward the viewer, peaking mid-flight and
    // settling flat, so it reads as being pulled by the top.
    _hinge.setFromAxisAngle(X_AXIS, -swing * MAX_HINGE);
    // Yaw corkscrew toward the launch side, also peaking mid-flight.
    _yaw.setFromAxisAngle(UP, side * swing * MAX_YAW);

    // Pivot sits at the top edge (card center + up * halfH, in base orientation).
    _up.copy(UP).applyQuaternion(_qBase);
    pivot.position.copy(_pos).addScaledVector(_up, halfH);
    pivot.quaternion.copy(_qBase).multiply(_yaw).multiply(_hinge);

    // Inner group hangs the card down from the pivot; the image mesh carries
    // its size (aspect stays constant, so imperative scaling never distorts).
    inner.position.set(0, -halfH, 0);
    img.scale.set(_scale.x, _scale.y, 1);
    // The glass slab (unit-sized geometry) tracks the card, so the panel
    // keeps its plate through the whole flight — no glass/no-glass jump.
    const glass = glassRef.current;
    if (glass) {
      glass.scale.set(_scale.x, _scale.y, 1);
      (glass.material as MeshPhysicalMaterial).opacity = MathUtils.lerp(
        GLASS_OPACITY,
        HERO_GLASS_OPACITY,
        t,
      );
    }

    if (closing && progress.current === 0) onClosed();
  });

  return (
    <group ref={pivotRef}>
      <group ref={innerRef}>
        <Image
          ref={imgRef}
          texture={dash.tex}
          scale={[start.scale.x, start.scale.y]}
          transparent
          toneMapped={false}
          side={DoubleSide}
          radius={0.06}
          onClick={(e) => e.stopPropagation()}
        />
        <GlassPlate width={1} height={1} meshRef={glassRef} />
      </group>
    </group>
  );
}
