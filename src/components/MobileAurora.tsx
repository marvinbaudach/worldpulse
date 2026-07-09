import { useEffect, useRef, type Ref } from 'react';
import styled from 'styled-components';

// The desktop aurora, ported to a raw WebGL quad for the mobile deck: same
// domain-warped fbm flow and theme tint, but no three.js/R3F overhead and no
// star layers (they pixelate at this resolution). The nebula is soft, so it
// renders into a small backing store (RES_CAP wide) and lets the browser
// upscale — a fraction of the fill-rate of a native-resolution pass.
// Callers must WebGL-check first (see hasWebGL) and fall back to the CSS
// blob background (MobileBackground) when unavailable or when the user
// prefers reduced motion.
const RES_CAP = 480;
// Accents are bright chart colors; scaled to nebula luminance. Runs hotter
// than the desktop aurora — on the phone the backdrop is a narrow frame
// around the card and has to carry the whole mood, so the tint stays vivid.
const TINT_SCALE = 0.85;

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

// Trimmed copy of Aurora.tsx's fragment shader: 3 fbm octaves instead of 4
// and no starfield — the remaining flow is what reads as motion on a phone.
const FRAG = `
  precision mediump float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uTint;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    uv.x *= uAspect;
    // Faster than the desktop aurora (0.06): on a phone the backdrop is the
    // only ambient motion, so it has to visibly live.
    float t = uTime * 0.1;

    vec2 q = vec2(
      fbm(uv * 1.5 + vec2(t * 0.6, t)),
      fbm(uv * 1.5 + vec2(5.2 - t * 0.4, -t * 0.8))
    );
    float n = fbm(uv * 2.0 + q * 1.5 + vec2(t * 0.9, t * 0.3));
    float n2 = fbm(uv * 3.5 - q * 1.2 - vec2(t * 0.6, t * 0.4));

    // Tint-led palette: the card's dominant hue drives the nebula. A cooler
    // and a warmer companion (both derived from the tint) keep it from going
    // flat-monochrome, and even the base floor is faintly tinted — so the
    // whole frame takes the card's color instead of a fixed dark blue. Weights
    // run brighter than before: the phone backdrop should glow, not sit dim.
    vec3 tint = uTint;
    vec3 cool = mix(tint, vec3(0.10, 0.24, 0.52), 0.5);
    vec3 warm = mix(tint, vec3(0.52, 0.18, 0.42), 0.4);
    vec3 base = tint * 0.16 + vec3(0.024, 0.032, 0.052);

    vec3 col = base;
    col += tint * smoothstep(0.20, 0.90, n) * 1.30;
    col += cool * smoothstep(0.42, 1.00, n2) * 0.85;
    col += warm * smoothstep(0.50, 1.00, n * n2) * 0.55;

    // Light shafts: two soft diagonal beams panning at different speeds.
    // Multiplied by the nebula density so they read as light through haze,
    // not as flat stripes painted on top.
    float diag = uv.x * 0.7 + uv.y * 0.75;
    float haze = smoothstep(0.3, 0.9, n);
    float beamA = smoothstep(0.86, 1.0, sin(diag * 2.6 - uTime * 0.22));
    float beamB = smoothstep(0.9, 1.0, sin(diag * 4.2 + uTime * 0.15 + 1.7));
    col += (tint + cool * 0.5) * (beamA * 0.45 + beamB * 0.32) * haze;

    // Wandering glints: sparse bright knots where both noise fields peak,
    // drifting with the flow — small "city lights" inside the nebula.
    float glint = smoothstep(0.78, 0.98, n * n2 * (1.4 + 0.6 * sin(uTime * 0.6)));
    col += (tint + vec3(0.28)) * glint * 0.4;

    // No center dimming — the card covers the middle anyway. The visible
    // band around the card is only a narrow frame in portrait, so the edge
    // boost is strong and starts just outside the card's footprint
    // (d ≈ 0.35); it breathes slowly so the frame feels alive.
    float d = distance(vUv, vec2(0.5));
    float breath = 1.9 + 0.2 * sin(uTime * 0.45);
    col *= mix(1.0, breath, smoothstep(0.3, 0.62, d));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** One-time capability probe for the caller's aurora-vs-blobs decision. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

const GlCanvas = styled.canvas`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1; /* same background slot as the CSS blob layer */
  pointer-events: none;
  /* Stage color behind the GL buffer: if a driver fails to composite the
     canvas at all, the element still reads as the dark page, never white. */
  background: #080b14;
`;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[aurora] shader compile failed', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

interface MobileAuroraProps {
  /** Active theme accent (TAGS[].accent). */
  accent: string;
  /** Called when GL setup fails or the context is lost — the caller should
      swap to the CSS blob background instead of leaving a dead canvas. */
  onFail?: () => void;
  /** The gyro parallax shifts this element against the cards (Task 7). */
  ref?: Ref<HTMLCanvasElement>;
}

/** Shader aurora behind the mobile deck — the living background. */
export function MobileAurora({ accent, onFail, ref }: MobileAuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The tint target lives in a ref so an accent change never restarts the GL
  // setup effect — the render loop eases toward it, like the desktop aurora.
  const tint = useRef<[number, number, number]>(hexToRgb('#3987e5'));
  const target = useRef(tint.current);
  target.current = hexToRgb(accent).map((v) => v * TINT_SCALE) as [number, number, number];

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', { alpha: false, antialias: false });
    if (!canvas || !gl) {
      onFail?.(); // caller probed hasWebGL(), but drivers can still refuse
      return;
    }

    // Paint the stage color before anything else, so the buffer is never
    // uninitialized memory (white garbage on some drivers).
    gl.clearColor(0.03, 0.042, 0.078, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      onFail?.();
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[aurora] program link failed', gl.getProgramInfoLog(prog));
      onFail?.();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uAspect = gl.getUniformLocation(prog, 'uAspect');
    const uTint = gl.getUniformLocation(prog, 'uTint');

    const size = () => {
      const scale = Math.min(1, RES_CAP / canvas.clientWidth);
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uAspect, w / h);
    };
    size();

    let raf = 0;
    let last = performance.now();
    let time = 0;
    const frame = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += delta;
      // Frame-rate independent ease toward the active theme's tint.
      const k = 1 - Math.exp(-delta * 1.4);
      const t0 = tint.current;
      const t1 = target.current;
      tint.current = [
        t0[0] + (t1[0] - t0[0]) * k,
        t0[1] + (t1[1] - t0[1]) * k,
        t0[2] + (t1[2] - t0[2]) * k,
      ];
      gl.uniform1f(uTime, time);
      gl.uniform3f(uTint, ...tint.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Don't burn GPU while the tab is hidden.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', size);
    // A lost context (GPU reset, driver hiccup) leaves a dead canvas — hand
    // over to the CSS blob background instead of showing a frozen frame.
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      onFail?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', size);
      canvas.removeEventListener('webglcontextlost', onLost);
      // Do NOT loseContext() here: StrictMode re-runs this effect on the same
      // canvas, and getContext() would hand the second run the same — now
      // dead — context, failing every compile (dev-only aurora blackout that
      // silently swapped in the blob fallback). Freeing the GL objects is
      // enough; the context itself dies with the canvas element.
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
    // onFail is a stable callback (caller memoizes); the GL setup must not
    // re-run on prop identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Both refs point at the same canvas: ours drives GL, the caller's the tilt.
  return (
    <GlCanvas
      ref={(el) => {
        canvasRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
}
