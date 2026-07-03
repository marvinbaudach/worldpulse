import { useEffect, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh, MeshPhysicalMaterial, Texture } from 'three';
import type { HeroStart } from './HeroCard';
import {
  createVideoLoop,
  disposeVideoLoop,
  uploadVideoFrame,
  type ImageMaterial,
  type VideoLoop,
} from '../utils/videoLoop';

interface CarouselItemProps {
  url: string;
  /** Video loop that replaces the still while the panel is hovered. */
  video: string;
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
  /** False while a hero is open, so panels stop absorbing click-away taps. */
  interactive: boolean;
}

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
  video,
  angle,
  radius,
  width,
  height,
  hidden,
  onSelect,
  wasDrag,
  entranceDelay,
  interactive,
}: CarouselItemProps) {
  const groupRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const glassRef = useRef<Mesh>(null);
  const canvasEl = useThree((s) => s.gl.domElement);
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const anisotropySet = useRef(false);
  const entranceStart = useRef<number | null>(null);
  // True on the frame the panel stops being hidden, so it can snap back to full
  // opacity instead of fading in and leaving a transparent gap after the hero.
  const wasHidden = useRef(false);

  // Hover video: element + texture exist from mount on so the browser can
  // prefetch the clip in the background (posters are already cached by the
  // time the scene mounts) — hovering then starts instantly. Decoding only
  // happens while a video plays, and only the hovered panel ever plays,
  // keeping iGPUs happy.
  const hovered = useRef(false);
  const videoState = useRef<VideoLoop | null>(null);
  // Original poster texture, so the panel can swap back on hover-out.
  const poster = useRef<{ map: Texture; w: number; h: number } | null>(null);

  const startVideo = () => {
    hovered.current = true;
    videoState.current?.el.play().catch((err) => {
      // Autoplay rejection: the panel keeps its still, but say why.
      console.warn('Hover video was blocked:', err);
    });
  };

  const stopVideo = () => {
    hovered.current = false;
    videoState.current?.el.pause();
  };

  // Create (and prefetch) the video on mount; release the decoder and GPU
  // texture when the panel unmounts.
  useEffect(() => {
    const loop = createVideoLoop(video);
    videoState.current = loop;
    return () => {
      disposeVideoLoop(loop);
      videoState.current = null;
    };
  }, [video]);

  // Position on the ring; the group faces outward toward the viewer.
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;

  useFrame((state) => {
    const group = groupRef.current;
    const img = imgRef.current;
    if (!group || !img) return;

    const mat = img.material as unknown as ImageMaterial;
    const glassMat = glassRef.current?.material as MeshPhysicalMaterial | undefined;

    // Anisotropic filtering keeps tilted panels sharp instead of smearing at
    // glancing angles. Capped at 8: going to 16 is barely visible here but
    // measurably slower on integrated GPUs (16 textures, lots of coverage).
    if (!anisotropySet.current && mat.map) {
      mat.map.anisotropy = Math.min(8, maxAnisotropy);
      mat.map.needsUpdate = true;
      anisotropySet.current = true;
    }

    // Swap between the poster still and the hover video. The video texture
    // only goes live once a frame is decodable, so there is no black flash.
    const vs = videoState.current;
    if (vs) uploadVideoFrame(vs);
    if (hovered.current && !hidden && vs && vs.el.readyState >= 2) {
      if (mat.map !== vs.tex) {
        if (!poster.current && mat.map) {
          const still = mat.map.image as { width: number; height: number };
          poster.current = { map: mat.map, w: still.width, h: still.height };
        }
        mat.map = vs.tex;
        mat.imageBounds.set(vs.el.videoWidth, vs.el.videoHeight);
      }
    } else if (!hovered.current && poster.current && mat.map !== poster.current.map) {
      mat.map = poster.current.map;
      mat.imageBounds.set(poster.current.w, poster.current.h);
    }

    // While the hero copy is flying, fade this panel (photo + glass) out.
    if (hidden) {
      stopVideo();
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

    // Settled: pin the panel to its ring slot every frame. The entrance branch
    // above only lands the panel here on its final frame, so if startup jank
    // makes the clock jump straight past the entrance window (common while the
    // textures upload and the post-processing shaders compile), the panels
    // would otherwise stay frozen wherever the fly-out left them — collapsed
    // near the center. Setting it here keeps the arrangement frame-rate
    // independent.
    group.position.set(x, 0, z);

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
        onClick={interactive ? handleClick : undefined}
        onPointerOver={
          interactive
            ? () => {
                // The rotation hook keeps cursor:grab on the canvas itself,
                // which overrides document.body — so set it on the canvas.
                canvasEl.style.cursor = 'pointer';
                startVideo();
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                canvasEl.style.cursor = 'grab';
                stopVideo();
              }
            : undefined
        }
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
