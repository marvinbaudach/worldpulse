// Camera dolly for the desktop ring: +/- keys (tap to nudge, hold to glide)
// and Ctrl + wheel (a trackpad pinch arrives the same way). Zoom only frames
// the ring, so both inputs idle while a hero owns the screen.
import { useEffect, useState } from 'react';

const ZOOM_MIN = 0.5;
// The default framing already sits at reading distance; 1.6 lets the front
// panel fill the frame without the camera dollying past the hero plane
// (heroZ = radius + CAMERA_GAP - 4).
const ZOOM_MAX = 1.6;
// Hold-to-zoom rate (factor per second): tap for a small nudge, hold to
// glide all the way in or out.
const ZOOM_RATE = 2.0;

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function useZoomControls(heroOpen: boolean): number {
  const [zoom, setZoom] = useState(1);

  // Hold +/- to zoom continuously: keydown latches a direction, keyup releases
  // it, and a rAF loop dollies the ring by ZOOM_RATE per second while held.
  useEffect(() => {
    const isIn = (e: KeyboardEvent) => e.key === '+' || e.key === '=';
    const isOut = (e: KeyboardEvent) => e.key === '-' || e.key === '_';
    let dir = 0;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!dir || heroOpen) {
        last = now;
        return;
      }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const factor = Math.pow(ZOOM_RATE, dir * dt);
      setZoom((z) => clamp(z * factor));
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isIn(e)) dir = 1;
      else if (isOut(e)) dir = -1;
    };
    const onUp = (e: KeyboardEvent) => {
      if ((isIn(e) && dir === 1) || (isOut(e) && dir === -1)) {
        dir = 0;
        last = 0;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [heroOpen]);

  // Ctrl + wheel dollies the camera with the same bounds as the +/- keys.
  // preventDefault stops the browser's own page zoom.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (heroOpen) return;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom((z) => clamp(z * factor));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [heroOpen]);

  return zoom;
}
