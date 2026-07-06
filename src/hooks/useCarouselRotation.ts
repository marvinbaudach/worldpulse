import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { Group } from 'three';
import type { HandState } from './useHandTracking';

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
  /** Webcam hand state; an open moving hand swipes the ring like a drag. */
  hand?: RefObject<HandState>;
}

// Hand swipes are discrete flicks, not continuous coupling: tracking jitter
// and the return stroke of a swipe otherwise keep reversing the ring. A fast
// horizontal motion kicks the ring once; inertia and friction do the rest,
// and further input is ignored until the cooldown passes.
const FLICK_SPEED = 0.55; // normalized screen units/s to count as a flick
const FLICK_SPIN = 2.6; // flick velocity -> ring angular velocity (rad/s)
const MAX_FLICK = 3.5; // rad/s cap so a wild swing cannot blur the ring
const FLICK_COOLDOWN = 0.7; // seconds; swallows the hand's return stroke

// Beyond this pixel movement a gesture counts as a drag, not a click.
const CLICK_THRESHOLD = 6;
// Angular-velocity kick per arrow-key press; holding the key keeps kicking
// while friction bleeds it back toward the idle spin.
const KEY_SPIN = 0.9;
// Tilt limits so the ring never flips fully over (balanced around the initial
// tilt so dragging up or down both have room).
const MIN_TILT = -1.0;
const MAX_TILT = 0.7;
// Swirl-in on first appearance: the ring starts rotated by this much and
// unwinds with an eased spin, in sync with the panels flying out.
const ASSEMBLE_DURATION = 1.7;
const ASSEMBLE_TURNS = Math.PI * 1.5;

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
  friction = 0.06,
  wheelSensitivity = 0.004,
  paused,
  initialTilt = -0.32,
  tiltSensitivity = 0.005,
  hand,
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
  const flickReadyAt = useRef(0);
  // Keep the latest `paused` callback so listeners never capture a stale one.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
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
      if (pausedRef.current?.()) return; // a hero card owns the wheel while open
      velocity.current += e.deltaY * wheelSensitivity;
    };

    // Arrow keys spin the ring while no hero is open (the hero handles the
    // arrows itself to step between cards).
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current?.()) return;
      const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (!dir) return;
      velocity.current = MathUtils.clamp(
        velocity.current + dir * KEY_SPIN,
        -MAX_FLICK,
        MAX_FLICK,
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

  useFrame((state, delta) => {
    // Clamp delta so a dropped frame does not cause a jump.
    const dt = Math.min(delta, 1 / 30);

    // Hold still while a hero card is open, but keep the current angle.
    if (pausedRef.current?.()) return;

    if (!dragging.current) {
      // Open-hand flick spins the ring; a pinch belongs to the grab gesture
      // and slow hand motion (aiming at a panel) leaves the ring alone.
      const h = hand?.current;
      if (
        h?.tracked &&
        !h.pinching &&
        state.clock.elapsedTime > flickReadyAt.current &&
        Math.abs(h.vx) > FLICK_SPEED
      ) {
        velocity.current = MathUtils.clamp(
          h.vx * FLICK_SPIN,
          -MAX_FLICK,
          MAX_FLICK,
        );
        flickReadyAt.current = state.clock.elapsedTime + FLICK_COOLDOWN;
      }
      rotation.current += velocity.current * dt;
      // Ease velocity toward the auto-spin (inertia -> idle).
      velocity.current += (autoSpin - velocity.current) * friction;
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
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.x = tilt.current;
    }
  });

  return { groupRef, tiltRef, wasDrag };
}
