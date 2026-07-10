import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Fog, MathUtils } from 'three';
import type { RingMotion } from './cameraMotion';

interface CameraRigProps {
  /** Ring radius; the viewing distance keeps a fixed gap in front of it. */
  radius: number;
  /** Gap between the ring front and the camera on wide screens. */
  gap?: number;
  /** Fog near/far tuned for the wide-screen distance; scaled with pull-back. */
  fogNear: number;
  fogFar: number;
  /** Subtle mouse parallax; off for touch, where there is no hover pointer. */
  parallax?: boolean;
  /** User zoom (1 = default framing). Higher pulls the camera in, and it
      scales the gap rather than the whole distance, so even a wide ring keeps
      the camera safely in front of its front row. */
  zoom?: number;
  /** Live ring motion (spin + velocity), published by useCarouselRotation. When
      supplied the camera banks with the spin and dollies with its speed; omit
      for the plain static framing. */
  guidance?: RefObject<RingMotion>;
  /** Panel count — sets the detent spacing (2π/count) the settle-dolly homes
      in on so the front-facing card gets a gentle push-in. */
  count?: number;
  /** False while a hero owns the screen: the guidance eases out to a calm,
      head-on frame so the detail card is never banked or dollied. */
  guided?: boolean;
}

// Distance is tuned for a landscape screen. Narrower (portrait) screens pull
// the camera back so the whole ring stays in frame instead of being cropped.
const REF_ASPECT = 16 / 9;
const MAX_PULLBACK = 1.7;

// Default gap between the ring front and the camera. 6.5 puts the front panel
// at comfortable reading size (~2/3 of the frame height at 16:9) while the
// aspect pull-back still keeps the ring's widest points just inside the frame
// on 16:10 / 3:2 / 4:3 screens.
export const CAMERA_GAP = 6.5;

// --- Cinematic guidance tuning -----------------------------------------------
// Camera roll: banks into the spin so a fling reads as motion, not a slide.
const BANK_PER_VEL = 0.045; // radians of roll per rad/s of ring spin
const BANK_MAX = 0.09; // hard cap so a hard fling never tips the horizon over
// Speed dolly: pull back while the ring spins fast so the streaking panels stay
// legible, then glide back in as it settles to the idle drift.
const SPEED_PULLBACK = 0.55; // world units pulled back per rad/s of |spin|
const SPEED_PULLBACK_MAX = 3; // and never further than this
// Settle dolly: a small extra push-in exactly when a card faces the camera, so
// the front card is quietly featured. Fades out while the ring spins fast.
const SETTLE_DOLLY = 0.7; // world units of push-in at a centred detent
const SETTLE_FADE_SPEED = 1.6; // rad/s of spin at which the settle beat is gone
// Exponential damping rate (1/λ seconds) for the roll and the dolly targets.
const GUIDE_LAMBDA = 4;

/**
 * Owns the camera framing: keeps the ring fit to any aspect ratio, adds an
 * optional mouse parallax, and scales the fog with the viewing distance so the
 * depth cue stays consistent when the camera pulls back on tall screens.
 *
 * When `guidance` is supplied it layers a cinematic pass on top of that framing
 * — banking the camera into the spin and dollying with the ring's speed and
 * settle — all eased, and gated off (`guided={false}`) while a hero is open.
 */
export function CameraRig({
  radius,
  gap = CAMERA_GAP,
  fogNear,
  fogFar,
  parallax = true,
  zoom = 1,
  guidance,
  count,
  guided = true,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  // Eased camera roll (radians), kept across frames so the bank glides.
  const roll = useRef(0);
  // Eased dolly offset (world units) added to the base distance.
  const dolly = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const aspect = size.width / size.height;
    const pullback = MathUtils.clamp(REF_ASPECT / aspect, 1, MAX_PULLBACK);
    const baseDist = (radius + gap / zoom) * pullback;

    // Cinematic guidance reads the live spin; it is silenced while a hero owns
    // the screen so the detail card stays perfectly head-on.
    const motion = guided ? guidance?.current : undefined;
    const speed = motion ? Math.abs(motion.velocity) : 0;

    // Dolly target: pull back with spin speed, push in when a card is centred.
    let dollyTarget = Math.min(speed * SPEED_PULLBACK, SPEED_PULLBACK_MAX);
    if (motion && count && count > 0) {
      const stepA = (2 * Math.PI) / count;
      let off = motion.rotation % stepA;
      if (off < 0) off += stepA;
      const toDetent = Math.min(off, stepA - off); // 0 when a card faces us
      const settle = 1 - toDetent / (stepA / 2); // 1 centred → 0 mid-step
      const slow = MathUtils.clamp(1 - speed / SETTLE_FADE_SPEED, 0, 1);
      dollyTarget -= settle * slow * SETTLE_DOLLY;
    }
    dolly.current = MathUtils.damp(dolly.current, dollyTarget, GUIDE_LAMBDA, dt);
    const dist = baseDist + dolly.current;

    // Bank into the spin direction, then hold the horizon level again at rest.
    const rollTarget = motion
      ? MathUtils.clamp(-motion.velocity * BANK_PER_VEL, -BANK_MAX, BANK_MAX)
      : 0;
    roll.current = MathUtils.damp(roll.current, rollTarget, GUIDE_LAMBDA, dt);
    camera.up.set(Math.sin(roll.current), Math.cos(roll.current), 0);

    const px = parallax ? state.pointer.x * 1.4 : 0;
    const py = parallax ? state.pointer.y * 0.9 : 0;
    camera.position.x = MathUtils.lerp(camera.position.x, px, 0.05);
    camera.position.y = MathUtils.lerp(camera.position.y, py, 0.05);
    camera.position.z = MathUtils.lerp(camera.position.z, dist, 0.1);
    camera.lookAt(0, 0, 0);

    // Fog is camera-relative, so it has to grow with the pull-back distance or
    // the ring would sink into the background on portrait screens.
    if (scene.fog instanceof Fog) {
      scene.fog.near = fogNear * pullback;
      scene.fog.far = fogFar * pullback;
    }
  });

  return null;
}
