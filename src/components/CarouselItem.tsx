import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { createCardFaceMaterials } from './cardFace';
import type { HeroStart } from './HeroCard';
import type { Slot } from '../layouts';
import { SETTLED_T, type Dashboard } from '../dashboards';
import { onLiveUpdate } from '../data/store';
import { onLocaleChange } from '../i18n';
import { useDashboardTexture } from '../hooks/useDashboardTexture';

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
  const backRef = useRef<Mesh>(null);
  const canvasEl = useThree((s) => s.gl.domElement);

  const entranceStart = useRef<number | null>(null);
  // True on the frame the panel stops being hidden, so it can snap back to full
  // opacity instead of fading in and leaving a transparent gap after the hero.
  const wasHidden = useRef(false);

  // The dashboard is rendered once in its settled state (opaque) and only
  // refreshed when live data lands — hovering no longer replays the intro.
  const dash = useDashboardTexture(dashboard, TEX_W, TEX_H);

  // Card face: one shader per side (front + back, see cardFace) that samples
  // the chart with rounded corners, depth desaturation and zoom. Shared
  // animated uniforms drive both faces from the frame loop.
  const faces = useMemo(
    () => createCardFaceMaterials(dash.tex, width, height),
    [dash.tex, width, height],
  );
  useEffect(() => faces.dispose, [faces]);
  // Theme-switch exit: pose/scale/fade snapshotted the moment the collapse
  // starts, so the plunge departs from wherever the panel happened to be
  // (mid-entrance, floating) without a pop.
  const exitStart = useRef<number | null>(null);
  const exitFrom = useRef(new Vector3());
  const exitSnapshot = useRef({
    scale: 1,
    card: 1,
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

    const u = faces.uniforms;
    const back = backRef.current;

    // Whole-card fade (lifecycle): drives uCardAlpha and gates both faces'
    // visibility together. Face culling then keeps exactly one of them (front
    // or back) in the draw for any view. Both faces share the same
    // grayscale/zoom uniforms, so they stay in lockstep.
    const setCard = (cardAlpha: number) => {
      u.uCardAlpha.value = cardAlpha;
      const vis = cardAlpha > 0.02;
      img.visible = vis;
      if (back) back.visible = vis;
    };

    // While the hero copy is on screen the panel is invisible, but it keeps
    // flying toward its slot below, so formation or count changes made with
    // the hero open still move it to the right place.

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

    // The cards are flat opaque panels now (no frost, no brightness fade), so
    // every card holds the same dark surface — no focal card standing out.
    // Depth is carried by size, fog and a light back-of-ring desaturation and
    // pull-back; the grey wash is kept mild so the front card doesn't pop in
    // saturation against the rest.
    const targetGray = (1 - eased) * 0.25;
    const targetZoom = 1 + (1 - eased) * 0.15;

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
          card: u.uCardAlpha.value,
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
      setCard(snap.card * (1 - e));
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
      u.uGray.value = targetGray;
      u.uZoom.value = targetZoom;
      // uCardAlpha fades in with the flight and gates both faces' draws —
      // skipping them while the stagger delay holds the panel fully transparent
      // at the center.
      setCard(e);
      return;
    }

    // Settle the panel's rotation to the slot pose. No hover tilt — the panel
    // stays flat to the ring; hovering only changes the cursor.
    group.rotation.x = lerpAngle(group.rotation.x, target.rotX, 0.15);
    group.rotation.y = lerpAngle(group.rotation.y, target.rotY, 0.12);

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

    // Damped flight toward the slot (plus the idle float): fast enough to feel
    // pinned when settled, slow enough that a formation switch reads as panels
    // flying over, and soft enough to smooth the drifting float target.
    const k = 0.085;
    group.position.x += (target.x + floatX - group.position.x) * k;
    group.position.y += (target.y + floatY - group.position.y) * k;
    group.position.z += (target.z + floatZ - group.position.z) * k;

    if (hidden) {
      // Hide at once: the hero copy launches from exactly this panel's pose, so
      // it covers the slot on the click frame. A gradual fade would instead be
      // left behind visibly in the ring as the hero flies off and the ring
      // rotates the emptied slot away. The pose keeps being published above.
      setCard(0);
      wasHidden.current = true;
      return;
    }
    if (wasHidden.current) {
      // Just returned from the hero: snap to the settled look, no fade-in gap.
      u.uGray.value = targetGray;
      u.uZoom.value = targetZoom;
      wasHidden.current = false;
    } else {
      u.uGray.value = MathUtils.lerp(u.uGray.value, targetGray, 0.15);
      u.uZoom.value = MathUtils.lerp(u.uZoom.value, targetZoom, 0.15);
    }
    // Settled: the card is fully present (uCardAlpha = 1); face culling shows
    // exactly one of front/back.
    setCard(1);

    // Front panels slightly larger -> "focus" feel (scales the whole group).
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
    // Position and rotation are driven entirely from useFrame (the entrance
    // starts at the center anyway), so no transform props that React could
    // re-apply mid-morph.
    <group ref={groupRef}>
      {/* Back face: the card-face shader on a BackSide plane. It mirrors the
          chart (uFlip) so a card turned away reads right. Face culling keeps
          only one of front/back in the draw. */}
      <mesh ref={backRef} material={faces.back} scale={[width, height, 1]} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* Front face: the chart (see cardFace). Hover only changes the cursor —
          the panel itself doesn't react. */}
      <mesh
        ref={imgRef}
        material={faces.front}
        scale={[width, height, 1]}
        onClick={interactive ? handleClick : undefined}
        onPointerOver={
          interactive
            ? () => {
                // The rotation hook keeps cursor:grab on the canvas itself,
                // which overrides document.body — so set it on the canvas.
                canvasEl.style.cursor = 'pointer';
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                canvasEl.style.cursor = 'grab';
              }
            : undefined
        }
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
