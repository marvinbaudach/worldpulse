import { useEffect, useMemo, useRef, type RefObject } from 'react';

import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { BackSide, FrontSide, MathUtils, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
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
  /** Live poses of all ring panels, written every frame while a hero is
      open. Used instead of `start` when available, so the fly-back lands on
      the slot's current position even after a formation or count change. */
  poses?: RefObject<Map<string, HeroStart>>;
}

const OPEN_TIME = 0.85; // seconds for the unhurried fly-in
const CLOSE_TIME = 0.55; // slightly quicker fly-back
const IDENTITY = new Quaternion();
// World-units the flight path bows upward at mid-flight, so the card glides
// on a gentle curve instead of sliding along a straight line.
const ARC_LIFT = 0.35;
// Peak lean (radians) about the card's horizontal axis at mid-flight — a
// whisper of pitch that keeps the glide from reading mechanical. Zero at
// both ends, so launch and landing poses stay exact.
const GLIDE_TILT = 0.07;
// Fraction of the flight within which the card finishes turning to face the
// viewer. Resolving the orientation early means most of the glide is flat
// and readable; reversed on close, the card stays readable until it tucks
// back into its ring slot near the end.
const FACE_RESOLVE = 0.8;
const X_AXIS = new Vector3(1, 0, 0);

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

const _pos = new Vector3();
const _scale = new Vector3();
const _target = new Vector3();
const _q = new Quaternion();
const _tilt = new Quaternion();

// Travel ease: soft departure, weightless middle, feather landing.
function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// Facing ease, gentler than the travel so the turn never snaps.
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * An enlarged panel that glides from its ring slot to front-and-center in one
 * calm, deterministic motion: it turns to face the viewer early in the flight,
 * then floats in flat and readable along a gently bowed path — no spins, no
 * overshoot. Rendered at the scene root so its target pose is expressed in
 * plain world space.
 */
export function HeroCard({
  dashboard,
  start,
  targetPosition,
  closing,
  onClosed,
  startOpen,
  poses,
}: HeroCardProps) {
  const groupRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const backRef = useRef<Mesh>(null);
  const progress = useRef(startOpen ? 1 : 0);
  // The chart intro plays from the moment the hero opens, so the diagram
  // animates in during the fly-in instead of making the viewer wait for the
  // card to land before anything happens.
  const openedAt = useRef<number | null>(null);
  // Clock time of the last texture redraw, so a live panel's ticks can be
  // throttled (static heroes never redraw).
  const lastDrawAt = useRef(-Infinity);

  // Plane for the back face with horizontal UVs flipped — same convention as
  // the ring panels: a card seen from behind shows its chart mirrored, and
  // flipping U cancels that. Only visible in edge cases (a formation change
  // while the hero is open can angle the fly-back slot away from the camera).
  const backGeo = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    uv.needsUpdate = true;
    return g;
  }, []);
  useEffect(() => () => backGeo.dispose(), [backGeo]);

  // Size the hero canvas once at mount (window dimensions don't change under
  // it), then let the shared hook own the texture's creation and disposal.
  const { w: texW, h: texH } = useMemo(heroTextureSize, []);
  const dash = useDashboardTexture(dashboard, texW, texH);

  // Language switch while the hero is open: re-rasterise it in place.
  useEffect(() => onLocaleChange(() => dash.render(SETTLED_T)), [dash]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const img = imgRef.current;
    if (!group || !img) return;

    // The chart is already drawn settled at mount, so a static hero never
    // redraws — no per-frame canvas rasterise or texture upload while it is
    // open. Only a live panel keeps ticking, throttled to ~30Hz.
    if (openedAt.current === null) openedAt.current = state.clock.elapsedTime;
    const now = state.clock.elapsedTime;
    if (dashboard.live && now - lastDrawAt.current >= REDRAW_INTERVAL) {
      dash.render(now - openedAt.current);
      lastDrawAt.current = now;
    }

    const dir = closing ? -1 : 1;
    // Clamp delta so the flight never leaps: opening pins the dpr and closing
    // releases it, and that resize hitch right at the first flight frame would
    // otherwise skip the card several frames ahead in one step.
    const dt = Math.min(delta, 1 / 30);
    progress.current = MathUtils.clamp(
      progress.current + (dir * dt) / (closing ? CLOSE_TIME : OPEN_TIME),
      0,
      1,
    );
    // Ring-side end of the flight. Opening: launch from the pose captured at
    // click (fixed), so the fly-in is independent of the ring — the card flies
    // straight to center while the ring rotates the emptied slot to the front
    // in parallel, instead of the launch point being dragged round first.
    // Fly-back: track the slot's live pose so it still lands correctly after a
    // formation or count change made while the hero was open.
    const from = closing ? (poses?.current.get(dashboard.id) ?? start) : start;
    const t = easeInOutQuart(progress.current);
    // Orientation resolves ahead of the travel (see FACE_RESOLVE).
    const tFace = easeInOutCubic(Math.min(1, progress.current / FACE_RESOLVE));
    // Glide envelope: 0 at both ends, 1 at mid-flight — the arc and the lean
    // ride it, so launch and landing poses stay exact.
    const drift = Math.sin(Math.PI * t);

    // Largest size (keeping the panel's aspect) that fits the visible frustum
    // at the hero's depth, with a margin. Evaluated per frame because the
    // camera distance animates (portrait pull-back, parallax).
    const vp = state.viewport.getCurrentViewport(state.camera, targetPosition);
    const cardAspect = from.scale.x / from.scale.y;
    const h = Math.min(vp.height * FIT, (vp.width * FIT) / cardAspect);
    _target.set(h * cardAspect, h, 1);

    // Card center and size glide from the ring slot to the hero pose along a
    // gently bowed path.
    _pos.lerpVectors(from.position, targetPosition, t);
    _pos.y += drift * ARC_LIFT;
    _scale.lerpVectors(from.scale, _target, t);

    // Orientation: turn from the tilted ring pose to face the camera, with a
    // whisper of mid-flight lean so the glide reads carried, not mechanical.
    _q.slerpQuaternions(from.quaternion, IDENTITY, tFace);
    _tilt.setFromAxisAngle(X_AXIS, -drift * GLIDE_TILT);

    group.position.copy(_pos);
    group.quaternion.copy(_q).multiply(_tilt);

    // The image mesh carries the card's size (aspect stays constant, so
    // imperative scaling never distorts).
    img.scale.set(_scale.x, _scale.y, 1);
    const back = backRef.current;
    if (back) back.scale.set(_scale.x, _scale.y, 1);

    if (closing && progress.current === 0) onClosed();
  });

  return (
    <group ref={groupRef}>
      {/* Back face: the hero's own chart, UV-flipped (see backGeo) so it
          reads correctly on an angled fly-back. */}
      <mesh ref={backRef} geometry={backGeo} position={[0, 0, -0.006]} raycast={() => null}>
        <meshBasicMaterial
          map={dash.tex}
          side={BackSide}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <Image
        ref={imgRef}
        texture={dash.tex}
        scale={[start.scale.x, start.scale.y]}
        transparent
        toneMapped={false}
        side={FrontSide}
        radius={0.06}
        onClick={(e) => e.stopPropagation()}
      />
    </group>
  );
}
