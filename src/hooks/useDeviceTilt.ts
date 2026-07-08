import { useEffect, type RefObject } from 'react';

// Damped device-orientation tilt: gamma/beta are normalized to [-1, 1],
// low-pass filtered in a rAF loop, and written as imperative transforms
// (per the project rule: animation never goes through per-frame React
// state). The deck leans with the device; the background shifts the other
// way for parallax.
const MAX_DEG = 3.5;
const BG_SHIFT_PX = 18;
/** beta when a phone rests naturally in the hand — the tilt's zero point. */
const BETA_REST = 45;

export function useDeviceTilt(
  enabled: boolean,
  card: RefObject<HTMLDivElement | null>,
  /** Any element works — the background may be a div (blobs) or a canvas. */
  bg: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!enabled) return;
    let tx = 0;
    let ty = 0;
    let gx = 0;
    let gy = 0;
    let raf = 0;
    // The loop only spins once a sensor actually reports — gyro-less devices never start it.
    let started = false;

    const onOrient = (e: DeviceOrientationEvent) => {
      tx = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
      ty = Math.max(-1, Math.min(1, ((e.beta ?? BETA_REST) - BETA_REST) / 30));
      if (!started) {
        started = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      gx += (tx - gx) * 0.08;
      gy += (ty - gy) * 0.08;
      if (card.current) {
        card.current.style.transform = `rotateY(${(gx * MAX_DEG).toFixed(2)}deg) rotateX(${(-gy * MAX_DEG).toFixed(2)}deg)`;
      }
      if (bg.current) {
        bg.current.style.transform = `translate(${(-gx * BG_SHIFT_PX).toFixed(1)}px, ${(-gy * BG_SHIFT_PX).toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      cancelAnimationFrame(raf);
      // Reset so disabling doesn't freeze the layers mid-tilt.
      if (card.current) card.current.style.transform = '';
      if (bg.current) bg.current.style.transform = '';
    };
  }, [enabled, card, bg]);
}
