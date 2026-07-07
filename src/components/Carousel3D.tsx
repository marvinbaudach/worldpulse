import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import styled from 'styled-components';
import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  SMAA,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Environment, PerformanceMonitor } from '@react-three/drei';
import { Vector2, Vector3 } from 'three';
import { CameraRig } from './CameraRig';
import { CarouselItem } from './CarouselItem';
import { PerfProbe } from './PerfHud';
import { Aurora } from './Aurora';
import { Dust } from './Dust';
import { HeroCard, type HeroStart } from './HeroCard';
import { HandGestures } from './HandGestures';
import { HandControls } from './HandControls';
import { LayoutControls } from './LayoutControls';
import { HotkeyPanel } from './HotkeyPanel';
import { LAYOUT_MODES, layoutSlots, type LayoutMode } from '../layouts';
import { useCarouselRotation } from '../hooks/useCarouselRotation';
import { useHandTracking, type HandState } from '../hooks/useHandTracking';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTagFilter } from '../hooks/useTagFilter';
import {
  ALL_DASHBOARDS,
  MIN_COUNT,
  type Dashboard,
} from '../dashboards';
import { CARD_SOURCES } from '../dashboards/cardSources';
import { glassSurface } from './glass';

// Source footer for the open hero: a slim bar pinned to the bottom, reading as
// the enlarged card's footer, linking to the source. Shown only while a hero is
// open, when the rest of the chrome is hidden.
const HeroSource = styled.a`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
  transform: translateX(-50%);
  z-index: 20;
  max-width: 92vw;
  padding: 9px 18px;
  border: none;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.74);
  font: 600 11px/1.2 inherit;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
  cursor: pointer;
  ${glassSurface}
`;

// Panel dimensions in world units (4:5 aspect ratio).
const PANEL_W = 2.4;
const PANEL_H = 3.0;
// Per-panel pitch as a multiple of the panel width: the bare 1.0 packs the
// panels edge-to-edge, so at any grazing viewing angle (the arc curving away
// on a wide screen) they visibly overlap. The extra headroom leaves a real gap
// between neighbours so the ring reads as separate plates, not a smeared strip.
const PANEL_PITCH = 1.4;
// Radius chosen so the panels do not overlap on the ring; grows with the
// panel count, and CameraRig dollies the camera along smoothly.
const radiusFor = (count: number) =>
  (PANEL_W * PANEL_PITCH * count) / (2 * Math.PI) + 0.6;
const DEFAULT_RADIUS = radiusFor(ALL_DASHBOARDS.length);

// Zoom bounds and hold-to-zoom rate (factor per second) for the +/- dolly:
// tap for a small nudge, hold to glide all the way in or out.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_RATE = 2.0;

// localStorage keys for the persisted theme filter and formation.
const LAYOUT_KEY = 'worldpulse-layout';
// Theme filter a fresh visitor lands on; null means the unfiltered "ALLE" pool
// ('all' is its stored sentinel, so an explicit ALLE also survives a reload).
// Default is the full pool now that country tags are reserved for country-
// focused cards (Switzerland alone would otherwise show a single card).
const DEFAULT_TAG: string | null = null;

interface RingProps {
  onSelect: (id: string, start: HeroStart) => void;
  selectedId: string | null;
  /** Card currently flying back after an arrow-key switch — its ring panel
      stays hidden until the outgoing hero lands. */
  outgoingId: string | null;
  paused: () => boolean;
  hand: RefObject<HandState>;
  layout: LayoutMode;
  dashboards: Dashboard[];
  radius: number;
  poses: RefObject<Map<string, HeroStart>>;
  /** False while the user paused the auto-spin (Space). */
  spinning: boolean;
}

function Ring({
  onSelect,
  selectedId,
  outgoingId,
  paused,
  hand,
  layout,
  dashboards,
  radius,
  poses,
  spinning,
}: RingProps) {
  const interactive = selectedId === null;
  const { groupRef, tiltRef, wasDrag, spinTo } = useCarouselRotation({
    // Space toggles the idle spin; drag, wheel and inertia stay alive.
    autoSpin: spinning ? -0.03 : 0,
    paused,
    hand,
    // The visual lift of the front row is sin(tilt) * radius, so the start
    // tilt shrinks on big rings — otherwise a 30-panel ring opens with the
    // front row shoved to the top of the frame.
    initialTilt: -0.11 * Math.min(1, DEFAULT_RADIUS / radius),
  });
  // Memoized so the slot objects keep their identity across unrelated
  // re-renders — CarouselItem detects a formation switch by slot identity.
  const slots = useMemo(
    () => layoutSlots(layout, dashboards.length, radius, PANEL_H),
    [layout, dashboards.length, radius],
  );

  // While a hero is open, keep the ring centred on it: an arrow-key switch
  // changes selectedId, and the ring eases the incoming panel's slot to the
  // front (visible turning behind the hero, and centred again on close).
  useEffect(() => {
    if (selectedId === null) {
      spinTo(null);
      return;
    }
    const i = dashboards.findIndex((d) => d.id === selectedId);
    if (i < 0) return;
    const s = slots[i];
    spinTo(Math.atan2(s.x, s.z));
  }, [selectedId, dashboards, slots, spinTo]);

  return (
    // Outer group tilts the formation (driven by vertical drag) so the far
    // side and the panels' back sides come into view. Inner group spins on Y.
    // The whole ring is shifted down so the tilt-lifted front row centres in
    // frame — done on the ring, not the camera, so the camera stays head-on
    // (no "from below" pitch) and the separately-mounted hero card stays
    // centred. The tilt rotates about the ring's own origin, then this offset
    // translates the tilted ring as a whole.
    <group ref={tiltRef} position={[0, -radius * 0.12, 0]}>
      <group ref={groupRef}>
        {dashboards.map((dashboard, i) => (
          <CarouselItem
            key={dashboard.id}
            dashboard={dashboard}
            slot={slots[i]}
            index={i}
            radius={radius}
            width={PANEL_W}
            height={PANEL_H}
            hidden={dashboard.id === selectedId || dashboard.id === outgoingId}
            onSelect={onSelect}
            wasDrag={wasDrag}
            entranceDelay={i * 0.06}
            interactive={interactive}
            poses={poses}
          />
        ))}
      </group>
    </group>
  );
}

export function Carousel3D() {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<{ id: string; start: HeroStart } | null>(
    null,
  );
  const [closing, setClosing] = useState(false);
  // Arrow-key switch: the previous hero flies back to its slot while the
  // next one flies in — both in the air at once, so nothing pops.
  const [outgoing, setOutgoing] = useState<{ id: string; start: HeroStart } | null>(
    null,
  );
  // Demo formations: the panels morph between arrangements (see layouts.ts).
  // Persisted so a chosen formation survives a reload.
  const [layout, setLayout] = useState<LayoutMode>(() => {
    const stored = localStorage.getItem(LAYOUT_KEY);
    return LAYOUT_MODES.some((m) => m.id === stored) ? (stored as LayoutMode) : 'ring';
  });
  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);
  // Theme filter: a chip narrows the stage to the tagged cards; without one
  // the full pool is on stage. Kept in the URL (?filter=…) so a shared link
  // restores the view, and mirrored to localStorage; a fresh visitor lands on
  // DEFAULT_TAG.
  const [tag, setTag] = useTagFilter(DEFAULT_TAG);
  const dashboards = useMemo(
    () => (tag ? ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag)) : ALL_DASHBOARDS),
    [tag],
  );
  const radius = radiusFor(Math.max(dashboards.length, MIN_COUNT));
  const fogNear = radius + 2;
  const fogFar = radius * 2 + 8;
  const heroZ = radius + 4.5;

  // Webcam hand gestures (opt-in): open-hand swipe spins the ring, pinch
  // grabs a panel and hand depth drags it along the hero flight path.
  const handTracking = useHandTracking();
  const scrubRef = useRef<number | null>(null);
  // Live poses of the ring panels while a hero is open — fly-back and
  // arrow-key switch targets.
  const posesRef = useRef(new Map<string, HeroStart>());
  // Space toggles the carousel's idle spin.
  const [spinning, setSpinning] = useState(true);
  // +/- dolly the camera in and out; CameraRig scales the gap by this factor.
  const [zoom, setZoom] = useState(1);

  // Adaptive quality: integrated GPUs are fill-rate bound, so the render
  // resolution is the main lever. PerformanceMonitor samples the frame rate
  // and walks dpr between the bounds. The cap follows the display's own pixel
  // ratio (up to 2) so a hi-dpi screen renders at native sharpness — the large
  // static hero upscales the most when the buffer sits below native — but never
  // below 1.75, so standard displays keep their supersampling.
  const maxDpr = isMobile ? 1.5 : Math.min(2, Math.max(1.75, window.devicePixelRatio || 1));
  const [dpr, setDpr] = useState(maxDpr);

  const heroTarget = useMemo(() => new Vector3(0, 0, heroZ), [heroZ]);
  // Tiny constant color fringe for a cinematic, lens-like finish. The effect is
  // dropped from the stack entirely while a hero is open (see EffectComposer),
  // so the offset itself can stay constant.
  const heroOpen = selected !== null;
  const heroSource = selected ? CARD_SOURCES[selected.id] : undefined;
  const aberration = useMemo(() => new Vector2(0.0003, 0.0003), []);

  const open = (id: string, start: HeroStart) => {
    if (selected) return; // one hero at a time
    setSelected({ id, start });
    setClosing(false);
  };
  const requestClose = () => {
    if (selected && !closing) setClosing(true);
  };
  const finishClose = () => {
    setSelected(null);
    setClosing(false);
  };

  // Flip from the open hero to a neighbouring one: the current card flies back
  // to its ring slot (outgoing) while the next flies in, keyed by id. Shared by
  // the arrow keys and the mobile swipe.
  const switchHero = useCallback(
    (cur: { id: string; start: HeroStart }, dir: number) => {
      const i = dashboards.findIndex((d) => d.id === cur.id);
      if (i < 0) return;
      const next = dashboards[(i + dir + dashboards.length) % dashboards.length];
      if (next.id === cur.id) return;
      // Clone the live pose: the registry entry keeps mutating every frame.
      const pose = posesRef.current.get(next.id);
      setOutgoing(cur);
      setSelected({
        id: next.id,
        start: pose
          ? {
              position: pose.position.clone(),
              quaternion: pose.quaternion.clone(),
              scale: pose.scale.clone(),
            }
          : cur.start,
      });
    },
    [dashboards],
  );

  // Close the hero via Escape or the scroll wheel (click-away is handled by
  // the canvas onPointerMissed below); arrow keys step to the neighboring
  // panel — the fresh HeroCard (keyed by id) flies in from its ring slot.
  useEffect(() => {
    if (!selected || closing) return;
    const close = () => setClosing(true);
    const onWheelClose = (e: WheelEvent) => {
      if (e.ctrlKey) return; // Ctrl + wheel zooms; it must not close the hero
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (dir) switchHero(selected, dir);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheelClose, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheelClose);
    };
  }, [selected, closing, dashboards, switchHero]);

  // Space pauses/resumes the idle spin, hero open or not.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      setSpinning((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Hold +/- to zoom continuously: keydown latches a direction, keyup releases
  // it, and a rAF loop dollies the ring by ZOOM_RATE per second while held —
  // so a tap nudges and a held key glides. Zoom only frames the ring, so it
  // idles while a hero owns the screen.
  useEffect(() => {
    const isIn = (e: KeyboardEvent) => e.key === '+' || e.key === '=';
    const isOut = (e: KeyboardEvent) => e.key === '-' || e.key === '_';
    let dir = 0;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!dir || heroOpen) {
        last = now;
        return;
      }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const factor = Math.pow(ZOOM_RATE, dir * dt);
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)));
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isIn(e)) dir = 1;
      else if (isOut(e)) dir = -1;
    };
    const onUp = (e: KeyboardEvent) => {
      if ((isIn(e) && dir === 1) || (isOut(e) && dir === -1)) {
        dir = 0;
        last = 0;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [heroOpen]);

  // Ctrl + wheel dollies the camera, same bounds as the +/- keys (a trackpad
  // pinch also arrives as a Ctrl-wheel event). preventDefault stops the
  // browser's own page zoom. Like the keys, it only frames the ring, so it
  // idles while a hero owns the screen.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (heroOpen) return;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [heroOpen]);

  const selectedDashboard = selected
    ? ALL_DASHBOARDS.find((d) => d.id === selected.id)
    : undefined;
  const outgoingDashboard = outgoing
    ? ALL_DASHBOARDS.find((d) => d.id === outgoing.id)
    : undefined;

  // Pinch released: pulled past halfway the card stays open (its time-driven
  // flight completes), otherwise it flies back onto the ring.
  const onGestureRelease = (keepOpen: boolean) => {
    if (!keepOpen) requestClose();
  };

  return (
    <>
    <Canvas
      // While a hero is open the heavy effect passes are dropped, so pin the
      // dpr up to a crisp fixed level instead of leaving it at whatever
      // PerformanceMonitor throttled the busy ring view down to (which upscales
      // soft on hi-dpi screens). Capped at 1.75 rather than full native, so the
      // hero is sharp without the fill-rate of a 2x buffer tanking the frame
      // rate on hi-dpi displays.
      dpr={heroOpen ? Math.min(maxDpr, 1.75) : dpr}
      camera={{ position: [0, 0, DEFAULT_RADIUS + 9], fov: 40 }}
      // Canvas MSAA is wasted work: EffectComposer renders offscreen anyway,
      // and the bloom/noise/vignette stack hides the aliasing it would fix.
      gl={{ antialias: false }}
      onPointerMissed={requestClose}
    >
      <color attach="background" args={['#05070c']} />
      <fog attach="fog" args={['#05070c', fogNear, fogFar]} />

      <PerformanceMonitor
        // Step the resolution up/down with the measured frame rate.
        onChange={({ factor }) => setDpr(1 + factor * (maxDpr - 1))}
      />

      <PerfProbe />
      <ambientLight intensity={0.6} />
      <Environment preset="night" />

      <CameraRig
        radius={radius}
        fogNear={fogNear}
        fogFar={fogFar}
        // Mouse parallax off: the camera drifting after the pointer made the
        // whole scene feel restless while browsing the panels.
        parallax={false}
        zoom={zoom}
      />
      <Aurora />
      <Dust radius={radius} count={isMobile ? 120 : 320} />

      <Ring
        onSelect={open}
        selectedId={selected?.id ?? null}
        outgoingId={outgoing?.id ?? null}
        paused={() => selected !== null}
        hand={handTracking.handRef}
        layout={layout}
        dashboards={dashboards}
        radius={radius}
        poses={posesRef}
        spinning={spinning}
      />

      {handTracking.status === 'running' && (
        <HandGestures
          hand={handTracking.handRef}
          selectedId={selected?.id ?? null}
          scrub={scrubRef}
          onSelect={open}
          onRelease={onGestureRelease}
        />
      )}

      {outgoing && outgoingDashboard && (
        <HeroCard
          // The replaced hero: mounts front-and-center and flies straight
          // back to its ring slot while the next card comes in.
          key={`out-${outgoing.id}`}
          dashboard={outgoingDashboard}
          start={outgoing.start}
          targetPosition={heroTarget}
          closing
          startOpen
          onClosed={() => setOutgoing(null)}
          poses={posesRef}
        />
      )}

      {selected && selectedDashboard && (
        <HeroCard
          // Keyed by id: an arrow-key switch remounts the hero, so the new
          // card plays its full fly-in from the ring slot.
          key={selected.id}
          dashboard={selectedDashboard}
          start={selected.start}
          targetPosition={heroTarget}
          closing={closing}
          onClosed={finishClose}
          scrub={scrubRef}
          poses={posesRef}
        />
      )}

      {/* No depth of field: the dashboards are text, and text does not
          forgive bokeh — depth comes from the fog plus the back panels'
          dimming/desaturation instead. multisampling=0: MSAA on the
          composer's offscreen buffers is expensive on integrated GPUs and
          invisible under the effect stack. */}
      <EffectComposer key={isMobile ? 'mobile' : 'desktop'} multisampling={0}>
        {[
          // Edge antialiasing: the Canvas and the composer both run without
          // MSAA (offscreen buffers make it costly), so panel silhouettes rely
          // on this cheap post pass instead of hardware multisampling. Runs in
          // both the ring and hero views; desktop-only, matching the rest of
          // the effect stack's mobile-perf posture.
          !isMobile && <SMAA key="smaa" />,
          // No bloom at all: its fullscreen glow ran every mipmap blur pass
          // each frame (even zeroed), which tanked the frame rate at the hero's
          // pinned dpr and hazed the hero text — removed entirely. Aberration
          // and noise still dress the ring but drop out while a hero is open,
          // so only the cheap vignette is ever left over the hero.
          !isMobile && !heroOpen && (
            <ChromaticAberration
              key="aberration"
              blendFunction={BlendFunction.NORMAL}
              offset={aberration}
            />
          ),
          !isMobile && !heroOpen && (
            <Noise
              key="noise"
              premultiply
              blendFunction={BlendFunction.OVERLAY}
              opacity={0.12}
            />
          ),
          <Vignette key="vignette" eskil={false} offset={0.25} darkness={0.85} />,
        ].filter(Boolean) as ReactElement[]}
      </EffectComposer>
    </Canvas>

    <LayoutControls hidden={heroOpen} tag={tag} onTagChange={setTag} />

    <HotkeyPanel hidden={heroOpen} layout={layout} onChange={setLayout} />

    {heroOpen && heroSource && (
      <HeroSource
        as={heroSource.url ? 'a' : 'span'}
        href={heroSource.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        Quelle: {heroSource.name}
      </HeroSource>
    )}

    {/* Hand tracking is desktop-only: detection + post-processing together
        overwhelm phone GPUs, and touch already covers those devices. */}
    {!isMobile && (
      <HandControls
        status={handTracking.status}
        onToggle={handTracking.toggle}
        hand={handTracking.handRef}
        scrub={scrubRef}
      />
    )}
    </>
  );
}
