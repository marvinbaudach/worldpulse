import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { Group } from 'three';
import type { RingMotion } from '../components/cameraMotion';

interface Options {
  /** Constant idle rotation in radians/second. */
  autoSpin?: number;
  /** Pixel -> radians conversion while dragging. */
  dragSensitivity?: number;
  /** Friction per frame (0..1); higher = faster roll-out. */
  friction?: number;
  /** Wheel-delta -> angular velocity conversion. */
  wheelSensitivity?: number;
  /** When it returns true the ring holds still (e.g. a hero card is open). */
  paused?: () => boolean;
  /** Initial tilt of the ring (radians around X). */
  initialTilt?: number;
  /** Pixel -> radians conversion for vertical drag tilting. */
  tiltSensitivity?: number;
  /** Optional sink the ring publishes its live motion into every frame, so the
      camera can bank and dolly with the spin without a per-frame re-render. */
  motion?: RefObject<RingMotion>;
}

// rad/s cap so repeated key kicks cannot blur the ring.
const MAX_SPIN = 3.5;

// Beyond this pixel movement a gesture counts as a drag, not a click.
const CLICK_THRESHOLD = 6;
// Angular-velocity kick per arrow-key press; holding the key keeps kicking
// while friction bleeds it back toward the idle spin.
const KEY_SPIN = 0.9;
// How gently the ring eases to the open hero's slot (exponential damping; the
// time constant is 1/λ seconds). Kept low so the ring keeps settling in the
// background as the card lands (~0.75s fly-in) instead of snapping to center
// ahead of it — the rotation should finish under a hero that is already there.
const HERO_FOLLOW_LAMBDA = 3;
// Tilt limits so the ring never flips fully over (balanced around the initial
// tilt so dragging up or down both have room).
const MIN_TILT = -1.0;
const MAX_TILT = 0.7;
// Swirl-in on first appearance: the ring starts rotated by this much and
// unwinds with an eased spin, in sync with the panels flying out.
const ASSEMBLE_DURATION = 1.7;
const ASSEMBLE_TURNS = Math.PI * 1.5;
// Idle "breathing": a very slow, shallow vertical bob of the whole ring so the
// resting scene never sits perfectly still. Tiny amplitude — it should register
// as life, not as motion.
const BREATHE_AMP = 0.06; // world units
const BREATHE_SPEED = 0.5; // radians per second

/**
 * Drives the ring: horizontal drag spins it (Y), vertical drag freely tilts it
 * (X). The whole animation runs in `useFrame` (R3F's rAF) and writes directly
 * to the group transforms — no React state per frame, hence no stutter.
 * Modes: drag with inertia, drag-to-tilt, mouse wheel and idle auto-spin.
 * `wasDrag()` lets callers tell a real click apart from the end of a drag.
 */
export function useCarouselRotation({
  autoSpin = 0.12,
  dragSensitivity = 0.005,
  friction = 0.045,
  wheelSensitivity = 0.004,
  paused,
  initialTilt = -0.32,
  tiltSensitivity = 0.005,
  motion,
}: Options = {}) {
  const groupRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
  const gl = useThree((s) => s.gl);

  // State kept in refs so re-renders never touch the animation.
  const rotation = useRef(0);
  const velocity = useRef(autoSpin);
  const tilt = useRef(initialTilt);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastMoveTime = useRef(0);
  const moved = useRef(0);
  const assembleStart = useRef<number | null>(null);
  // Front rotation the ring should ease to while it is otherwise held (a hero
  // is open): stepping heroes with the arrow keys sets this to the incoming
  // panel's slot, so the ring turns underneath to keep that card centred.
  // null = no target, the ring holds still while paused as before.
  const spinTarget = useRef<number | null>(null);
  // Keep the latest `paused` callback so listeners never capture a stale one.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (pausedRef.current?.()) return; // a hero is open — the ring is not grabbable
      dragging.current = true;
      moved.current = 0;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      lastMoveTime.current = performance.now();
      velocity.current = 0;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const now = performance.now();
      const dx = e.clientX - lastX.current;
      const dy = e.clientY - lastY.current;
      const dt = Math.max((now - lastMoveTime.current) / 1000, 1 / 240);

      moved.current += Math.abs(dx) + Math.abs(dy);

      // Horizontal drag spins the ring (with inertia) ...
      const deltaAngle = dx * dragSensitivity;
      rotation.current += deltaAngle;
      velocity.current = deltaAngle / dt; // instantaneous velocity for roll-out

      // ... vertical drag freely tilts it, clamped so it never flips over.
      // Drag down -> ring tips down (top toward viewer), matching the gesture.
      tilt.current = Math.min(
        MAX_TILT,
        Math.max(MIN_TILT, tilt.current + dy * tiltSensitivity),
      );

      lastX.current = e.clientX;
      lastY.current = e.clientY;
      lastMoveTime.current = now;
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) return; // Ctrl + wheel is the camera zoom, not a spin
      if (pausedRef.current?.()) return; // a hero card owns the wheel while open
      velocity.current -= e.deltaY * wheelSensitivity;
    };

    // Arrow keys spin the ring while no hero is open (the hero handles the
    // arrows itself to step between cards).
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current?.()) return;
      const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (!dir) return;
      velocity.current = MathUtils.clamp(
        velocity.current + dir * KEY_SPIN,
        -MAX_SPIN,
        MAX_SPIN,
      );
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
    };
  }, [gl, dragSensitivity, wheelSensitivity, tiltSensitivity]);

  /** True when the last gesture moved far enough to count as a drag. */
  const wasDrag = () => moved.current > CLICK_THRESHOLD;

  /**
   * Ask the ring to rotate a given slot azimuth (radians) to the front, easing
   * there even while paused. Pass null to release the target and hand the ring
   * back to its normal spin/inertia. Front rotation is the negated azimuth so
   * the panel sitting at that azimuth ends up facing the camera.
   */
  const spinTo = useCallback((azimuth: number | null) => {
    spinTarget.current = azimuth === null ? null : -azimuth;
  }, []);

  useFrame((state, delta) => {
    // Clamp delta so a dropped frame does not cause a jump.
    const dt = Math.min(delta, 1 / 30);

    // A hero card is open: the ring is otherwise held, but if an arrow-key
    // switch handed us a target slot, ease that panel to the front so the ring
    // turns underneath the hero and stays centred on the card being viewed.
    if (pausedRef.current?.()) {
      const target = spinTarget.current;
      if (target !== null && groupRef.current) {
        // Rotation accumulates unbounded, so aim at the nearest equivalent of
        // the target angle — a one-panel step never unwinds a whole turn.
        const twoPi = Math.PI * 2;
        let diff = (target - rotation.current) % twoPi;
        if (diff > Math.PI) diff -= twoPi;
        else if (diff < -Math.PI) diff += twoPi;
        rotation.current = MathUtils.damp(
          rotation.current,
          rotation.current + diff,
          HERO_FOLLOW_LAMBDA,
          dt,
        );
        groupRef.current.rotation.y = rotation.current;
      }
      // Held under a hero: report the resting pose so the camera guidance eases
      // out cleanly (it is gated off while a hero is open anyway).
      if (motion?.current) {
        motion.current.rotation = rotation.current;
        motion.current.velocity = 0;
        motion.current.dragging = false;
      }
      return;
    }
    // Ring back under free control: drop any leftover spin-to target so the
    // next hero open starts fresh from the panel that is clicked.
    spinTarget.current = null;

    if (!dragging.current) {
      rotation.current += velocity.current * dt;
      // Coast back to the idle spin. `friction` reads as a per-60fps-frame
      // pull, but is applied dt-scaled so the feel is identical at any refresh
      // rate (a 144Hz screen no longer snaps back faster). A spin flung against
      // the idle direction then bleeds off, crosses zero and re-accelerates
      // into the idle direction on one smooth exponential curve instead of
      // yanking the instant the drag is released.
      velocity.current +=
        (autoSpin - velocity.current) * (1 - Math.pow(1 - friction, dt * 60));
    }

    // Eased swirl-in offset that unwinds to zero as the ring assembles.
    if (assembleStart.current === null) {
      assembleStart.current = state.clock.elapsedTime;
    }
    const ap = MathUtils.clamp(
      (state.clock.elapsedTime - assembleStart.current) / ASSEMBLE_DURATION,
      0,
      1,
    );
    const assembleOffset = ASSEMBLE_TURNS * Math.pow(1 - ap, 3);

    if (groupRef.current) {
      groupRef.current.rotation.y = rotation.current + assembleOffset;
      // Slow vertical breathing so the idle ring is never dead still.
      groupRef.current.position.y =
        Math.sin(state.clock.elapsedTime * BREATHE_SPEED) * BREATHE_AMP;
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.x = tilt.current;
    }

    // Publish the live motion for the camera. Reports the *applied* rotation
    // (including the boot swirl) so the settle-dolly tracks the visible front
    // card, but the logical spin velocity so a fast boot swirl does not bank
    // the camera. Mutated in place — no allocation, no per-frame re-render.
    if (motion?.current) {
      motion.current.rotation = rotation.current + assembleOffset;
      motion.current.velocity = velocity.current;
      motion.current.dragging = dragging.current;
    }
  });

  return { groupRef, tiltRef, wasDrag, spinTo };
}
