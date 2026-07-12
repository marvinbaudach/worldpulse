// Tiny rAF-cadence HUD, enabled via the `?fps` URL parameter: rolling average
// FPS plus the slowest frame of the last second, so real-hardware jank in the
// lightbox fly-in is visible as numbers instead of a feeling. Writes to the
// DOM directly from the rAF loop (throttled to one text update per 250ms) —
// per-frame React state would itself cause the jank it is measuring.

import { useEffect, useRef } from 'react';
import styled from 'styled-components';

const WINDOW_MS = 1000;
const UPDATE_MS = 250;
const FPS_GOOD = 55;
const FPS_OK = 30;

const Chip = styled.div`
  position: fixed;
  top: 12px;
  left: 12px;
  /* Above the lightbox overlay (z 20) so it keeps measuring inside it. */
  z-index: 40;
  pointer-events: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(2, 3, 7, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
`;

export function FpsMeter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let lastUpdate = 0;
    const frames: { t: number; d: number }[] = [];

    const tick = (now: number): void => {
      if (last) frames.push({ t: now, d: now - last });
      last = now;
      while (frames.length && frames[0].t < now - WINDOW_MS) frames.shift();
      if (frames.length && now - lastUpdate >= UPDATE_MS) {
        lastUpdate = now;
        const avg = frames.reduce((s, f) => s + f.d, 0) / frames.length;
        const worst = Math.max(...frames.map((f) => f.d));
        const fps = 1000 / avg;
        el.textContent = `${fps.toFixed(0)} fps · max ${worst.toFixed(0)} ms`;
        el.style.color = fps >= FPS_GOOD ? '#8fd694' : fps >= FPS_OK ? '#ffd98a' : '#ff8a80';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <Chip ref={ref} aria-hidden="true" />;
}
