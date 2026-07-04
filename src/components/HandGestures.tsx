import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { HeroStart } from './HeroCard';
import type { HandState } from '../hooks/useHandTracking';

interface HandGesturesProps {
  hand: RefObject<HandState>;
  /** Id of the currently open hero, or null while the ring is browsable. */
  selectedId: string | null;
  /** Written every frame while a card is grabbed; null hands control back to
      the HeroCard's own time-driven flight. */
  scrub: RefObject<number | null>;
  onSelect: (id: string, start: HeroStart) => void;
  /** Called when the pinch releases: keepOpen says whether the card was
      pulled past the halfway point (stay open) or not (fly back). */
  onRelease: (keepOpen: boolean) => void;
}

// Pulling the hand this much closer to the webcam (palm size ratio) drags the
// card through its full flight; pushing away by the same amount puts it back.
const PULL_RANGE = 0.18;
// Palm-size noise floor so a resting hand does not creep the card around.
const PULL_DEADZONE = 0.02;
// Released past this progress the card snaps open; below it flies back.
const KEEP_OPEN_AT = 0.5;
// A pinch released this quickly without a real pull is a "tap": it opens the
// card fully (or closes an open one) — the pull is optional, not required.
const TAP_SECONDS = 0.45;
const TAP_MAX_PULL = 0.15;
// How far (in NDC units) a pinch may miss a panel's center and still grab it.
// Screen-space picking is far more forgiving than an exact ray hit, which
// proved too fiddly with a slightly jittery hand cursor.
const PICK_RADIUS = 0.28;

const _pos = new Vector3();
const _quat = new Quaternion();
const _scl = new Vector3();
const _proj = new Vector3();

/**
 * Pinch-to-grab: a pinch over a ring panel opens its hero card and couples
 * the flight progress to the hand's distance from the webcam — pull the hand
 * toward you and the card comes along; push away and it returns to the ring.
 * While a hero is open, pinching again grabs it for the put-back gesture.
 * Renders nothing; it only reads the scene and drives the shared scrub ref.
 */
export function HandGestures({
  hand,
  selectedId,
  scrub,
  onSelect,
  onRelease,
}: HandGesturesProps) {
  const wasPinching = useRef(false);
  const grab = useRef<{ baseScale: number; from: number; at: number } | null>(
    null,
  );

  const endGrab = (now: number, tapAllowed: boolean) => {
    const g = grab.current;
    if (!g) return;
    const t = scrub.current ?? g.from;
    grab.current = null;
    scrub.current = null;
    // A quick pinch without a real pull is a tap: it toggles — opens a card
    // grabbed from the ring, closes an open one. Otherwise the card settles
    // to whichever side it was pulled to.
    const isTap =
      tapAllowed &&
      now - g.at < TAP_SECONDS &&
      Math.abs(t - g.from) < TAP_MAX_PULL;
    onRelease(isTap ? g.from === 0 : t > KEEP_OPEN_AT);
  };

  useFrame(({ camera, scene, clock }) => {
    const h = hand.current;
    if (!h) return;
    const now = clock.elapsedTime;

    // Hand left the frame mid-grab: release wherever the card is.
    if (!h.tracked) {
      endGrab(now, false);
      wasPinching.current = false;
      return;
    }

    const rising = h.pinching && !wasPinching.current;
    const falling = !h.pinching && wasPinching.current;
    wasPinching.current = h.pinching;

    if (rising && !grab.current) {
      if (selectedId !== null) {
        // Grab the open hero to push it back onto the ring.
        grab.current = { baseScale: h.scale, from: 1, at: now };
        scrub.current = 1;
      } else {
        // Pick the panel whose center is closest to the cursor on screen,
        // slightly biased toward the near side of the ring when the front
        // and back rows overlap.
        const hx = h.x * 2 - 1;
        const hy = -(h.y * 2 - 1);
        let best: Object3D | null = null;
        let bestScore = PICK_RADIUS;
        scene.traverse((o) => {
          if (typeof o.userData.dashboardId !== 'string') return;
          o.getWorldPosition(_pos);
          const camDist = _pos.distanceTo(camera.position);
          _proj.copy(_pos).project(camera);
          // Screen distance plus a small depth bias, so when front and back
          // rows overlap on screen the near panel wins.
          const score = Math.hypot(_proj.x - hx, _proj.y - hy) + camDist * 0.005;
          if (score < bestScore) {
            bestScore = score;
            best = o;
          }
        });
        if (best) {
          const mesh: Object3D = best;
          mesh.updateWorldMatrix(true, false);
          mesh.matrixWorld.decompose(_pos, _quat, _scl);
          onSelect(mesh.userData.dashboardId as string, {
            position: _pos.clone(),
            quaternion: _quat.clone(),
            scale: _scl.clone(),
          });
          grab.current = { baseScale: h.scale, from: 0, at: now };
          scrub.current = 0;
        }
      }
    }

    if (grab.current && h.pinching) {
      // Palm size relative to the moment of the grab = how much the hand
      // moved toward (ratio > 1) or away from (ratio < 1) the webcam.
      const ratio = h.scale / Math.max(grab.current.baseScale, 1e-4);
      const raw = ratio - 1;
      const pull =
        Math.sign(raw) * Math.max(0, Math.abs(raw) - PULL_DEADZONE);
      scrub.current = MathUtils.clamp(
        grab.current.from + pull / PULL_RANGE,
        0,
        1,
      );
    }

    if (falling) endGrab(now, true);
  });

  return null;
}
