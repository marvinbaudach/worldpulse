import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';

export type HandTrackingStatus = 'idle' | 'starting' | 'running' | 'error';

/**
 * Per-frame hand state, written by the detection loop and read by the 3D
 * scene inside `useFrame`. Mutated in place (single stable object) so no
 * React re-render ever happens per frame — same pattern as the rotation hook.
 */
export interface HandState {
  /** True while a hand is currently detected. */
  tracked: boolean;
  /** Cursor position in normalized screen space (0..1), mirrored so moving
      the hand right moves the cursor right. Grip point = thumb/index midpoint. */
  x: number;
  y: number;
  /** Smoothed cursor velocity in normalized screen units per second. */
  vx: number;
  vy: number;
  /** True while thumb and index are pinched together (with hysteresis). */
  pinching: boolean;
  /** Palm size in normalized screen units — proxy for distance to the camera
      (bigger = hand closer to the webcam). */
  scale: number;
}

// MediaPipe's WASM bundle + model are fetched lazily on first activation, so
// the ~10 MB never touch the initial page load. Pinned to the installed
// package version so JS and WASM can never drift apart.
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

// Pinch hysteresis on dist(thumb tip, index tip) / palm size: engages tight,
// releases loose, so the grip never flickers at the threshold.
const PINCH_ON = 0.32;
const PINCH_OFF = 0.5;
// Positions/velocities are exponentially smoothed; higher = snappier.
const POS_SMOOTHING = 18;
const VEL_SMOOTHING = 8;
// Frames without a detection before the hand counts as gone (webcams drop
// single frames all the time; a real exit lasts much longer).
const LOST_AFTER_MS = 250;

function makeHandState(): HandState {
  return { tracked: false, x: 0.5, y: 0.5, vx: 0, vy: 0, pinching: false, scale: 0 };
}

/** dt-aware exponential smoothing factor (frame-rate independent). */
function alpha(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Webcam hand tracking via MediaPipe HandLandmarker (WASM + GPU delegate).
 * Opt-in: nothing loads and no camera is touched until `start()` is called.
 * The detection loop runs on video frames, decoupled from the render loop,
 * and only ever mutates `handRef.current`.
 */
export function useHandTracking() {
  const [status, setStatus] = useState<HandTrackingStatus>('idle');
  const handRef = useRef<HandState>(makeHandState());

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    videoRef.current = null;
    Object.assign(handRef.current, makeHandState());
    setStatus('idle');
  }, []);

  const loop = useCallback(() => {
    const hand = handRef.current;
    let lastVideoTime = -1;
    let lastSeen = 0;
    let lastT = performance.now();
    // Raw smoothed position from the previous frame, for velocity.
    let px = 0.5;
    let py = 0.5;

    const tick = () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      rafRef.current = requestAnimationFrame(tick);
      if (!video || !landmarker) return;

      const now = performance.now();
      const dt = Math.max((now - lastT) / 1000, 1 / 240);

      // Only run the detector on fresh video frames (~30 fps), but keep the
      // rAF cadence so velocities decay smoothly between frames.
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastT = now;
        const result = landmarker.detectForVideo(video, now);
        const lm = result.landmarks[0];

        if (lm) {
          lastSeen = now;
          // Grip point: midpoint of thumb tip (4) and index tip (8),
          // mirrored so it behaves like a selfie view.
          const rawX = 1 - (lm[4].x + lm[8].x) / 2;
          const rawY = (lm[4].y + lm[8].y) / 2;
          // Palm size: wrist (0) to middle-finger MCP (9) — stable across
          // finger poses, so it works as a depth proxy even while pinching.
          const palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);

          const wasTracked = hand.tracked;
          hand.tracked = true;

          const aPos = alpha(POS_SMOOTHING, dt);
          const nx = wasTracked ? hand.x + (rawX - hand.x) * aPos : rawX;
          const ny = wasTracked ? hand.y + (rawY - hand.y) * aPos : rawY;
          const aVel = alpha(VEL_SMOOTHING, dt);
          if (wasTracked) {
            hand.vx += ((nx - px) / dt - hand.vx) * aVel;
            hand.vy += ((ny - py) / dt - hand.vy) * aVel;
          } else {
            hand.vx = 0;
            hand.vy = 0;
          }
          px = nx;
          py = ny;
          hand.x = nx;
          hand.y = ny;
          hand.scale = wasTracked
            ? hand.scale + (palm - hand.scale) * aPos
            : palm;

          // Pinch with hysteresis, normalized by palm size so it reads the
          // same near and far from the camera.
          const pinchDist =
            Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / Math.max(palm, 1e-4);
          if (hand.pinching) {
            if (pinchDist > PINCH_OFF) hand.pinching = false;
          } else if (pinchDist < PINCH_ON) {
            hand.pinching = true;
          }
        }
      }

      if (hand.tracked && now - lastSeen > LOST_AFTER_MS) {
        hand.tracked = false;
        hand.pinching = false;
        hand.vx = 0;
        hand.vy = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('starting');
    try {
      // Camera first: the permission prompt is the likeliest failure, so fail
      // fast before downloading the model.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      // Lazy import keeps MediaPipe's JS out of the main bundle too.
      const { FilesetResolver, HandLandmarker } = await import(
        '@mediapipe/tasks-vision'
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        numHands: 1,
      };
      let landmarker: HandLandmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(fileset, options);
      } catch {
        // Some GPUs/drivers reject the GPU delegate; WASM-on-CPU still works.
        landmarker = await HandLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        });
      }

      // start() may have been aborted (toggle off / unmount) while awaiting.
      if (!runningRef.current) {
        landmarker.close();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      landmarkerRef.current = landmarker;
      setStatus('running');
      loop();
    } catch {
      stop();
      setStatus('error');
    }
  }, [loop, stop]);

  const toggle = useCallback(() => {
    if (runningRef.current) stop();
    else void start();
  }, [start, stop]);

  // Full teardown (camera light off) when the owner unmounts.
  useEffect(() => stop, [stop]);

  return { status, toggle, handRef };
}
