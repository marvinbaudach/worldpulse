import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  DepthOfField,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Environment } from '@react-three/drei';
import { Vector2, Vector3 } from 'three';
import { CameraRig } from './CameraRig';
import { CarouselItem } from './CarouselItem';
import { Dust } from './Dust';
import { HeroCard, type HeroStart } from './HeroCard';
import { useCarouselRotation } from '../hooks/useCarouselRotation';
import { useIsMobile } from '../hooks/useIsMobile';
import { IMAGES } from '../data/images';

// Panel dimensions in world units (4:5 aspect ratio).
const PANEL_W = 2.4;
const PANEL_H = 3.0;
// Radius chosen so the panels do not overlap.
const RADIUS = (PANEL_W * IMAGES.length) / (2 * Math.PI) + 0.6;

// Fog distances, tuned for the wide-screen camera; CameraRig scales them when
// the camera pulls back on portrait screens.
const FOG_NEAR = RADIUS + 2;
const FOG_FAR = RADIUS * 2 + 8;

// Front-and-center pose the hero card flies to (between ring front and camera).
const HERO_Z = RADIUS + 4.5;
const HERO_SCALE = new Vector3(2.88, 3.6, 1);

interface RingProps {
  onSelect: (url: string, start: HeroStart) => void;
  selectedUrl: string | null;
  paused: () => boolean;
}

function Ring({ onSelect, selectedUrl, paused }: RingProps) {
  const interactive = selectedUrl === null;
  const { groupRef, tiltRef, wasDrag } = useCarouselRotation({
    autoSpin: 0.12,
    paused,
  });
  const step = (Math.PI * 2) / IMAGES.length;

  return (
    // Outer group tilts the ring (driven by vertical drag) so the far side and
    // the back sides of the images come into view. Inner group spins on Y.
    <group ref={tiltRef}>
      <group ref={groupRef}>
        {IMAGES.map((img, i) => (
          <CarouselItem
            key={img.id}
            url={img.url}
            angle={i * step}
            radius={RADIUS}
            width={PANEL_W}
            height={PANEL_H}
            hidden={img.url === selectedUrl}
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
  const [selected, setSelected] = useState<{ url: string; start: HeroStart } | null>(
    null,
  );
  const [closing, setClosing] = useState(false);

  const heroTarget = useMemo(() => new Vector3(0, 0, HERO_Z), []);
  // Tiny constant color fringe for a cinematic, lens-like finish.
  const aberration = useMemo(() => new Vector2(0.0008, 0.0008), []);

  const open = (url: string, start: HeroStart) => {
    if (selected) return; // one hero at a time
    setSelected({ url, start });
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

  // Focus the depth of field on the hero while it is open, on the ring otherwise.
  const focusZ = selected ? HERO_Z : RADIUS;

  return (
    <Canvas
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={{ position: [0, 0, RADIUS + 9], fov: 40 }}
      gl={{ antialias: !isMobile }}
      onPointerMissed={requestClose}
    >
      <color attach="background" args={['#05070c']} />
      <fog attach="fog" args={['#05070c', FOG_NEAR, FOG_FAR]} />

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
        selectedUrl={selected?.url ?? null}
        paused={() => selected !== null}
      />

      {selected && (
        <HeroCard
          url={selected.url}
          start={selected.start}
          targetPosition={heroTarget}
          targetScale={HERO_SCALE}
          closing={closing}
          onClosed={finishClose}
        />
      )}

      {/* Mobile GPUs drop the costly depth-of-field, chromatic aberration and
          grain passes; bloom + vignette keep the cinematic look cheaply. */}
      <EffectComposer key={isMobile ? 'mobile' : 'desktop'}>
        {[
          !isMobile && (
            <DepthOfField
              key="dof"
              target={[0, 0, focusZ]}
              focalLength={0.02}
              bokehScale={2}
              height={1080}
            />
          ),
          <Bloom
            key="bloom"
            intensity={0.7}
            luminanceThreshold={0.55}
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
          !isMobile && (
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
  );
}
