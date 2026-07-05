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
import { useCarouselRotation } from '../hooks/useCarouselRotation';
import { useHandTracking, type HandState } from '../hooks/useHandTracking';
import { useIsMobile } from '../hooks/useIsMobile';
import { DASHBOARDS } from '../dashboards';

// Panel dimensions in world units (4:5 aspect ratio).
const PANEL_W = 2.4;
const PANEL_H = 3.0;
// Radius chosen so the panels do not overlap.
const RADIUS = (PANEL_W * DASHBOARDS.length) / (2 * Math.PI) + 0.6;

// Fog distances, tuned for the wide-screen camera; CameraRig scales them when
// the camera pulls back on portrait screens.
const FOG_NEAR = RADIUS + 2;
const FOG_FAR = RADIUS * 2 + 8;

// Front-and-center position the hero card flies to (between ring front and
// camera); the card sizes itself to the visible frustum at this depth.
const HERO_Z = RADIUS + 4.5;

interface RingProps {
  onSelect: (id: string, start: HeroStart) => void;
  selectedId: string | null;
  paused: () => boolean;
  hand: RefObject<HandState>;
}

function Ring({ onSelect, selectedId, paused, hand }: RingProps) {
  const interactive = selectedId === null;
  const { groupRef, tiltRef, wasDrag } = useCarouselRotation({
    autoSpin: 0.12,
    paused,
    hand,
  });
  const step = (Math.PI * 2) / DASHBOARDS.length;

  return (
    // Outer group tilts the ring (driven by vertical drag) so the far side and
    // the back sides of the panels come into view. Inner group spins on Y.
    <group ref={tiltRef}>
      <group ref={groupRef}>
        {DASHBOARDS.map((dashboard, i) => (
          <CarouselItem
            key={dashboard.id}
            dashboard={dashboard}
            angle={i * step}
            radius={RADIUS}
            width={PANEL_W}
            height={PANEL_H}
            hidden={dashboard.id === selectedId}
            onSelect={onSelect}
            wasDrag={wasDrag}
            entranceDelay={i * 0.06}
            interactive={interactive}
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

  // Webcam hand gestures (opt-in): open-hand swipe spins the ring, pinch
  // grabs a panel and hand depth drags it along the hero flight path.
  const handTracking = useHandTracking();
  const scrubRef = useRef<number | null>(null);

  // Adaptive quality: integrated GPUs are fill-rate bound, so the render
  // resolution is the main lever. PerformanceMonitor samples the frame rate
  // and walks dpr between the bounds.
  const maxDpr = isMobile ? 1.5 : 1.75;
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5));

  const heroTarget = useMemo(() => new Vector3(0, 0, HERO_Z), []);
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
    ? DASHBOARDS.find((d) => d.id === selected.id)
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
      camera={{ position: [0, 0, RADIUS + 9], fov: 40 }}
      // Canvas MSAA is wasted work: EffectComposer renders offscreen anyway,
      // and the bloom/noise/vignette stack hides the aliasing it would fix.
      gl={{ antialias: false }}
      onPointerMissed={requestClose}
    >
      <color attach="background" args={['#05070c']} />
      <fog attach="fog" args={['#05070c', FOG_NEAR, FOG_FAR]} />

      <PerformanceMonitor
        // Step the resolution up/down with the measured frame rate.
        onChange={({ factor }) => setDpr(1 + factor * (maxDpr - 1))}
      />

      <PerfProbe />
      <ambientLight intensity={0.6} />
      <Environment preset="night" />

      <CameraRig
        radius={RADIUS}
        fogNear={FOG_NEAR}
        fogFar={FOG_FAR}
        parallax={!isMobile}
      />
      <Dust radius={RADIUS} count={isMobile ? 180 : 500} />

      <Ring
        onSelect={open}
        selectedId={selected?.id ?? null}
        paused={() => selected !== null}
        hand={handTracking.handRef}
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
