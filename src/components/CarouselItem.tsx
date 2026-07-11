import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { BackSide, FrontSide, MathUtils, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { FrostPlate, FROST_OPACITY } from './FrostPlate';
import type { HeroStart } from './HeroCard';
import { GlassPlate, GLASS_GAP, GLASS_OPACITY } from './GlassPlate';
import type { Slot } from '../layouts';
import { SETTLED_T, type Dashboard } from '../dashboards';
import { onLiveUpdate } from '../data/store';
import { onLocaleChange } from '../i18n';
import { useDashboardTexture } from '../hooks/useDashboardTexture';
import { useIsMobile } from '../hooks/useIsMobile';

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
  /** True while the theme filter is switching away — plays the exit
      animation before this panel unmounts. */
  exiting: boolean;
  /** False during the boot (always the supernova entrance); true from the
      first theme switch on, where `move` picks the choreography. */
  varied: boolean;
  /** Choreography of the current theme switch, drawn per switch (not per
      card): the whole set leaves and arrives in one coherent motion, but each
      switch looks different. 0 supernova (implode/erupt center), 1 waterfall
      (drop out / rain in from above), 2 breath (scatter out / dive in from
      outside), 3 fountain (lift out / rise in from below), 4 corkscrew
      (screw down and out / screw in from above — the helix's signature),
      5 vortex (spin up and drain into the core / spin out of it — the
      sphere's signature). */
  move: number;
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

// Theme-switch exit: the entrance in reverse — the set collapses back into
// the center before the next theme's cards erupt out. Shorter than the
// entrance so the swap feels snappy rather than ceremonial.
const EXIT_DURATION = 0.4;

// Hover press: the cursor side of the panel gets pushed down (away from the
// viewer) while the edge opposite the cursor stays put — the panel pivots on
// that far edge, so it reads as being pressed, not as spinning around its
// center. Max tilt per axis (radians) — deliberately tiny: the press should
// add life, not read as a playful 3D rotation.
const TILT_X = 0.03; // vertical cursor offset -> rotation around x
const TILT_Y = 0.035; // horizontal cursor offset -> rotation around y
const PRESS_SINK = 0.015; // the glass settles slightly onto the panel too

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
  exiting,
  varied,
  move,
  interactive,
  poses,
}: CarouselItemProps) {
  const groupRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const glassRef = useRef<Mesh>(null);
  const backRef = useRef<Mesh>(null);
  const frostRef = useRef<Mesh>(null);
  const canvasEl = useThree((s) => s.gl.domElement);
  // The frost pane is desktop-only: its transmission pass re-renders the
  // opaque scene once per frame, which the mobile perf posture can't afford.
  const isMobile = useIsMobile();

  // Plane whose horizontal UVs are flipped: the back face shows the SAME
  // dashboard texture as the front, but a plain BackSide sample of it reads
  // mirrored — flipping U cancels that, so a card turned away shows its chart
  // the right way round instead of a blank/branded slab.
  const backGeo = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    uv.needsUpdate = true;
    return g;
  }, []);
  useEffect(() => () => backGeo.dispose(), [backGeo]);
  const entranceStart = useRef<number | null>(null);
  // True on the frame the panel stops being hidden, so it can snap back to full
  // opacity instead of fading in and leaving a transparent gap after the hero.
  const wasHidden = useRef(false);

  // The dashboard is rendered once in its settled state and only refreshed
  // when live data lands — hovering no longer replays the intro animation.
  // Desktop panels sit on a FrostPlate, so their surface is filled translucent
  // and the blurred scene glows through the card face (see Frame.frost).
  const dash = useDashboardTexture(dashboard, TEX_W, TEX_H, !isMobile);
  // Hover state; the frame loop eases `press` toward 1 while hovered so the
  // glass plate tilts down toward the cursor.
  const hovered = useRef(false);
  const press = useRef(0);
  // Cursor position on the panel, -1..1 from the center on both axes.
  const pointer = useRef({ x: 0, y: 0 });
  // Theme-switch exit: pose/scale/opacity snapshotted the moment the collapse
  // starts, so the plunge departs from wherever the panel happened to be
  // (mid-entrance, hovered, floating) without a pop.
  const exitStart = useRef<number | null>(null);
  const exitFrom = useRef(new Vector3());
  const exitSnapshot = useRef({
    scale: 1,
    opacity: 1,
    glass: 0,
    frost: 0,
    mode: 0,
    rotY: 0,
    spin: 1,
  });
  // Spawn point of the entrance flight; stays at the origin for the boot's
  // uniform supernova, varied per panel after a theme switch.
  const entranceOrigin = useRef(new Vector3());

  // Refresh the settled render when live data lands. A 'tick' only moves the
  // continuously-animated panels (the debt clock); a 'data' event only needs
  // the panels actually fed by a fetcher — the ~37 purely bundled panels never
  // change, so they skip the redraw and its texture upload entirely.
  useEffect(
    () =>
      onLiveUpdate((kind) => {
        if (kind === 'tick' ? !dashboard.live : !dashboard.dynamic) return;
        dash.render(SETTLED_T);
      }),
    [dash, dashboard.live, dashboard.dynamic],
  );

  // A runtime language switch re-rasterises every panel in place — no
  // remount, so the ring keeps its pose instead of replaying the boot bloom.
  useEffect(() => onLocaleChange(() => dash.render(SETTLED_T)), [dash]);

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
    const glass = glassRef.current;
    const back = backRef.current;
    const backMat = back?.material as MeshBasicMaterial | undefined;
    const frost = frostRef.current;
    const frostMat = frost?.userData.frost as ShaderMaterial | undefined;

    // Frosted backdrop pane (see FrostPlate): fades with the panel lifecycle.
    const setFrost = (opacity: number) => {
      if (!frost || !frostMat) return;
      frostMat.uniforms.uOpacity.value = opacity;
      frost.visible = opacity > 0.02;
    };

    // Keep the dark back face in lockstep with the front image's opacity.
    // Called from every branch that owns the frame's final opacity (entrance,
    // exit, hidden, settled).
    const setFaces = (opacity: number) => {
      if (back && backMat) {
        // The back shows the card's own chart (mirror-corrected) at exactly the
        // front's opacity, so a panel looks identical from either side — same
        // colour, same depth fade. (Boosting it brighter tinted it against the
        // fog when translucent, or rendered the near-black card surface as a
        // solid black slab when forced opaque; matching the front avoids both.)
        backMat.opacity = opacity;
        back.visible = opacity > 0.002;
      }
    };

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

    // Depth cue from how far up front the panel sits (1 = nearest the camera,
    // 0 = back of the ring), from last frame's world position. Computed here so
    // the entrance and the settled state share one "focus" size: the panel
    // flies straight to its final scale instead of arriving small and then
    // growing the last 8 % — that late grow-in was the settling jolt.
    group.getWorldPosition(worldPos);
    const facing = (worldPos.z / radius + 1) / 2;
    const eased = Math.pow(MathUtils.clamp(facing, 0, 1), 1.5);
    // Star emphasis on top of the plain depth cue: a narrow window around the
    // front-most slot(s), so the card facing the camera visibly steps forward
    // — larger and at full brightness — while its neighbours get only a
    // partial boost. The window is a gradient (not a winner-takes-all pick)
    // because the ring rotates continuously; a hard cutoff would flicker.
    const star = MathUtils.smoothstep(eased, 0.92, 1);
    const focus = 1 + eased * 0.08 + star * 0.09;
    // The glass sheen tracks the card's own brightness instead of running an
    // independent fade window: a dim side/back card only ever carries a dim
    // sheen, so the plate can never read as a bright milky slab over a nearly
    // black panel (which is exactly what a full-opacity plate on a dimmed
    // card looked like). The small floor keeps the back sides from going
    // dead matte black.
    const glassFade = 0.15 + 0.85 * eased;

    // Back panels: darker, desaturated and slightly zoomed out -> depth.
    // Minimum opacity kept high enough that the back sides stay recognizable;
    // the star term lifts the front-most card to full brightness so it reads
    // as the stage's focal point against the deeper-dimmed rest. Computed
    // before the entrance branch so a card flying toward a back slot arrives
    // already dimmed and translucent, instead of landing fully opaque (a
    // fogged black slab) and only fading to its depth look afterwards.
    // The floor sits high (0.62) so even back/side cards keep their near-black
    // surface and stay readable from across the ring — depth is carried by the
    // remaining fade, the desaturation and the fog, not by sinking cards into
    // the backdrop.
    const targetOpacity = 0.62 + eased * 0.23 + star * 0.15;
    const targetGray = (1 - eased) * 0.6;
    const targetZoom = 1 + (1 - eased) * 0.15;

    const glassMat = glass?.material as MeshStandardMaterial | undefined;

    // Theme switch: the set leaves in the switch's choreography (see `move`),
    // staggered on the same per-panel jitter as the entrance, while the
    // parent waits before swapping in the next theme's set. The per-card tip
    // direction stays random so the shared motion still feels organic.
    if (exiting) {
      if (exitStart.current === null) {
        exitStart.current = now + entranceDelay * 0.5;
        exitFrom.current.copy(group.position);
        exitSnapshot.current = {
          scale: group.scale.x,
          opacity: mat.opacity,
          glass: glassMat?.opacity ?? 0,
          frost: (frostMat?.uniforms.uOpacity.value as number) ?? 0,
          mode: move,
          rotY: group.rotation.y,
          spin: Math.random() < 0.5 ? -1 : 1,
        };
      }
      const snap = exitSnapshot.current;
      const q = MathUtils.clamp((now - exitStart.current) / EXIT_DURATION, 0, 1);
      const e = q * q * q; // easeInCubic: a beat of hang, then the plunge
      const f = exitFrom.current;
      switch (snap.mode) {
        case 1: // waterfall: drop out of frame, tipping sideways
          group.position.set(f.x, f.y - 4.5 * e, f.z);
          group.rotation.z = 0.45 * e * snap.spin;
          break;
        case 2: // breath: scatter radially outward, swallowed by the fog
          group.position.copy(f).multiplyScalar(1 + 1.3 * e);
          break;
        case 3: // fountain: lift out of frame, tipping slightly
          group.position.set(f.x, f.y + 4.5 * e, f.z);
          group.rotation.z = -0.3 * e * snap.spin;
          break;
        case 4: {
          // corkscrew: the whole set screws down and out around the Y axis —
          // uniform twist direction, so the helix unwinds as one thread.
          const a = e * 1.6;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          group.position.set(f.x * c + f.z * sn, f.y - 4 * e, -f.x * sn + f.z * c);
          break;
        }
        case 5: {
          // vortex: the formation spins up while draining into the core,
          // like water down a plughole.
          const a = e * 3.2;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          const drain = 1 - e * 0.9;
          group.position.set(
            (f.x * c + f.z * sn) * drain,
            f.y * (1 - e),
            (-f.x * sn + f.z * c) * drain,
          );
          break;
        }
        default: // supernova: implode into the center
          group.position.copy(f).multiplyScalar(1 - e);
      }
      const s = snap.scale * (1 - 0.45 * e);
      group.scale.set(s, s, 1);
      mat.opacity = snap.opacity * (1 - e);
      img.visible = mat.opacity > 0.002;
      if (glassMat) glassMat.opacity = snap.glass * (1 - e);
      if (glass && glassMat) glass.visible = img.visible && glassMat.opacity > 0.005;
      setFaces(mat.opacity);
      setFrost(snap.frost * (1 - e));
      return;
    }
    exitStart.current = null;

    // One-time entrance: panels fly from their spawn point to their slot,
    // staggered and scaling up to their focus size as they arrive. On boot
    // every panel erupts from the center (the supernova moment, tied to the
    // loader glow); after a theme switch the spawn matches the switch's
    // choreography, continuing the motion the old set left with.
    if (entranceStart.current === null) {
      entranceStart.current = now;
      if (varied) {
        const o = entranceOrigin.current;
        switch (move) {
          case 1: // waterfall: rain in from above
            o.set(target.x, target.y + 6, target.z);
            break;
          case 2: // breath: dive in from outside the ring
            o.set(target.x * 2.4, target.y, target.z * 2.4);
            break;
          case 3: // fountain: rise in from below
            o.set(target.x, target.y - 6, target.z);
            break;
          default: // supernova / corkscrew / vortex: from the center
            o.set(0, 0, 0);
        }
      }
    }
    const p = MathUtils.clamp(
      (now - entranceStart.current - entranceDelay) / ENTRANCE_DURATION,
      0,
      1,
    );
    if (p < 1) {
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      if (varied && move === 4) {
        // Corkscrew in: screw down from above onto the slot, unwinding the
        // same uniform twist the previous set left with.
        const a = (1 - e) * 1.6;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        group.position.set(
          target.x * c + target.z * sn,
          target.y + 4 * (1 - e),
          -target.x * sn + target.z * c,
        );
      } else if (varied && move === 5) {
        // Vortex out: spin out of the core onto the slot, the exit reversed.
        const a = (1 - e) * 3.2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const grow = 0.1 + 0.9 * e;
        group.position.set(
          (target.x * c + target.z * sn) * grow,
          target.y * e,
          (-target.x * sn + target.z * c) * grow,
        );
      } else {
        const o = entranceOrigin.current;
        group.position.set(
          o.x + (target.x - o.x) * e,
          o.y + (target.y - o.y) * e,
          o.z + (target.z - o.z) * e,
        );
      }
      group.rotation.x = target.rotX;
      group.rotation.y = target.rotY;
      const s = (0.5 + 0.5 * e) * focus;
      group.scale.set(s, s, 1);
      mat.opacity = e * targetOpacity;
      mat.grayscale = targetGray;
      mat.zoom = targetZoom;
      // Skip the draw calls entirely while the stagger delay holds the panel
      // fully transparent at the center.
      img.visible = e > 0.001;
      // Facing-scaled from the first frame: a card erupting toward a back
      // slot must not arrive with a full bright plate and dim down after.
      if (glassMat) glassMat.opacity = GLASS_OPACITY * e * glassFade;
      if (glassRef.current) glassRef.current.visible = e > 0.001;
      // Back fades in with the front.
      setFaces(mat.opacity);
      setFrost(e * FROST_OPACITY);
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
    if (glass) {
      glass.position.z = GLASS_GAP - pressed * PRESS_SINK;
    }

    // Push the panel back by exactly the distance the far edge would have
    // swung forward, turning the center-pivot press tilt into an edge-pivot
    // press: the edge opposite the cursor stays fixed in space.
    const sink =
      (height / 2) * Math.abs(Math.sin(group.rotation.x - target.rotX)) +
      (width / 2) * Math.abs(Math.sin(group.rotation.y - target.rotY));

    // Idle float: each panel drifts on its own slow, multi-frequency phase so
    // the ring looks alive rather than frozen — and because this frame loop
    // keeps running while a hero is held, the backdrop cards float there too.
    // The offset is fed into the flight target below, so the damped chase
    // softens it and no feedback accumulates; the per-index phase keeps
    // neighbours out of sync so it reads as organic, not a single wobble.
    const ph = index * 1.7;
    const floatX = Math.sin(now * 0.45 + ph) * 0.035;
    const floatY = Math.sin(now * 0.37 + ph * 1.4) * 0.04;
    const floatZ = Math.cos(now * 0.41 + ph * 0.8) * 0.03;
    // A hair of roll on its own phase adds the final touch of life.
    group.rotation.z = Math.sin(now * 0.3 + ph * 1.1) * 0.012;

    // The slot's outward normal ('YXZ': yaw, then pitch) — the press sink
    // pushes the panel along it, away from the viewer side.
    const nx = Math.sin(target.rotY) * Math.cos(target.rotX);
    const ny = -Math.sin(target.rotX);
    const nz = Math.cos(target.rotY) * Math.cos(target.rotX);

    // Damped flight toward the slot (plus the idle float): fast enough to feel
    // pinned when settled, slow enough that a formation switch reads as panels
    // flying over, and soft enough to smooth the drifting float target.
    const k = 0.085;
    group.position.x += (target.x + floatX - nx * sink - group.position.x) * k;
    group.position.y += (target.y + floatY - ny * sink - group.position.y) * k;
    group.position.z += (target.z + floatZ - nz * sink - group.position.z) * k;

    const targetGlass = GLASS_OPACITY * glassFade;
    if (hidden) {
      // Hide at once: the hero copy launches from exactly this panel's pose, so
      // it covers the slot on the click frame. A gradual fade would instead be
      // left behind visibly in the ring as the hero flies off and the ring
      // rotates the emptied slot away. The pose keeps being published above.
      mat.opacity = 0;
      img.visible = false;
      if (glassMat) glassMat.opacity = 0;
      if (glass) glass.visible = false;
      setFaces(0);
      setFrost(0);
      wasHidden.current = true;
      return;
    }
    img.visible = true;
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
    // Back-of-ring plates keep a faint sheen (glassFade floor); only fully
    // faded plates (hero hidden, entrance) skip the draw entirely.
    if (glass && glassMat) glass.visible = glassMat.opacity > 0.005;

    // Front panels slightly larger -> "focus" feel (scales the whole group);
    // a hover adds a small extra lift so the panel rises toward the viewer.
    const lift = focus * (1 + pressed * 0.03);
    group.scale.set(lift, lift, 1);

    // Settled: mirror the live opacity onto the back face.
    setFaces(mat.opacity);
    setFrost(FROST_OPACITY);
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
      {/* Back face: the same dashboard texture on the reverse of the panel,
          UV-flipped (see backGeo) so it reads correctly when the card is turned
          away — every card shows its chart from both sides. */}
      <mesh
        ref={backRef}
        geometry={backGeo}
        position={[0, 0, -0.006]}
        scale={[width, height, 1]}
        renderOrder={-1}
        raycast={() => null}
      >
        <meshBasicMaterial
          map={dash.tex}
          side={BackSide}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Frosted backdrop: the blurred nebula shining through wherever the
          depth fade leaves the chart translucent — macOS milk glass. */}
      {!isMobile && <FrostPlate width={width} height={height} meshRef={frostRef} />}

      <Image
        ref={imgRef}
        texture={dash.tex}
        transparent
        toneMapped={false}
        side={FrontSide}
        radius={0.06}
        scale={[width, height]}
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
