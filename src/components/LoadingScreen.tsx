import { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { LIVE_FEEDS } from '../data/sources';
import { MOBILE_QUERY, useIsMobile } from '../hooks/useIsMobile';

interface LoadingScreenProps {
  done: boolean;
  onExited: () => void;
}

// Where the data stations sit on the globe — the cities of the real APIs in
// data/sources.ts, so the loader stays honest about its sources.
const CITY: Record<string, { lat: number; lon: number }> = {
  ZRH: { lat: 47.4, lon: 8.5 },
  SFO: { lat: 37.8, lon: -122.4 },
  WAS: { lat: 38.9, lon: -77.0 },
};

const STATIONS = [...new Set(LIVE_FEEDS.map((f) => f.code))].filter((c) => CITY[c]);

// Relay nodes padding out the uplink network — purely visual waypoints on the
// data route. The real sources stay the hub stations above; relays render
// smaller and dimmer so the hierarchy remains readable.
const RELAY: Record<string, { lat: number; lon: number }> = {
  HNL: { lat: 21.3, lon: -157.9 },
  GRU: { lat: -23.5, lon: -46.6 },
  KEF: { lat: 64.1, lon: -21.9 },
  LON: { lat: 51.5, lon: -0.1 },
  JNB: { lat: -26.2, lon: 28.0 },
  DEL: { lat: 28.6, lon: 77.2 },
  SIN: { lat: 1.4, lon: 103.8 },
  TYO: { lat: 35.7, lon: 139.7 },
  SYD: { lat: -33.9, lon: 151.2 },
};

// How long the dots take to converge into the center once loading is done —
// they collapse into exactly the point the carousel panels bloom out of.
const CONVERGE_MS = 750;

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

// The background lights breathe slowly, so the illumination drifts.
const breathe = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.12); }
`;
// Gradient highlight sweeping through the wordmark (background-clip: text).
const sweep = keyframes`
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
`;
// One-time draw-on for the EKG pulse line under the wordmark.
const drawOn = keyframes`
  to { stroke-dashoffset: 0; }
`;
// The scanner arc orbits the progress ring; transform-only, compositor-cheap.
const orbit = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;
// Barely-there parallax drift for the static starfield.
const drift = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-2.5%, -1.5%, 0); }
`;
// The exit flash pumps like a body barely containing its energy: two quick
// unequal beats per cycle, more heartbeat than sine wave.
const pump = keyframes`
  0%, 100% { transform: scale(1); }
  28% { transform: scale(1.16); }
  46% { transform: scale(0.97); }
  64% { transform: scale(1.09); }
  82% { transform: scale(0.99); }
`;

// Exit: the dots implode into a swelling light at the center, and the whole
// screen dissolves into the scene — a plain fade, no circle geometry left to
// read as a second pulse.
const Screen = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080b14;
  opacity: ${(p) => (p.$leaving ? 0 : 1)};
  pointer-events: ${(p) => (p.$leaving ? 'none' : 'auto')};
  transition: opacity 0.8s ease;
  overflow: hidden;
`;

// The light everything implodes into: a soft radial bloom at the exact
// center, swelling up during the convergence and carried out by the fade.
// It ignites hot and reddish, then cools into the bluish white the main
// scene lives in — while pumping like a body overloaded with energy.
// Three layers so nothing fights over transform: the outer div owns the
// swell transition, the inner one the pump animation, and the color shift
// is a warm gradient fading out over the cool one beneath it.
const Flash = styled.div<{ $done: boolean }>`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 90vmin;
  height: 90vmin;
  transform: translate(-50%, -50%) scale(${(p) => (p.$done ? 1 : 0.1)});
  opacity: ${(p) => (p.$done ? 1 : 0)};
  transition:
    transform ${CONVERGE_MS + 350}ms cubic-bezier(0.2, 0.7, 0.3, 1),
    opacity ${CONVERGE_MS}ms ease-out;
  pointer-events: none;
`;

const FlashPump = styled.div<{ $done: boolean }>`
  position: absolute;
  inset: 0;
  animation: ${(p) => (p.$done ? pump : 'none')} 0.55s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Cool base: the bluish white the flash settles into.
const FlashCool = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle,
    rgba(240, 246, 255, 0.85) 0%,
    rgba(144, 160, 235, 0.4) 22%,
    rgba(57, 135, 229, 0.12) 45%,
    transparent 68%
  );
`;

// Hot start: reddish-warm, fading out on top of the cool layer so the
// bloom reads as cooling from ember-red into blue-white.
const FlashHot = styled.div<{ $done: boolean }>`
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle,
    rgba(255, 235, 220, 0.9) 0%,
    rgba(250, 150, 110, 0.5) 22%,
    rgba(226, 88, 66, 0.16) 45%,
    transparent 68%
  );
  opacity: ${(p) => (p.$done ? 0 : 1)};
  transition: opacity ${CONVERGE_MS + 250}ms ease-in;
`;

const Glow = styled.div<{ $x: string; $y: string; $color: string; $delay: string }>`
  position: absolute;
  width: 80vmax;
  height: 80vmax;
  left: ${(p) => p.$x};
  top: ${(p) => p.$y};
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, ${(p) => p.$color} 0%, transparent 60%);
  filter: blur(40px);
  animation: ${breathe} 9s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Painted once on mount, then only drifts via transform — zero repaint cost.
const StarCanvas = styled.canvas`
  position: absolute;
  top: -3%;
  left: -3%;
  width: 106%;
  height: 106%;
  animation: ${drift} 70s linear infinite alternate;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// The globe fills the screen behind the type; the iris clips it on exit.
const GlobeCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

// Progress ring hugging the globe. On done it collapses into the center in
// step with the converging dots (same duration, same ease-in feel).
// Portrait phones size against the width instead of vmin — the globe canvas
// (see the draw loop) scales the same way, so the ring keeps hugging it.
const RingWrap = styled.div<{ $done: boolean }>`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 68vmin;
  height: 68vmin;

  @media (orientation: portrait) and (max-width: 640px) {
    width: 86vw;
    height: 86vw;
  }
  transform: translate(-50%, -50%) scale(${(p) => (p.$done ? 0 : 1)});
  opacity: ${(p) => (p.$done ? 0 : 1)};
  transition:
    transform ${CONVERGE_MS}ms cubic-bezier(0.55, 0, 0.7, 0.4),
    opacity ${CONVERGE_MS}ms ease-in;
  pointer-events: none;

  & > svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
`;

const ScannerSvg = styled.svg`
  animation: ${orbit} 9s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// The type collapses into the screen center together with the converging
// dots and the ring — same duration and ease — so the iris closes over an
// already-empty stage.
const Column = styled.div<{ $done: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  transform: scale(${(p) => (p.$done ? 0 : 1)});
  opacity: ${(p) => (p.$done ? 0 : 1)};
  transition:
    transform ${CONVERGE_MS}ms cubic-bezier(0.55, 0, 0.7, 0.4),
    opacity ${CONVERGE_MS}ms ease-in;
  pointer-events: none;
`;

// Gradient sweep needs background-clip, so the fill replaces text color;
// no text-shadow here (it would show through the transparent glyphs).
const Wordmark = styled.div`
  font-size: clamp(1.3rem, 4.5vw, 2.1rem);
  font-weight: 700;
  letter-spacing: 0.5em;
  margin-left: 0.5em; /* optically recenter the tracked-out text */
  background: linear-gradient(
    100deg,
    #f4f7fb 38%,
    #bcd0ff 47%,
    #9085e9 50%,
    #bcd0ff 53%,
    #f4f7fb 62%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ${sweep} 3.6s linear infinite;

  /* Portrait phones have height to spare and width to fill: bigger type,
     tracking trimmed so the tracked-out wordmark still fits the screen. */
  @media (orientation: portrait) and (max-width: 640px) {
    font-size: clamp(1.8rem, 7.5vw, 2.4rem);
    letter-spacing: 0.34em;
    margin-left: 0.34em;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: none;
    color: #f4f7fb;
  }
`;

// EKG heartbeat under the wordmark — draws itself on once via dashoffset.
const PulseSvg = styled.svg`
  width: min(340px, 80vw);
  height: 22px;
  overflow: visible;

  & path {
    fill: none;
    stroke: url(#wp-pulse-grad);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: ${drawOn} 1.4s cubic-bezier(0.4, 0, 0.3, 1) 0.15s forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    & path {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
`;

// Empty space the globe rotates through; the type sits above, progress below.
const GlobeGap = styled.div`
  height: min(48vmin, 44vh);

  /* Match the width-scaled portrait globe (86vw ring + breathing room), so
     the type clears its top edge instead of floating over the dots. */
  @media (orientation: portrait) and (max-width: 640px) {
    height: min(100vw, 56vh);
  }
`;

// Numeric progress under the globe — portrait phones only. The ring arc gets
// thin at phone size, and the tall screen leaves the lower third empty; a
// plain tabular readout fills it with the one number that matters.
const PctReadout = styled.div<{ $done: boolean }>`
  display: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 10vh);
  text-align: center;
  font: 600 17px ${MONO};
  letter-spacing: 0.24em;
  color: rgba(143, 184, 236, 0.85);
  opacity: ${(p) => (p.$done ? 0 : 1)};
  transition: opacity ${CONVERGE_MS}ms ease-in;
  pointer-events: none;

  @media (orientation: portrait) and (max-width: 640px) {
    display: block;
  }
`;

/** lat/lon (degrees) -> unit sphere. */
function toVec(lat: number, lon: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

/** Spherical interpolation between two unit vectors. */
function slerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const th = Math.acos(dot);
  if (th < 1e-4) return a;
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]];
}

export function LoadingScreen({ done, onExited }: LoadingScreenProps) {
  // The explosion handoff is choreographed for the desktop ring, which blooms
  // out of the flash's center. The mobile deck's first card already sits
  // there, so the burst would detonate on top of it — mobile exits with the
  // calm variant instead: globe implosion + plain fade, the card's own chart
  // fly-in is the reveal.
  const isMobile = useIsMobile();
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const pctRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  doneRef.current = done;

  // Starfield: painted exactly once; afterwards only the CSS drift moves it.
  useEffect(() => {
    const canvas = starRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const mag = Math.random();
      const s = 0.5 + mag * 1.3;
      // A handful of stars pick up the accent hues; the rest stay white.
      const tint = Math.random();
      ctx.fillStyle =
        tint > 0.92
          ? `rgba(144, 133, 233, ${0.3 + mag * 0.5})`
          : tint > 0.84
            ? `rgba(57, 135, 229, ${0.3 + mag * 0.5})`
            : `rgba(220, 230, 245, ${0.12 + mag * 0.45})`;
      ctx.fillRect(x, y, s, s);
    }
  }, []);

  // The globe: ~1500 dots on a sphere swirling in from the center, rotating;
  // a particle graticule (equator + two meridians) gives it structure, the
  // data stations pulse and send packets along great-circle arcs. On `done`
  // everything spirals back into the screen center — the same point the iris
  // then closes over and the carousel panels bloom out of.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // reduced motion: no globe, exit handled by the timer below
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // One-shot check (a viewport class change mid-boot is not a real case):
    // mobile skips the shockwave/dust — they radiate from the center, where
    // the deck's first card already sits (see the note on `isMobile` below).
    const mobileExit = window.matchMedia(MOBILE_QUERY).matches;

    // Fibonacci sphere.
    const N = 2600;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts: [number, number, number][] = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * golden;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    });
    // Particle graticule: equator plus two perpendicular meridians.
    const G = 96;
    const grid: [number, number, number][] = [];
    for (let k = 0; k < G; k++) {
      const a = (k / G) * Math.PI * 2;
      grid.push([Math.sin(a), 0, Math.cos(a)]);
      grid.push([0, Math.sin(a), Math.cos(a)]);
      grid.push([Math.sin(a), Math.cos(a), 0]);
    }
    // Hubs + relays, sorted by longitude so the closed arc loop reads as one
    // eastbound round-the-world data route instead of criss-cross chords.
    const stations = [
      ...STATIONS.map((code) => ({ code, hub: true, lon: CITY[code].lon, v: toVec(CITY[code].lat, CITY[code].lon) })),
      ...Object.entries(RELAY).map(([code, c]) => ({ code, hub: false, lon: c.lon, v: toVec(c.lat, c.lon) })),
    ].toSorted((a, b) => a.lon - b.lon);
    // Great-circle arcs between consecutive stations (loop closed).
    const arcs = stations.map((s, i) => ({
      a: s.v,
      b: stations[(i + 1) % stations.length].v,
      phase: i / stations.length,
    }));

    // Supernova dust: motes hurled outward by the shockwave when the flash
    // bursts. Each mote gets its own direction, launch delay, speed and a
    // slight tangential curl so the cloud reads as turbulence, not spokes.
    const dust = Array.from({ length: 260 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() ** 1.6 * 0.65,
      size: 1.3 + Math.random() * 3.1,
      delay: Math.random() * 0.14,
      curl: (Math.random() - 0.5) * 0.7,
      glow: Math.random(),
    }));
    // The wave fires as the iris starts closing (the moment the flash peaks)
    // and rides out on the screen fade.
    const WAVE_DELAY_MS = CONVERGE_MS * 0.45;
    const WAVE_MS = 950;

    const TILT = 0.42;
    let raf = 0;
    let doneAt: number | null = null;
    let exited = false;
    const t0 = performance.now();
    // Rotation is integrated per frame so it can speed up with progress
    // without ever jumping: spin rate scales from idle up to ~3x at 100%.
    let spin = 0;
    let lastNow = t0;

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Convergence: after done, dots spiral into the center. The iris starts
      // closing partway through the implosion — overlapping the two reads as
      // one continuous motion instead of two circles pulsing in sequence.
      if (doneRef.current && doneAt === null) doneAt = now;
      const conv = doneAt ? Math.min(1, (now - doneAt) / CONVERGE_MS) : 0;
      const ease = conv * conv * (3 - 2 * conv); // smoothstep
      if (conv >= 0.45 && !exited) {
        exited = true;
        setLeaving(true);
      }

      const cx = w / 2;
      const cy = h / 2;
      // Portrait phones: scale on width to fill the tall screen, tracking the
      // ring's 86vw sizing (ring radius 0.378w; globe stays just inside it).
      const base = h > w && w <= 640 ? w * 0.348 : Math.min(w, h) * 0.3;
      const R = base * (1 - ease);
      // Assembly: dots swirl outward from the center during the first beat.
      const assemble = Math.min(1, t / 1.1);
      const aEase = 1 - Math.pow(1 - assemble, 3);
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      spin += dt * (0.32 + (pctRef.current / 100) * 0.65);
      // Assembly swirl and exit spin-up both wind in the SAME direction as
      // the idle spin (hence the minus: the offset unwinds forward), so the
      // globe never visibly stops and reverses.
      const rot = spin - (1 - aEase) * 2.2 + ease * 1.6;

      const sinR = Math.sin(rot);
      const cosR = Math.cos(rot);
      const sinT = Math.sin(TILT);
      const cosT = Math.cos(TILT);
      const project = (p: [number, number, number]) => {
        const x1 = p[0] * cosR + p[2] * sinR;
        const z1 = -p[0] * sinR + p[2] * cosR;
        const y2 = p[1] * cosT - z1 * sinT;
        const z2 = p[1] * sinT + z1 * cosT;
        return { x: cx + x1 * R * aEase, y: cy - y2 * R * aEase, z: z2 };
      };

      // Sphere dots — back ones dim, front ones bright.
      for (let i = 0; i < N; i++) {
        const q = project(pts[i]);
        const depth = (q.z + 1) / 2;
        const alpha = (0.34 + depth * 0.62) * aEase * (1 - ease * 0.6);
        ctx.fillStyle = `rgba(142, 190, 255, ${alpha})`;
        const s = 1.6 + depth * 2.3;
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }

      // Graticule dots — fainter and finer than the sphere fill.
      for (const g of grid) {
        const q = project(g);
        const depth = (q.z + 1) / 2;
        const alpha = (0.14 + depth * 0.3) * aEase * (1 - ease);
        ctx.fillStyle = `rgba(175, 208, 255, ${alpha})`;
        const s = 0.9 + depth * 1.2;
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }

      // Arcs with a travelling packet each.
      for (const arc of arcs) {
        const head = (t * 0.45 + arc.phase) % 1;
        for (let k = 0; k <= 44; k++) {
          const ft = k / 44;
          const v = slerp(arc.a, arc.b, ft);
          const lift = 1 + 0.28 * Math.sin(Math.PI * ft);
          const q = project([v[0] * lift, v[1] * lift, v[2] * lift]);
          if (q.z < -0.15) continue; // behind the globe
          const packet = Math.max(0, 1 - Math.abs(ft - head) * 14);
          const alpha = (0.3 + packet * 0.7) * aEase * (1 - ease);
          ctx.fillStyle =
            packet > 0.25
              ? `rgba(168, 158, 255, ${alpha})`
              : `rgba(88, 162, 255, ${alpha})`;
          const s = 2.2 + packet * 3.6;
          ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
        }
      }

      // Stations: bright dot, ping ring, code label on the front side.
      // Hubs (the real API cities) stay big and bright; relays render
      // smaller and dimmer so the source hierarchy stays readable.
      stations.forEach((st, i) => {
        const q = project(st.v);
        if (q.z < -0.05) return;
        const front = Math.min(1, (q.z + 0.05) / 0.6);
        const a = front * aEase * (1 - ease) * (st.hub ? 1 : 0.6);
        const dotR = st.hub ? 4.5 : 3;
        ctx.fillStyle = `rgba(150, 200, 255, ${Math.min(1, a * 1.2)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, dotR, 0, Math.PI * 2);
        ctx.fill();
        const ring = (t * 0.7 + i * 0.33) % 1;
        ctx.strokeStyle = `rgba(95, 165, 255, ${(1 - ring) * 0.7 * a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(q.x, q.y, dotR + ring * (st.hub ? 14 : 9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(170, 205, 250, ${(st.hub ? 0.95 : 0.7) * a})`;
        ctx.font = st.hub ? `600 11px ${MONO}` : `500 9px ${MONO}`;
        ctx.fillText(st.code, q.x + dotR + 5, q.y + 4);
      });

      // Shockwave + dust: once the flash peaks, a pressure ring races outward
      // and drags a cloud of nebula dust with it. Each mote starts ember-warm
      // and cools to blue as it flies — the flash's color story, scattered.
      const waveT = !mobileExit && doneAt
        ? Math.min(1, Math.max(0, (now - doneAt - WAVE_DELAY_MS) / WAVE_MS))
        : 0;
      if (waveT > 0 && waveT < 1) {
        const we = 1 - Math.pow(1 - waveT, 3); // easeOutCubic
        const maxR = Math.min(w, h) * 0.72;
        const fade = 1 - waveT;

        // Pressure front: a thin bright ring with a soft trailing band.
        ctx.strokeStyle = `rgba(205, 224, 255, ${0.55 * fade})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, we * maxR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(120, 160, 235, ${0.22 * fade})`;
        ctx.lineWidth = 10 + 26 * we;
        ctx.beginPath();
        ctx.arc(cx, cy, we * maxR * 0.9, 0, Math.PI * 2);
        ctx.stroke();

        for (const d of dust) {
          const p = Math.min(1, Math.max(0, (waveT - d.delay) / (1 - d.delay)));
          if (p <= 0) continue;
          const pe = 1 - Math.pow(1 - p, 2.6);
          const a = d.angle + d.curl * pe;
          const r = pe * maxR * d.speed;
          // Ember → blue: the warm channel decays as the mote flies out.
          const warm = Math.max(0, 1 - p * 2.2);
          const cr = Math.round(168 + 87 * warm);
          const cg = Math.round(198 - 28 * warm);
          const cb = Math.round(255 - 145 * warm);
          const alpha = (1 - p) * (0.55 + d.glow * 0.45);
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
          const s = d.size * (1 - p * 0.55);
          ctx.fillRect(cx + Math.cos(a) * r - s / 2, cy + Math.sin(a) * r - s / 2, s, s);
        }
      }

      // Keep drawing behind the closing iris until the dots reach the center
      // and the shockwave has run its course (mobile skips the wave).
      const waveDone =
        mobileExit || (doneAt !== null && now - doneAt >= WAVE_DELAY_MS + WAVE_MS);
      if (conv < 1 || !waveDone) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Eased percentage: climbs toward 92 while booting, snaps to 100 on done.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = done ? 100 : 92;
      pctRef.current += (target - pctRef.current) * (done ? 0.2 : 0.045);
      const next = Math.round(pctRef.current);
      setPct((prev) => (prev === next ? prev : next));
      if (pctRef.current < 99.6) raf = requestAnimationFrame(tick);
      else setPct(100);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  // Reduced motion has no converge animation — leave on a short timer.
  useEffect(() => {
    if (!done || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setLeaving(true), 420);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <Screen
      $leaving={leaving}
      onTransitionEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onExited();
      }}
      aria-hidden={leaving}
    >
      <Glow $x="30%" $y="32%" $color="rgba(64, 145, 240, 0.4)" $delay="0s" />
      <Glow $x="72%" $y="64%" $color="rgba(150, 140, 245, 0.32)" $delay="-3s" />
      <Glow $x="55%" $y="45%" $color="rgba(28, 170, 122, 0.18)" $delay="-6s" />

      <StarCanvas ref={starRef} aria-hidden />
      <GlobeCanvas ref={canvasRef} aria-hidden />
      {!isMobile && (
        <Flash $done={done} aria-hidden>
          <FlashPump $done={done}>
            <FlashCool />
            <FlashHot $done={done} />
          </FlashPump>
        </Flash>
      )}

      {/* Progress ring around the globe: track, percentage arc, scanner. */}
      <RingWrap $done={done} aria-hidden>
        <svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id="wp-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3987e5" />
              <stop offset="100%" stopColor="#9085e9" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="rgba(255, 255, 255, 0.07)"
            strokeWidth="0.3"
          />
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="url(#wp-ring-grad)"
            strokeWidth="0.45"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} ${100 - pct}`}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray 0.25s linear' }}
          />
        </svg>
        <ScannerSvg viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="rgba(188, 208, 255, 0.5)"
            strokeWidth="0.3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="4 96"
          />
        </ScannerSvg>
      </RingWrap>

      {isMobile && <PctReadout $done={done}>{pct} %</PctReadout>}

      <Column $done={done}>
        <Wordmark>WORLDPULSE</Wordmark>
        <PulseSvg viewBox="0 0 340 22" aria-hidden>
          <defs>
            <linearGradient id="wp-pulse-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(57, 135, 229, 0)" />
              <stop offset="18%" stopColor="#3987e5" />
              <stop offset="55%" stopColor="#9085e9" />
              <stop offset="82%" stopColor="#3987e5" />
              <stop offset="100%" stopColor="rgba(57, 135, 229, 0)" />
            </linearGradient>
          </defs>
          <path
            pathLength={1}
            d="M0 11 H118 l7 -7 8 14 7 -7 H216 l6 -5 7 10 6 -5 H340"
          />
        </PulseSvg>
        <GlobeGap />
      </Column>
    </Screen>
  );
}
