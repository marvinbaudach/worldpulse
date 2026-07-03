import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import { DoubleSide, MathUtils, Quaternion, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import {
  createVideoLoop,
  disposeVideoLoop,
  type ImageMaterial,
  type VideoLoop,
} from '../utils/videoLoop';

/** World-space transform captured from the clicked ring panel. */
export interface HeroStart {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

interface HeroCardProps {
  url: string;
  /** Small (already prefetched) loop that starts the instant the hero opens. */
  video: string;
  /** 720p variant that takes over once it has buffered. */
  videoHd: string;
  start: HeroStart;
  /** Front-and-center position the card flies to; its size is computed from
      the camera frustum there so every edge stays on screen. */
  targetPosition: Vector3;
  /** When true the card flies back and calls onClosed once it arrives. */
  closing: boolean;
  onClosed: () => void;
}

const TRANSITION = 0.6; // seconds for a full open/close
const IDENTITY = new Quaternion();
// Peak forward swing (radians) at mid-flight, as if grabbed at the top edge.
const MAX_HINGE = 0.8;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

// Fraction of the visible frustum (at the hero's depth) the card may fill,
// so all four edges sit comfortably inside the frame.
const FIT = 0.88;

const _pos = new Vector3();
const _scale = new Vector3();
const _target = new Vector3();
const _up = new Vector3();
const _qBase = new Quaternion();
const _hinge = new Quaternion();

// Ease that starts and ends gently for an elegant flight.
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * An enlarged panel that is "grabbed" at its top edge and pulled toward the
 * viewer: it hinges about that top edge, leading with the top and settling
 * flat and front-and-center. Rendered at the scene root so its target pose is
 * expressed in plain world space. The pivot group sits at the card's top edge;
 * the inner group hangs the card down from it.
 */
export function HeroCard({
  url,
  video,
  videoHd,
  start,
  targetPosition,
  closing,
  onClosed,
}: HeroCardProps) {
  const pivotRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const imgRef = useRef<Mesh>(null);
  const progress = useRef(0);
  // Two-tier playback: the small (prefetched, instantly playable) loop starts
  // right away, the 720p variant buffers in parallel and takes over seamlessly.
  const sd = useRef<VideoLoop | null>(null);
  const hd = useRef<VideoLoop | null>(null);
  const hdLive = useRef(false);

  useEffect(() => {
    if (!video) return;
    sd.current = createVideoLoop(video);
    sd.current.el.play().catch((err) => {
      console.warn('Hero video was blocked:', err);
    });
    if (videoHd) hd.current = createVideoLoop(videoHd);
    hdLive.current = false;
    return () => {
      if (sd.current) disposeVideoLoop(sd.current);
      if (hd.current) disposeVideoLoop(hd.current);
      sd.current = null;
      hd.current = null;
    };
  }, [video, videoHd]);

  useFrame((state, delta) => {
    const pivot = pivotRef.current;
    const inner = innerRef.current;
    const img = imgRef.current;
    if (!pivot || !inner || !img) return;

    // Promote HD once it can play through: continue at the SD position so
    // the handover is invisible, then retire the SD decoder.
    if (!hdLive.current && hd.current && sd.current && hd.current.el.readyState >= 4) {
      hd.current.el.currentTime = sd.current.el.currentTime;
      hd.current.el.play().catch(() => {
        /* keep SD if HD playback is rejected */
      });
      hdLive.current = true;
      sd.current.el.pause();
    }

    // Swap the still for whichever tier is active once a frame is decodable;
    // force a texture upload per rendered frame (requestVideoFrameCallback is
    // unreliable for video elements that are not in the DOM).
    const vs = hdLive.current ? hd.current : sd.current;
    if (vs && vs.el.readyState >= 2) {
      vs.tex.needsUpdate = true;
      const mat = img.material as unknown as ImageMaterial;
      if (mat.map !== vs.tex) {
        mat.map = vs.tex;
        mat.imageBounds.set(vs.el.videoWidth, vs.el.videoHeight);
      }
    }

    const dir = closing ? -1 : 1;
    progress.current = MathUtils.clamp(
      progress.current + (dir * delta) / TRANSITION,
      0,
      1,
    );
    const t = easeInOutCubic(progress.current);

    // Largest size (keeping the panel's aspect) that fits the visible frustum
    // at the hero's depth, with a margin. Evaluated per frame because the
    // camera distance animates (portrait pull-back, parallax).
    const vp = state.viewport.getCurrentViewport(state.camera, targetPosition);
    const cardAspect = start.scale.x / start.scale.y;
    const h = Math.min(vp.height * FIT, (vp.width * FIT) / cardAspect);
    _target.set(h * cardAspect, h, 1);

    // Card center + size interpolate from the ring slot to the hero pose.
    _pos.lerpVectors(start.position, targetPosition, t);
    _scale.lerpVectors(start.scale, _target, t);
    const halfH = _scale.y / 2;

    // Base orientation eases from the tilted ring pose to facing the camera.
    _qBase.slerpQuaternions(start.quaternion, IDENTITY, t);

    // Hinge about the top edge: swing toward the viewer, peaking mid-flight and
    // settling flat, so it reads as being pulled by the top.
    _hinge.setFromAxisAngle(X_AXIS, -Math.sin(Math.PI * t) * MAX_HINGE);

    // Pivot sits at the top edge (card center + up * halfH, in base orientation).
    _up.copy(UP).applyQuaternion(_qBase);
    pivot.position.copy(_pos).addScaledVector(_up, halfH);
    pivot.quaternion.copy(_qBase).multiply(_hinge);

    // Inner group hangs the card down from the pivot; the image mesh carries
    // its size (aspect stays constant, so imperative scaling never distorts).
    inner.position.set(0, -halfH, 0);
    img.scale.set(_scale.x, _scale.y, 1);

    if (closing && progress.current === 0) onClosed();
  });

  return (
    <group ref={pivotRef}>
      <group ref={innerRef}>
        <Image
          ref={imgRef}
          url={url}
          scale={[start.scale.x, start.scale.y]}
          transparent
          toneMapped={false}
          side={DoubleSide}
          radius={0.06}
          onClick={(e) => e.stopPropagation()}
        />
      </group>
    </group>
  );
}
