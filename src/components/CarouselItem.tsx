import { useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial, Texture } from 'three';
import type { HeroStart } from './HeroCard';

interface CarouselItemProps {
  url: string;
  /** Angular position on the ring (radians). */
  angle: number;
  radius: number;
  width: number;
  height: number;
  /** Hide this panel while its hero copy is on screen. */
  hidden: boolean;
  /** Click -> open the hero card starting from this panel's world transform. */
  onSelect: (url: string, start: HeroStart) => void;
  /** Guard so the end of a drag is not treated as a click. */
  wasDrag: () => boolean;
  /** Per-panel delay (seconds) for the staggered entrance fly-out. */
  entranceDelay: number;
}

type ImageMaterial = {
  opacity: number;
  grayscale: number;
  zoom: number;
  map: Texture | null;
};

const worldPos = new Vector3();

// Duration of the one-time entrance fly-out per panel.
const ENTRANCE_DURATION = 0.9;
// Thickness of the glass plate sitting in front of each photo, giving the
// panels real depth instead of looking like flat sheets.
const GLASS_THICKNESS = 0.16;
// Base transparency of the glass; front panels get a touch clearer.
const GLASS_OPACITY = 0.16;

export function CarouselItem({
  url,
  angle,
  radius,
  width,
  height,
  hidden,
  onSelect,
  wasDrag,
  entranceDelay,
}: CarouselItemProps) {
  const groupRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const glassRef = useRef<Mesh>(null);
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const anisotropySet = useRef(false);
  const entranceStart = useRef<number | null>(null);
  // True on the frame the panel stops being hidden, so it can snap back to full
  // opacity instead of fading in and leaving a transparent gap after the hero.
  const wasHidden = useRef(false);

  // Position on the ring; the group faces outward toward the viewer.
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;

  useFrame((state) => {
    const group = groupRef.current;
    const img = imgRef.current;
    if (!group || !img) return;

    const mat = img.material as unknown as ImageMaterial;
    const glassMat = glassRef.current?.material as MeshPhysicalMaterial | undefined;

    // Apply max anisotropic filtering once the texture is available so tilted
    // panels stay sharp instead of smearing at glancing angles.
    if (!anisotropySet.current && mat.map) {
      mat.map.anisotropy = maxAnisotropy;
      mat.map.needsUpdate = true;
      anisotropySet.current = true;
    }

    // While the hero copy is flying, fade this panel (photo + glass) out.
    if (hidden) {
      mat.opacity = MathUtils.lerp(mat.opacity, 0, 0.2);
      if (glassMat) glassMat.opacity = MathUtils.lerp(glassMat.opacity, 0, 0.2);
      wasHidden.current = true;
      return;
    }

    // One-time entrance: panels fly out from the center to their ring slot,
    // staggered and scaling up as they arrive.
    const now = state.clock.elapsedTime;
    if (entranceStart.current === null) entranceStart.current = now;
    const p = MathUtils.clamp(
      (now - entranceStart.current - entranceDelay) / ENTRANCE_DURATION,
      0,
      1,
    );
    if (p < 1) {
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      group.position.set(x * e, 0, z * e);
      const s = 0.5 + 0.5 * e;
      group.scale.set(s, s, 1);
      mat.opacity = e;
      mat.grayscale = 0;
      mat.zoom = 1;
      if (glassMat) glassMat.opacity = GLASS_OPACITY * e;
      return;
    }

    // World position determines closeness to the camera (camera looks along +Z).
    group.getWorldPosition(worldPos);
    // facing: 1 = right up front (near), 0 = at the back of the ring.
    const facing = (worldPos.z / radius + 1) / 2;
    const eased = Math.pow(MathUtils.clamp(facing, 0, 1), 1.5);

    // Back images: darker, desaturated and slightly zoomed out -> depth.
    // Minimum opacity kept higher so the back sides stay recognizable.
    const targetOpacity = 0.4 + eased * 0.6;
    const targetGray = (1 - eased) * 0.7;
    const targetZoom = 1 + (1 - eased) * 0.15;
    if (wasHidden.current) {
      // Just returned from the hero: snap to the settled look, no fade-in gap.
      mat.opacity = targetOpacity;
      mat.grayscale = targetGray;
      mat.zoom = targetZoom;
      if (glassMat) glassMat.opacity = GLASS_OPACITY;
      wasHidden.current = false;
    } else {
      mat.opacity = MathUtils.lerp(mat.opacity, targetOpacity, 0.15);
      mat.grayscale = MathUtils.lerp(mat.grayscale, targetGray, 0.15);
      mat.zoom = MathUtils.lerp(mat.zoom, targetZoom, 0.15);
      if (glassMat) glassMat.opacity = MathUtils.lerp(glassMat.opacity, GLASS_OPACITY, 0.15);
    }

    // Front images slightly larger -> "focus" feel (scales the whole group).
    const focus = 1 + eased * 0.08;
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
    onSelect(url, { position, quaternion, scale });
  };

  return (
    <group ref={groupRef} position={[x, 0, z]} rotation={[0, angle, 0]}>
      <Image
        ref={imgRef}
        url={url}
        transparent
        toneMapped={false}
        side={DoubleSide}
        radius={0.06}
        scale={[width, height]}
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />

      {/* Glass plate in front of the photo: real thickness plus a glossy,
          environment-reflecting surface. No transmission pass, so it stays
          cheap. raycast disabled so clicks reach the photo behind it. */}
      <mesh
        ref={glassRef}
        position={[0, 0, GLASS_THICKNESS / 2 + 0.01]}
        raycast={() => null}
      >
        <boxGeometry args={[width, height, GLASS_THICKNESS]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={GLASS_OPACITY}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.1}
          ior={1.5}
          reflectivity={1}
          transmission={0}
          envMapIntensity={2.6}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
