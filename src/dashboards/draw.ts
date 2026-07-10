// Shared drawing vocabulary for the dashboard renderers. Every renderer works
// in "units" relative to a reference width (512 for the ring panels and the
// 1024px hero; the mobile deck uses a smaller reference to boost type), so
// the same code draws every surface crisply.

import {
  BASELINE,
  FONT,
  GRID,
  INK_SECONDARY,
  SURFACE,
  SURFACE_DEEP,
} from './theme';
import { localeNum, t as tr } from '../i18n';

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
      ? `${localeNum(v / 1e12, 2)} ${tr('Bio.')}`
      : v >= 1e9
        ? `${localeNum(v / 1e9, 1)} ${tr('Mrd')}`
        : v >= 1_000_000
          ? `${localeNum(v / 1_000_000, 1)} ${tr('Mio')}`
          : v >= 10_000
            ? `${localeNum(v / 1000, 0)}k`
            : v >= 1000
              ? `${localeNum(v / 1000, 1)}k`
              : `${Math.round(v)}`;
  return unit + s;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since the current hover/hero started — drives the animations. */
  t: number;
  /** 1 unit = 1 design pixel of the reference layout (512-wide on the
      ring/hero; the mobile deck uses a smaller reference width). */
  u: number;
  /** Mobile deck: skip tertiary chrome (the source footer) — on the phone
      the source already lives behind the info button. */
  compact?: boolean;
  /** Set by drawSource once a source line is on the canvas, so the PNG export
      knows whether it still needs to stamp its own attribution footer. */
  sourceDrawn?: boolean;
}

/** Panel background: soft vertical gradient, a faint top light, and a hairline
    edge rim. The rim keeps the panel's silhouette crisp against the dark space
    now that the surface itself is nearly black — without it a card at the back
    of the ring would dissolve into the starfield. */
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
  // Edge light: a thin inner rounded stroke, brightest at the top (same light
  // direction as the sheen) and fading down the sides — reads as light catching
  // a bevelled rim. Inset just inside the Image mask's corner radius (~2.5% of
  // width) so the corners stay clean rather than clipped.
  const inset = Math.max(2, w * 0.006);
  const rr = w * 0.025;
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, 'rgba(255,255,255,0.14)');
  rim.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  rim.addColorStop(1, 'rgba(255,255,255,0.07)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, rr);
  ctx.stroke();
}

/** Tracked eyebrow label, wrapped onto a second line when it would overflow
    the panel. Returns the extra y-shift (0 or one line) for content below. */
function drawEyebrow({ ctx, u, w }: Frame, label: string): number {
  const pad = 36 * u;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // INK_SECONDARY, not MUTED: the eyebrow is the card's only heading and the
  // muted gray was too dim to read comfortably (user feedback).
  ctx.fillStyle = INK_SECONDARY;
  const baseSize = 17 * u;
  const tracking = 2.4 * u;
  ctx.font = `600 ${baseSize}px ${FONT}`;
  // All panel labels arrive in German; translation happens at this single
  // choke point so the card definitions stay untouched.
  const upper = tr(label).toUpperCase();
  const maxW = w - 2 * pad;
  if (trackedWidth(ctx, upper, tracking) > maxW) {
    const [l1, l2] = wrapTwo(ctx, upper, tracking, maxW);
    // A very long label (a long word, or many "·"-joined segments) can leave
    // the second line still wider than the panel. Scale the whole eyebrow
    // down to fit rather than letting it clip at the right edge; the common
    // case (both lines already fit) keeps scale 1 and is untouched.
    const widest = Math.max(
      trackedWidth(ctx, l1, tracking),
      trackedWidth(ctx, l2, tracking),
    );
    const scale = widest > maxW ? Math.max(0.72, maxW / widest) : 1;
    const s = tracking * scale;
    ctx.font = `600 ${baseSize * scale}px ${FONT}`;
    drawTracked(ctx, l1, pad, pad + 14 * u, s);
    drawTracked(ctx, l2, pad, pad + 34 * u, s);
    return 22 * u;
  }
  drawTracked(ctx, upper, pad, pad + 16 * u, tracking);
  return 0;
}

/**
 * Eyebrow-only header: the panels carry no big figure or delta chip (the
 * title carries the card, values live in the chart). Returns the y where
 * the chart area begins.
 */
export function drawCompareHeader(f: Frame, label: string): number {
  const shift = drawEyebrow(f, label);
  return 36 * f.u + 34 * f.u + shift;
}

/**
 * Standard header: eyebrow title only. The big animated figure and delta
 * chip were retired on user request — the title carries the card, and the
 * headline values live in the chart itself.
 * Returns the y where the chart area begins.
 */
export function drawHeader(f: Frame, label: string): number {
  return drawCompareHeader(f, label);
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
  // INK_SECONDARY, not MUTED: axis ticks are primary chart reading and the
  // muted gray falls below comfortable contrast on the dark surface.
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `400 ${15 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  // Surface-colored halo behind each tick: the labels sit inside the plot
  // area, so on dense/multi-series charts curves would otherwise run straight
  // through the text.
  ctx.strokeStyle = SURFACE;
  ctx.lineWidth = 5 * u;
  ctx.lineJoin = 'round';
  labels.forEach((label, i) => {
    const y = bottom - ((bottom - top) * i) / (labels.length - 1);
    ctx.strokeText(label, pad, y - 6 * u);
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
  // Shrink to fit: translated names plus emoji/flags can outgrow the panel,
  // and a legend running past the left padding would sit over the y-axis
  // labels. Each entry spans its text width plus 30u of dot + gaps; the last
  // (leftmost) one carries no trailing gap.
  const maxW = w - 72 * u;
  let size = 15;
  const rowWidth = () =>
    entries.reduce((acc, e) => acc + ctx.measureText(tr(e.name)).width + 30 * u, -18 * u);
  ctx.font = `500 ${size * u}px ${FONT}`;
  while (size > 11 && rowWidth() > maxW) {
    size -= 1;
    ctx.font = `500 ${size * u}px ${FONT}`;
  }
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
