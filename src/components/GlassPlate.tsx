import { useEffect, useMemo, type Ref } from 'react';
import { MeshStandardMaterial } from 'three';
import type { Mesh } from 'three';

// Base transparency of the glass; kept low so the plate's aurora reflection
// doesn't lift the near-black panel to a milky gray — the charts need their
// full contrast to read from across the ring.
export const GLASS_OPACITY = 0.13;

// A thin gap so the glass plane sits just in front of the dashboard image
// (z = 0) without z-fighting. CarouselItem drives the live z from this (the
// press sink nudges the plate toward the panel); the hero keeps it fixed.
export const GLASS_GAP = 0.012;

interface GlassPlateProps {
  width: number;
  height: number;
  /** Exposed so owners can fade or rescale the plate imperatively. */
  meshRef?: Ref<Mesh>;
}

/**
 * The glossy, environment-reflecting glass sheet over each dashboard, shared by
 * the ring panels and the hero card — the same plate travels visually with a
 * panel through its whole lifecycle, so there is never a glass/no-glass jump.
 * raycast disabled so clicks reach the dashboard.
 *
 * A flat plane on a plain standard material: the low roughness catches the
 * night environment as a glossy sheen along the edges and on the panels curving
 * away on the ring. This replaced a six-sided box carrying a clearcoat lobe
 * (a second, fresnel-weighted specular pass) — on a fill-rate-bound scene the
 * box's extra faces and the clearcoat shader were pure cost for a look the env
 * reflection already carries.
 */
export function GlassPlate({ width, height, meshRef }: GlassPlateProps) {
  const mat = useMemo(
    () =>
      // envMapIntensity kept high so the plate reads as glass off the night env
      // without a clearcoat lobe; roughness low so that reflection stays a
      // crisp sheen rather than a diffuse wash.
      new MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: GLASS_OPACITY,
        roughness: 0.04,
        metalness: 0,
        envMapIntensity: 2.4,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh ref={meshRef} material={mat} position={[0, 0, GLASS_GAP]} raycast={() => null}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}
