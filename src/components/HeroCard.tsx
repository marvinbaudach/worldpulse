import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial } from 'three';
import { GlassPlate, GLASS_OPACITY } from './GlassPlate';
import { SETTLED_T, type Dashboard } from '../dashboards';
import { onLocaleChange } from '../i18n';
import { useDashboardTexture } from '../hooks/useDashboardTexture';

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
// Anticipation: the card recoils back along its path, dips and leans back into
// the ring before it launches, peaking early in the opening flight.
const RECOIL_DIST = 0.13;
const RECOIL_LEAN = 0.2;
// Banking: peak roll (radians) the card leans into its flight direction at
// mid-flight, leveling out for the landing.
const MAX_BANK = 0.38;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const TWO_PI = Math.PI * 2;

// Flight personalities. One is drawn at random each time a hero opens, so the
// same card can arrive with a different flourish — mostly the elegant swoop,
// occasionally a full-turn stunt for surprise. Every extra move is scaled so it
// is exactly zero at t=0 and lands flat at t=1 (partial swings ride `swing`, a
// sin envelope; full 360° turns ride `spin`, a monotone 0→1 that hits 2π).
type Variant = 'swoop' | 'barrel' | 'flip' | 'corkscrew' | 'tumble';
// Weighted bag: swoop is the calm default, the stunts are the rare surprise.
const VARIANT_BAG: Variant[] = [
  'swoop', 'swoop', 'swoop', 'swoop', 'swoop',
  'barrel', 'barrel', 'flip', 'flip', 'corkscrew', 'corkscrew', 'tumble',
];
function pickVariant(): Variant {
  return VARIANT_BAG[Math.floor(Math.random() * VARIANT_BAG.length)];
}
// Smootherstep on the (already eased) progress: a full turn accelerates and
// decelerates gently instead of spinning at constant rate.
function smoother(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Card aspect (4:5, = PANEL_W / PANEL_H) shared by the ring plate and hero.
const CARD_ASPECT = 0.8;

// A redraw rasterises the full multi-megapixel canvas and re-uploads the whole
// texture to the GPU — at hero resolution that alone caps the frame rate. A
// static chart is drawn settled once at mount (createDashboardTexture), so the
// hero never redraws it; only a live panel keeps ticking, and even that is
// throttled to ~30Hz since its animation is slow and smooth.
const REDRAW_INTERVAL = 1 / 30;

// Fraction of the visible frustum (at the hero's depth) the card may fill,
// so all four edges sit comfortably inside the frame.
const FIT = 0.88;

// Hero canvas resolution, sized at mount to just exceed the card's on-screen
// backing pixels so it never upscales soft — a tall or 4K viewport renders the
// hero far larger than a laptop one. The card is height-constrained, so size
// off that and derive the width. Rounded up to a 128px step and clamped so an
// extreme window can't blow up the per-frame intro redraw or texture memory.
function heroTextureSize(): { w: number; h: number } {
  // Match the canvas dpr the hero is pinned to (1.75), so the texture is neither
  // upscaled soft nor needlessly oversized (which would only slow the redraw).
  const cssH = FIT * Math.min(window.innerHeight, window.innerWidth / CARD_ASPECT);
  const h = Math.min(2048, Math.max(1280, Math.ceil((cssH * 1.75) / 128) * 128));
  return { w: Math.round(h * CARD_ASPECT), h };
}

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
const _bank = new Quaternion();
const _dir = new Vector3();
const _spin = new Quaternion();

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
  // The chart intro plays from the moment the hero opens, so the diagram
  // animates in during the fly-in instead of making the viewer wait for the
  // card to land before anything happens.
  const openedAt = useRef<number | null>(null);
  // Clock time of the last texture redraw, so a live panel's ticks can be
  // throttled (static heroes never redraw).
  const lastDrawAt = useRef(-Infinity);

  // One random flight personality per opened hero (stable for its lifetime).
  // startOpen cards (the outgoing side of an arrow switch) mount at progress 1,
  // so they never actually play a flourish — plain swoop keeps them still.
  const variant = useMemo<Variant>(() => (startOpen ? 'swoop' : pickVariant()), [startOpen]);

  // Size the hero canvas once at mount (window dimensions don't change under
  // it), then let the shared hook own the texture's creation and disposal.
  const { w: texW, h: texH } = useMemo(heroTextureSize, []);
  const dash = useDashboardTexture(dashboard, texW, texH);

  // Language switch while the hero is open: re-rasterise it in place.
  useEffect(() => onLocaleChange(() => dash.render(SETTLED_T)), [dash]);

  useFrame((state, delta) => {
    const pivot = pivotRef.current;
    const inner = innerRef.current;
    const img = imgRef.current;
    if (!pivot || !inner || !img) return;

    // The chart is already drawn settled at mount, so a static hero never
    // redraws — no per-frame canvas rasterise or texture upload while it is
    // open. Only a live panel keeps ticking, throttled to ~30Hz.
    if (openedAt.current === null) openedAt.current = state.clock.elapsedTime;
    const now = state.clock.elapsedTime;
    if (dashboard.live && now - lastDrawAt.current >= REDRAW_INTERVAL) {
      dash.render(now - openedAt.current);
      lastDrawAt.current = now;
    }

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
    // Ring-side end of the flight. Opening: launch from the pose captured at
    // click (fixed), so the fly-in is independent of the ring — the card flies
    // straight to center while the ring rotates the emptied slot to the front
    // in parallel, instead of the launch point being dragged round first.
    // Fly-back: track the slot's live pose so it still lands correctly after a
    // formation or count change made while the hero was open.
    const from = closing ? (poses?.current.get(dashboard.id) ?? start) : start;
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
    // Anticipation: early in the opening flight the card winds up — pulling
    // back along its path and dipping before it launches (0 on close).
    const anticipate = closing ? 0 : Math.sin(Math.PI * MathUtils.clamp(t / 0.22, 0, 1));
    _dir.subVectors(targetPosition, from.position).normalize();
    _pos.addScaledVector(_dir, -RECOIL_DIST * anticipate);
    _pos.y -= RECOIL_DIST * 0.4 * anticipate;
    _scale.lerpVectors(from.scale, _target, tPunch);
    const halfH = _scale.y / 2;

    // Base orientation eases from the tilted ring pose to facing the camera.
    _qBase.slerpQuaternions(from.quaternion, IDENTITY, t);

    // Flourish, in two layers. The base swoop (hinge/yaw/bank about the top-edge
    // pivot) all rides `swing`, so it vanishes at both ends; under a stunt it is
    // damped so the pivot lean doesn't fight the spin. The full 360° turn rides
    // `spin` (a monotone 0→1 hitting exactly 2π, so it lands flat) and is applied
    // to the inner group, whose origin is the card centre — the card spins in
    // place and stays framed instead of orbiting the top edge out of view.
    const spin = smoother(t);
    const damp = variant === 'swoop' ? 1 : variant === 'tumble' ? 0.8 : 0.5;
    // Base hinge about the top edge (flip stays almost flat so the centre
    // somersault reads cleanly), plus the launch-recoil lean-back.
    const hingeScale = variant === 'flip' ? 0.2 : damp;
    _hinge.setFromAxisAngle(X_AXIS, -swing * MAX_HINGE * hingeScale + RECOIL_LEAN * anticipate);
    _yaw.setFromAxisAngle(UP, side * swing * MAX_YAW * damp);
    _bank.setFromAxisAngle(Z_AXIS, -side * swing * MAX_BANK * damp);

    // Pivot sits at the top edge (card center + up * halfH, in base orientation).
    _up.copy(UP).applyQuaternion(_qBase);
    pivot.position.copy(_pos).addScaledVector(_up, halfH);
    pivot.quaternion.copy(_qBase).multiply(_yaw).multiply(_bank).multiply(_hinge);

    // Centre stunt: a full turn about the card's own axis (identity for swoop).
    // barrel = roll (Z), corkscrew = spin (Y), flip/tumble = somersault (X).
    if (variant === 'barrel') _spin.setFromAxisAngle(Z_AXIS, side * TWO_PI * spin);
    else if (variant === 'corkscrew') _spin.setFromAxisAngle(UP, side * TWO_PI * spin);
    else if (variant === 'flip' || variant === 'tumble') _spin.setFromAxisAngle(X_AXIS, -TWO_PI * spin);
    else _spin.identity();

    // Inner group hangs the card down from the pivot; the image mesh carries
    // its size (aspect stays constant, so imperative scaling never distorts).
    // Its origin sits at the card centre, so the stunt quaternion spins the card
    // about its own middle.
    inner.position.set(0, -halfH, 0);
    inner.quaternion.copy(_spin);
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
