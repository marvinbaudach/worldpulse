// Shared drawing vocabulary for the dashboard renderers. Every renderer works
// in "units" (u = width / 512), so the same code draws the 512px ring panels
// and the 1024px hero crisply.

import {
  BASELINE,
  CRITICAL,
  FONT,
  GOOD,
  GRID,
  INK,
  INK_SECONDARY,
  MUTED,
  SURFACE,
  SURFACE_DEEP,
} from './theme';
import { t as tr } from '../i18n';

/** Deterministic PRNG so every panel shows the same data on every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 0..1 series: a bounded random walk, lightly low-pass filtered. */
export function makeSeries(seed: number, n: number, drift = 0.35): number[] {
  const rand = rng(seed);
  const raw: number[] = [];
  let v = 0.3 + rand() * 0.4;
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5 + drift / n) * 0.22;
    v = Math.min(0.95, Math.max(0.08, v));
    raw.push(v);
  }
  return raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(n - 1, i + 1)];
    return (a + 2 * b + c) / 4;
  });
}

export const easeOut = (x: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Staggered per-item intro progress: item i starts i*gap into the intro. */
export function stagger(t: number, i: number, gap = 0.05, dur = 0.6): number {
  return easeOut((t - i * gap) / dur);
}

export function fmtCompact(v: number, unit = ''): string {
  const s =
    v >= 1e12
      ? `${(v / 1e12).toFixed(2)}T`
      : v >= 1e9
        ? `${(v / 1e9).toFixed(1)}B`
        : v >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M`
          : v >= 10_000
            ? `${(v / 1000).toFixed(0)}k`
            : v >= 1000
              ? `${(v / 1000).toFixed(1)}k`
              : `${Math.round(v)}`;
  return unit + s;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since the current hover/hero started — drives the animations. */
  t: number;
  /** 1 unit = 1 design pixel of the 512-wide reference layout. */
  u: number;
}

/** Panel background: soft vertical gradient plus a faint top light. */
export function drawSurface({ ctx, w, h }: Frame): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SURFACE);
  g.addColorStop(1, SURFACE_DEEP);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h * 0.18);
}

/** Tracked eyebrow label, wrapped onto a second line when it would overflow
    the panel. Returns the extra y-shift (0 or one line) for content below. */
function drawEyebrow({ ctx, u, w }: Frame, label: string): number {
  const pad = 36 * u;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${17 * u}px ${FONT}`;
  const tracking = 2.4 * u;
  // All panel labels arrive in German; translation happens at this single
  // choke point so the card definitions stay untouched.
  const upper = tr(label).toUpperCase();
  const maxW = w - 2 * pad;
  if (trackedWidth(ctx, upper, tracking) > maxW) {
    const [l1, l2] = wrapTwo(ctx, upper, tracking, maxW);
    drawTracked(ctx, l1, pad, pad + 14 * u, tracking);
    drawTracked(ctx, l2, pad, pad + 34 * u, tracking);
    return 22 * u;
  }
  drawTracked(ctx, upper, pad, pad + 16 * u, tracking);
  return 0;
}

/**
 * Eyebrow-only header for comparison cards: multi-series panels have no
 * single headline value, so the title stands alone and the chart gets the
 * vertical room the big figure would have taken.
 * Returns the y where the chart area begins.
 */
export function drawCompareHeader(f: Frame, label: string): number {
  const shift = drawEyebrow(f, label);
  return 36 * f.u + 34 * f.u + shift;
}

/**
 * Standard header: eyebrow label, big animated figure, delta chip.
 * Returns the y where the chart area begins.
 */
export function drawHeader(
  f: Frame,
  label: string,
  value: number,
  format: (v: number) => string,
  deltaPct: number | null,
  sub?: string,
): number {
  const { ctx, u, t } = f;
  const pad = 36 * u;
  const p = easeOut(t / 0.9);

  const shift = drawEyebrow(f, label);

  ctx.fillStyle = INK;
  ctx.font = `700 ${54 * u}px ${FONT}`;
  ctx.fillText(format(value * p), pad, pad + 78 * u + shift);

  if (deltaPct !== null) {
    const up = deltaPct >= 0;
    const color = up ? GOOD : CRITICAL;
    const text = `${up ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(1)}%`;
    ctx.font = `600 ${19 * u}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const cx = pad + 4 * u;
    const cy = pad + 100 * u + shift;
    ctx.fillStyle = up ? 'rgba(12,163,12,0.14)' : 'rgba(208,59,59,0.14)';
    roundRect(ctx, cx - 10 * u, cy - 20 * u, tw + 20 * u, 30 * u, 15 * u);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy + 2 * u);
    if (sub) {
      ctx.fillStyle = MUTED;
      ctx.font = `400 ${17 * u}px ${FONT}`;
      ctx.fillText(tr(sub), cx + tw + 24 * u, cy + 2 * u);
    }
  }

  return pad + 132 * u + shift;
}

/** Letter-spaced text (canvas has no letter-spacing of its own). */
// Grapheme segmentation keeps multi-code-point glyphs (flag emoji, ZWJ
// sequences) intact when the header spaces characters out one by one.
const graphemes = new Intl.Segmenter();

/** Width of a letter-spaced string (no trailing tracking), in the current font. */
function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  let width = 0;
  for (const { segment: ch } of graphemes.segment(text)) {
    width += ctx.measureText(ch).width + tracking;
  }
  return width - tracking;
}

/** Greedily split a title into two lines at word boundaries so the first line
    fills the panel width; the overflow (and the first word if it alone is too
    wide) falls to the second line. */
function wrapTwo(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
  maxW: number,
): [string, string] {
  const words = text.split(' ');
  let line1 = '';
  let i = 0;
  for (; i < words.length; i++) {
    const test = line1 ? `${line1} ${words[i]}` : words[i];
    if (line1 && trackedWidth(ctx, test, tracking) > maxW) break;
    line1 = test;
  }
  return [line1, words.slice(i).join(' ')];
}

export function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cx = x;
  for (const { segment: ch } of graphemes.segment(text)) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/** Recessive horizontal gridlines (labels are drawn separately, after the
    marks, so a series crossing a gridline never strikes through its label). */
export function drawGrid(
  f: Frame,
  top: number,
  bottom: number,
  count: number,
): void {
  const { ctx, w, u } = f;
  const pad = 36 * u;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1 * u;
  for (let i = 0; i < count; i++) {
    const y = bottom - ((bottom - top) * i) / (count - 1);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }
  ctx.strokeStyle = BASELINE;
  ctx.beginPath();
  ctx.moveTo(pad, bottom);
  ctx.lineTo(w - pad, bottom);
  ctx.stroke();
}

/** Tick labels for drawGrid — call after the marks so they stay readable. */
export function drawGridLabels(
  f: Frame,
  top: number,
  bottom: number,
  labels: string[],
): void {
  const { ctx, u } = f;
  const pad = 36 * u;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${14 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  labels.forEach((label, i) => {
    const y = bottom - ((bottom - top) * i) / (labels.length - 1);
    ctx.fillText(label, pad, y - 6 * u);
  });
}

/** Tiny legend row (dot + name per series), top-right of the chart area. */
export function drawLegend(
  f: Frame,
  y: number,
  entries: { name: string; color: string }[],
): void {
  const { ctx, w, u } = f;
  ctx.font = `500 ${15 * u}px ${FONT}`;
  ctx.textAlign = 'right';
  let x = w - 36 * u;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const name = tr(e.name);
    ctx.fillStyle = INK_SECONDARY;
    ctx.fillText(name, x, y);
    x -= ctx.measureText(name).width + 12 * u;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(x, y - 5 * u, 4.5 * u, 0, Math.PI * 2);
    ctx.fill();
    x -= 18 * u;
  }
  ctx.textAlign = 'left';
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

/** Polyline through normalized points inside a plot rect, x eased by `p`. */
export function linePath(
  ctx: CanvasRenderingContext2D,
  data: number[],
  x0: number,
  x1: number,
  yTop: number,
  yBottom: number,
  p: number,
): { x: number; y: number } {
  const n = data.length;
  const last = Math.max(1e-6, p) * (n - 1);
  const li = Math.min(n - 1, Math.floor(last));
  ctx.beginPath();
  let ex = x0;
  let ey = yBottom;
  for (let i = 0; i <= li; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const y = yBottom - (yBottom - yTop) * data[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ex = x;
    ey = y;
  }
  const frac = last - li;
  if (li < n - 1 && frac > 0) {
    const xa = x0 + ((x1 - x0) * li) / (n - 1);
    const xb = x0 + ((x1 - x0) * (li + 1)) / (n - 1);
    const ya = yBottom - (yBottom - yTop) * data[li];
    const yb = yBottom - (yBottom - yTop) * data[li + 1];
    ex = xa + (xb - xa) * frac;
    ey = ya + (yb - ya) * frac;
    ctx.lineTo(ex, ey);
  }
  return { x: ex, y: ey };
}
