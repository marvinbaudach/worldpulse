import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
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
import { CAMERA_GAP, CameraRig } from './CameraRig';
import { PerfProbe } from './PerfHud';
import { Afterglow } from './Afterglow';
import { Aurora } from './Aurora';
import { Dust } from './Dust';
import { HeroCard, type HeroStart } from './HeroCard';
import { HeroDock } from './HeroDock';
import { HeroScrim } from './HeroScrim';
import { LayoutControls } from './LayoutControls';
import { HotkeyPanel } from './HotkeyPanel';
import { Ring } from './Ring';
import { DEFAULT_RADIUS, LAYOUT_MODES, radiusFor, type LayoutMode } from '../layouts';
import { useIsMobile } from '../hooks/useIsMobile';
import { useThemeFilter } from '../hooks/useThemeFilter';
import { useZoomControls } from '../hooks/useZoomControls';
import {
  ALL_DASHBOARDS,
  MIN_COUNT,
  RING_BY_TAG,
  RING_MAX,
  TAGS,
} from '../dashboards';
import { favoriteDashboards } from '../favorites';

// localStorage key for the persisted formation.
const LAYOUT_KEY = 'worldpulse-layout';

// Theme switch choreography: the old set plays its exit moves for this long
// before the next set mounts and flies in. Covers the panels' exit stagger
// (up to ~0.11s jitter) plus their 0.4s plunge.
const EXIT_MS = 520;

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
  // Theme filter: exactly one chip is always active and narrows the stage to
  // its tagged cards (shared view-model with the mobile deck, including the
  // FAVORITEN fallback when the last star is removed).
  const { tag, setTag, visibleTags } = useThemeFilter();
  // Two-phase theme switch: `tag` is the chosen chip, `stageTag` is what the
  // ring still shows. While they differ the current set plays its collapse
  // (see CarouselItem's `exiting`), then the stage catches up and the next
  // set erupts. Another chip click mid-collapse just retargets the timeout.
  const [stageTag, setStageTag] = useState(tag);
  const exiting = tag !== stageTag;
  // One choreography per switch, drawn fresh each time (see CarouselItem's
  // `move`): the whole set moves as one, but every switch looks different.
  // Helix and sphere favor their signature move (corkscrew / vortex) half of
  // the time; the other half draws from the four generic ones.
  const [switchMove, setSwitchMove] = useState(0);
  useEffect(() => {
    if (tag === stageTag) return;
    const signature = layout === 'helix' ? 4 : layout === 'sphere' ? 5 : null;
    setSwitchMove(
      signature !== null && Math.random() < 0.5
        ? signature
        : Math.floor(Math.random() * 4),
    );
    const id = window.setTimeout(() => setStageTag(tag), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [tag, stageTag, layout]);
  // Capped, per-load rotated selection (see RING_BY_TAG) — the full theme
  // pool would overcrowd the ring. Favorites are assembled at stage time from
  // the store instead (snapshot per theme switch — starring/unstarring
  // mid-scene must not restructure the live ring).
  const dashboards = useMemo(
    () =>
      stageTag === 'favoriten'
        ? favoriteDashboards(RING_MAX)
        : (RING_BY_TAG[stageTag] ?? []),
    [stageTag],
  );
  // The nebula tint follows the *chosen* theme immediately, so the room's
  // mood already shifts while the old cards are still collapsing.
  const accent = (TAGS.find((t) => t.id === tag) ?? TAGS[0]).accent;
  const radius = radiusFor(Math.max(dashboards.length, MIN_COUNT));
  // Fog and hero distances track the camera at radius + CAMERA_GAP, so the
  // depth fade on the panels stays put when the default framing changes.
  const fogNear = radius + CAMERA_GAP - 7;
  const fogFar = radius * 2 + CAMERA_GAP - 1;
  const heroZ = radius + CAMERA_GAP - 4;

  // Live poses of the ring panels while a hero is open — fly-back and
  // arrow-key switch targets.
  const posesRef = useRef(new Map<string, HeroStart>());
  // Space toggles the carousel's idle spin.
  const [spinning, setSpinning] = useState(true);

  // Adaptive quality: integrated GPUs are fill-rate bound, so the render
  // resolution is the main lever. PerformanceMonitor samples the frame rate
  // and walks dpr between the bounds. The cap follows the display's own pixel
  // ratio (up to 2) so a hi-dpi screen renders at native sharpness — the large
  // static hero upscales the most when the buffer sits below native — but never
  // below 1.75, so standard displays keep their supersampling.
  const maxDpr = isMobile ? 1.5 : Math.min(2, Math.max(1.75, window.devicePixelRatio || 1));
  const [dpr, setDpr] = useState(maxDpr);

  const heroTarget = useMemo(() => new Vector3(0, 0, heroZ), [heroZ]);
  const heroOpen = selected !== null;
  // +/- keys and Ctrl + wheel dolly the camera in and out; CameraRig scales
  // the gap by this factor. Zoom idles while a hero owns the screen.
  const zoom = useZoomControls(heroOpen);
  // Whether the ring's "dressing" passes (grain + aberration) render. They drop
  // out under an open hero for a clean, crisp card — but come back the instant a
  // close *begins*, not when it ends: the scrim is still dark then and masks
  // their re-entry, so the scene doesn't brighten fully and then visibly grain
  // over a beat later as the card lands.
  const dressed = !heroOpen || closing;
  // Tiny constant color fringe for a cinematic, lens-like finish. The effect is
  // dropped from the stack while a hero is settled open (see `dressed`), so the
  // offset itself can stay constant.
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
  // to its ring slot (outgoing) while the next flies in, keyed by id.
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
  }, [selected, closing, switchHero]);

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

  const selectedDashboard = selected
    ? ALL_DASHBOARDS.find((d) => d.id === selected.id)
    : undefined;
  const outgoingDashboard = outgoing
    ? ALL_DASHBOARDS.find((d) => d.id === outgoing.id)
    : undefined;

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
      camera={{ position: [0, 0, DEFAULT_RADIUS + CAMERA_GAP], fov: 40 }}
      // Canvas MSAA is wasted work: EffectComposer renders offscreen anyway,
      // and the bloom/noise/vignette stack hides the aliasing it would fix.
      gl={{ antialias: false }}
      onPointerMissed={requestClose}
    >
      <color attach="background" args={['#080b14']} />
      <fog attach="fog" args={['#080b14', fogNear, fogFar]} />

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
      <Aurora accent={accent} />
      <Dust radius={radius} count={isMobile ? 120 : 320} />
      <Afterglow radius={radius} />

      <Ring
        onSelect={open}
        selectedId={selected?.id ?? null}
        outgoingId={outgoing?.id ?? null}
        paused={() => selected !== null}
        layout={layout}
        dashboards={dashboards}
        exiting={exiting}
        move={switchMove}
        radius={radius}
        poses={posesRef}
        spinning={spinning}
      />

      {/* Dims the ring, aurora and dust once a hero opens; fades back out as
          the card flies home (active drops on the first frame of the close). */}
      <HeroScrim active={heroOpen && !closing} z={heroZ - 1.5} />

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
          !isMobile && dressed && (
            <ChromaticAberration
              key="aberration"
              blendFunction={BlendFunction.NORMAL}
              offset={aberration}
            />
          ),
          !isMobile && dressed && (
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

    <LayoutControls hidden={heroOpen} tag={tag} tags={visibleTags} onTagChange={setTag} />

    <HotkeyPanel hidden={heroOpen} layout={layout} onChange={setLayout} />

    {heroOpen && !closing && selectedDashboard && <HeroDock dashboard={selectedDashboard} />}
    </>
  );
}
