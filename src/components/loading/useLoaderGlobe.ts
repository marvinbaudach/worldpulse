import { useEffect, type RefObject } from 'react';
import { LIVE_FEEDS } from '../../data/sources';
import { MOBILE_QUERY } from '../../hooks/useIsMobile';
import { CONVERGE_MS, MONO } from './loaderConstants';
import { alphaBucket, slerp, toVec, type Vec3 } from './loaderMath';

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

// Alpha quantization for the dot fields. The globe's ~2600 sphere dots (plus
// graticule and arc samples) used to each reassign `ctx.fillStyle` to a freshly
// built rgba string every frame — thousands of string builds while the WebGL
// scene compiles. Bucketing the alpha into this many bins lets the draw set the
// fill once per bin instead (≤ ~36 style changes/frame total). 10 bins keep the
// depth gradient visually smooth; bin 0 (alpha ≈ 0) is never drawn.
const BUCKETS = 10;
type Buckets = number[][]; // BUCKETS arrays of flat [x, y, size, ...] triples
const makeBuckets = (): Buckets => Array.from({ length: BUCKETS }, () => []);

interface GlobeRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Live percentage (0..100); the spin rate scales with it. */
  pctRef: RefObject<number>;
  /** Whether the boot has finished — read every frame to start the converge. */
  doneRef: RefObject<boolean>;
  /** Called once when the iris should start closing. */
  onLeave: () => void;
}

/**
 * The globe: ~2600 dots on a sphere swirling in from the center, rotating; a
 * particle graticule (equator + two meridians) gives it structure, the data
 * stations pulse and send packets along great-circle arcs. On `done` everything
 * spirals back into the screen center — the same point the iris then closes
 * over and the carousel panels bloom out of.
 */
export function useLoaderGlobe({ canvasRef, pctRef, doneRef, onLeave }: GlobeRefs): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // reduced motion: no globe, exit handled by the caller's timer
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // One-shot check (a viewport class change mid-boot is not a real case):
    // mobile skips the shockwave/dust — they radiate from the center, where
    // the deck's first card already sits.
    const mobileExit = window.matchMedia(MOBILE_QUERY).matches;

    // Fibonacci sphere.
    const N = 2600;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts: Vec3[] = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * golden;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    });
    // Particle graticule: equator plus two perpendicular meridians.
    const G = 96;
    const grid: Vec3[] = [];
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
    // A denser, faster field so the discharge hits with real force.
    const dust = Array.from({ length: 380 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() ** 1.6 * 0.85,
      size: 1.3 + Math.random() * 3.4,
      delay: Math.random() * 0.12,
      curl: (Math.random() - 0.5) * 0.8,
      glow: Math.random(),
    }));
    // The wave fires as the iris starts closing (the moment the flash peaks)
    // and rides out on the screen fade.
    const WAVE_DELAY_MS = CONVERGE_MS * 0.45;
    const WAVE_MS = 950;

    // Pre-allocated dot buckets, reused each frame (cleared, not reallocated).
    // The sphere splits into a deep-blue body and a white-hot spark set: dots
    // caught mid-flare route into `sparkBk` and flush near-white, so the globe
    // reads as a dark-blue field crackling with electricity rather than a flat
    // pale-blue cloud.
    const sphereBk = makeBuckets();
    const sparkBk = makeBuckets();
    const gridBk = makeBuckets();
    const arcWarmBk = makeBuckets();
    const arcCoolBk = makeBuckets();
    const clear = (bk: Buckets) => {
      for (const a of bk) a.length = 0;
    };
    // Flush a bucket set as one fill per non-empty bin: set fillStyle once, then
    // draw every rect in that bin. Bin index maps back to a representative alpha.
    const flush = (bk: Buckets, r: number, g: number, b: number) => {
      for (let bi = 1; bi < BUCKETS; bi++) {
        const arr = bk[bi];
        if (arr.length === 0) continue;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bi / (BUCKETS - 1)})`;
        for (let k = 0; k < arr.length; k += 3) {
          const s = arr[k + 2];
          ctx.fillRect(arr[k] - s / 2, arr[k + 1] - s / 2, s, s);
        }
      }
    };

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
        onLeave();
      }

      const cx = w / 2;
      const cy = h / 2;
      // Portrait phones: scale on width to fill the tall screen, tracking the
      // ring's 86vw sizing (ring radius 0.378w; globe stays just inside it).
      // Desktop is sized against the 62vmin ring, leaving headroom for the
      // type block that now sits fully above the globe.
      const base = h > w && w <= 640 ? w * 0.348 : Math.min(w, h) * 0.27;
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
      // Fixed light in view space (upper left, toward the viewer): the dot
      // sphere gets a lit day side and a dim night side as it turns, which is
      // what makes it read as a sphere instead of a flat dot cloud.
      const project = (p: Vec3) => {
        const x1 = p[0] * cosR + p[2] * sinR;
        const z1 = -p[0] * sinR + p[2] * cosR;
        const y2 = p[1] * cosT - z1 * sinT;
        const z2 = p[1] * sinT + z1 * cosT;
        return {
          x: cx + x1 * R * aEase,
          y: cy - y2 * R * aEase,
          z: z2,
          light: Math.max(0, x1 * -0.45 + y2 * 0.5 + z2 * 0.74),
        };
      };

      // Sphere dots — depth dims the back, the terminator shades the night
      // side, and a deterministic subset flares briefly ("data arriving").
      // Flaring dots split off into the white spark set so they read as
      // electric discharge points against the deep-blue body.
      clear(sphereBk);
      clear(sparkBk);
      for (let i = 0; i < N; i++) {
        const q = project(pts[i]);
        const depth = (q.z + 1) / 2;
        const shade = 0.3 + 0.7 * q.light;
        const flare =
          i % 19 === 0
            ? Math.max(0, Math.sin(t * 1.8 + i * 0.911)) ** 24 * (0.3 + 0.7 * depth)
            : 0;
        const alpha =
          Math.min(1, (0.16 + depth * 0.42) * (0.5 + shade) + flare * 0.9) *
          aEase *
          (1 - ease * 0.6);
        const bi = alphaBucket(alpha, BUCKETS);
        if (bi === 0) continue;
        const s = 1.6 + depth * 2.0 + flare * 3.2;
        (flare > 0.12 ? sparkBk : sphereBk)[bi].push(q.x, q.y, s);
      }
      flush(sphereBk, 64, 118, 240); // deep electric blue body
      flush(sparkBk, 234, 244, 255); // white-hot discharge points

      // Graticule dots — fainter and finer than the sphere fill.
      clear(gridBk);
      for (const g of grid) {
        const q = project(g);
        const depth = (q.z + 1) / 2;
        const alpha = (0.14 + depth * 0.3) * aEase * (1 - ease);
        const bi = alphaBucket(alpha, BUCKETS);
        if (bi === 0) continue;
        const s = 0.9 + depth * 1.2;
        gridBk[bi].push(q.x, q.y, s);
      }
      flush(gridBk, 120, 168, 250);

      // Arcs with a travelling packet each. Warm (near the packet) and cool
      // (the trailing line) collect into separate bucket sets.
      clear(arcWarmBk);
      clear(arcCoolBk);
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
          const bi = alphaBucket(alpha, BUCKETS);
          if (bi === 0) continue;
          const s = 2.2 + packet * 3.6;
          (packet > 0.25 ? arcWarmBk : arcCoolBk)[bi].push(q.x, q.y, s);
        }
      }
      flush(arcWarmBk, 224, 238, 255); // packet head: white-hot charge
      flush(arcCoolBk, 74, 146, 250); // trailing line: electric blue

      // Stations: bright dot, ping ring, code label on the front side.
      // Hubs (the real API cities) stay big and bright; relays render
      // smaller and dimmer so the source hierarchy stays readable.
      stations.forEach((st, i) => {
        const q = project(st.v);
        if (q.z < -0.05) return;
        const front = Math.min(1, (q.z + 0.05) / 0.6);
        const a = front * aEase * (1 - ease) * (st.hub ? 1 : 0.6);
        const dotR = st.hub ? 4.5 : 3;
        ctx.fillStyle = `rgba(224, 240, 255, ${Math.min(1, a * 1.25)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, dotR, 0, Math.PI * 2);
        ctx.fill();
        const ring = (t * 0.7 + i * 0.33) % 1;
        ctx.strokeStyle = `rgba(90, 170, 255, ${(1 - ring) * 0.75 * a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(q.x, q.y, dotR + ring * (st.hub ? 14 : 9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(170, 205, 250, ${(st.hub ? 0.95 : 0.7) * a})`;
        ctx.font = st.hub ? `600 11px ${MONO}` : `500 9px ${MONO}`;
        ctx.fillText(st.code, q.x + dotR + 5, q.y + 4);
      });

      // Shockwave + dust: once the flash peaks, a pressure ring races outward
      // and drags a cloud of nebula dust with it. Each mote starts white-hot
      // and cools to electric blue as it flies — an electrical discharge, not
      // an ember spray.
      const waveT = !mobileExit && doneAt
        ? Math.min(1, Math.max(0, (now - doneAt - WAVE_DELAY_MS) / WAVE_MS))
        : 0;
      if (waveT > 0 && waveT < 1) {
        const we = 1 - Math.pow(1 - waveT, 3); // easeOutCubic
        const maxR = Math.min(w, h) * 0.78;
        const fade = 1 - waveT;

        // Pressure front: a hot white ring with a wide electric-blue trailing
        // band, brightest right as the wave fires.
        ctx.strokeStyle = `rgba(232, 242, 255, ${0.72 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, we * maxR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(86, 150, 250, ${0.3 * fade})`;
        ctx.lineWidth = 12 + 34 * we;
        ctx.beginPath();
        ctx.arc(cx, cy, we * maxR * 0.9, 0, Math.PI * 2);
        ctx.stroke();

        for (const d of dust) {
          const p = Math.min(1, Math.max(0, (waveT - d.delay) / (1 - d.delay)));
          if (p <= 0) continue;
          const pe = 1 - Math.pow(1 - p, 2.6);
          const a = d.angle + d.curl * pe;
          const r = pe * maxR * d.speed;
          // White-hot → electric blue: the hot channels decay as the mote
          // flies out, leaving a saturated blue core.
          const hot = Math.max(0, 1 - p * 2.2);
          const cr = Math.round(90 + 150 * hot);
          const cg = Math.round(165 + 80 * hot);
          const cb = 255;
          const alpha = (1 - p) * (0.6 + d.glow * 0.4);
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
    // Refs and onLeave are stable; the globe is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
