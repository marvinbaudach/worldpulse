import { useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
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
import { Dust } from './Dust';
import { HeroCard, type HeroStart } from './HeroCard';
import { HandGestures } from './HandGestures';
import { HandControls } from './HandControls';
import { LayoutControls } from './LayoutControls';
import { layoutSlots, type LayoutMode } from '../layouts';
import { useCarouselRotation } from '../hooks/useCarouselRotation';
import { useHandTracking, type HandState } from '../hooks/useHandTracking';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  ALL_DASHBOARDS,
  DEFAULT_COUNT,
  MIN_COUNT,
  type Dashboard,
} from '../dashboards';

// Panel dimensions in world units (4:5 aspect ratio).
const PANEL_W = 2.4;
const PANEL_H = 3.0;
// Radius chosen so the panels do not overlap on the ring; grows with the
// panel count, and CameraRig dollies the camera along smoothly.
const radiusFor = (count: number) => (PANEL_W * count) / (2 * Math.PI) + 0.6;
const DEFAULT_RADIUS = radiusFor(DEFAULT_COUNT);

// localStorage key for the persisted panel count.
const COUNT_KEY = 'worldpulse-panel-count';

interface RingProps {
  onSelect: (id: string, start: HeroStart) => void;
  selectedId: string | null;
  paused: () => boolean;
  hand: RefObject<HandState>;
  layout: LayoutMode;
  dashboards: Dashboard[];
  radius: number;
  returnPose: RefObject<HeroStart | null>;
}

function Ring({
  onSelect,
  selectedId,
  paused,
  hand,
  layout,
  dashboards,
  radius,
  returnPose,
}: RingProps) {
  const interactive = selectedId === null;
  const { groupRef, tiltRef, wasDrag } = useCarouselRotation({
    autoSpin: 0.12,
    paused,
    hand,
    // The visual lift of the front row is sin(tilt) * radius, so the start
    // tilt shrinks on big rings — otherwise a 30-panel ring opens with the
    // front row shoved to the top of the frame.
    initialTilt: -0.32 * Math.min(1, DEFAULT_RADIUS / radius),
  });
  // Memoized so the slot objects keep their identity across unrelated
  // re-renders — CarouselItem detects a formation switch by slot identity.
  const slots = useMemo(
    () => layoutSlots(layout, dashboards.length, radius, PANEL_H),
    [layout, dashboards.length, radius],
  );

  return (
    // Outer group tilts the formation (driven by vertical drag) so the far
    // side and the panels' back sides come into view. Inner group spins on Y.
    <group ref={tiltRef}>
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
            hidden={dashboard.id === selectedId}
            onSelect={onSelect}
            wasDrag={wasDrag}
            entranceDelay={i * 0.06}
            interactive={interactive}
            reportPose={returnPose}
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
  // Demo formations: the panels morph between arrangements (see layouts.ts).
  const [layout, setLayout] = useState<LayoutMode>('ring');
  // User-adjustable panel count; radius, fog and hero depth follow it.
  // Persisted so a presentation setup survives the page reload.
  const [count, setCount] = useState(() => {
    const stored = Number(localStorage.getItem(COUNT_KEY));
    return Number.isFinite(stored) && stored >= MIN_COUNT
      ? Math.min(stored, ALL_DASHBOARDS.length)
      : DEFAULT_COUNT;
  });
  useEffect(() => {
    localStorage.setItem(COUNT_KEY, String(count));
  }, [count]);
  const dashboards = useMemo(() => ALL_DASHBOARDS.slice(0, count), [count]);
  const radius = radiusFor(count);
  const fogNear = radius + 2;
  const fogFar = radius * 2 + 8;
  const heroZ = radius + 4.5;

  // Webcam hand gestures (opt-in): open-hand swipe spins the ring, pinch
  // grabs a panel and hand depth drags it along the hero flight path.
  const handTracking = useHandTracking();
  const scrubRef = useRef<number | null>(null);
  // Live pose of the hidden ring panel — the hero's fly-back target.
  const returnPoseRef = useRef<HeroStart | null>(null);

  // Adaptive quality: integrated GPUs are fill-rate bound, so the render
  // resolution is the main lever. PerformanceMonitor samples the frame rate
  // and walks dpr between the bounds.
  const maxDpr = isMobile ? 1.5 : 1.75;
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5));

  const heroTarget = useMemo(() => new Vector3(0, 0, heroZ), [heroZ]);
  // Tiny constant color fringe for a cinematic, lens-like finish — dropped
  // while a hero is open, where it reads as blur on the fullscreen text.
  const heroOpen = selected !== null;
  const aberration = useMemo(
    () => new Vector2(heroOpen ? 0 : 0.0008, heroOpen ? 0 : 0.0008),
    [heroOpen],
  );

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

  // Close the hero via Escape or the scroll wheel (click-away is handled by
  // the canvas onPointerMissed below).
  useEffect(() => {
    if (!selected || closing) return;
    const close = () => setClosing(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', close);
    };
  }, [selected, closing]);

  const selectedDashboard = selected
    ? ALL_DASHBOARDS.find((d) => d.id === selected.id)
    : undefined;

  // Pinch released: pulled past halfway the card stays open (its time-driven
  // flight completes), otherwise it flies back onto the ring.
  const onGestureRelease = (keepOpen: boolean) => {
    if (!keepOpen) requestClose();
  };

  return (
    <>
    <Canvas
      dpr={dpr}
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
      />
      <Dust radius={radius} count={isMobile ? 180 : 500} />

      <Ring
        onSelect={open}
        selectedId={selected?.id ?? null}
        paused={() => selected !== null}
        hand={handTracking.handRef}
        layout={layout}
        dashboards={dashboards}
        radius={radius}
        returnPose={returnPoseRef}
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

      {selected && selectedDashboard && (
        <HeroCard
          dashboard={selectedDashboard}
          start={selected.start}
          targetPosition={heroTarget}
          closing={closing}
          onClosed={finishClose}
          scrub={scrubRef}
          returnPose={returnPoseRef}
        />
      )}

      {/* No depth of field: the dashboards are text, and text does not
          forgive bokeh — depth comes from the fog plus the back panels'
          dimming/desaturation instead. multisampling=0: MSAA on the
          composer's offscreen buffers is expensive on integrated GPUs and
          invisible under the effect stack. */}
      <EffectComposer key={isMobile ? 'mobile' : 'desktop'} multisampling={0}>
        {[
          // With a hero open the whole frame is text, so the glow that looks
          // cinematic on the ring reads as a soft-focus filter: raise the
          // threshold and pull the intensity back until the hero closes.
          <Bloom
            key="bloom"
            intensity={heroOpen ? 0.25 : 0.7}
            luminanceThreshold={heroOpen ? 0.85 : 0.55}
            luminanceSmoothing={0.3}
            mipmapBlur
          />,
          !isMobile && (
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

    <LayoutControls
      hidden={heroOpen}
      layout={layout}
      onChange={setLayout}
      count={count}
      minCount={MIN_COUNT}
      maxCount={ALL_DASHBOARDS.length}
      onCountChange={setCount}
    />

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
