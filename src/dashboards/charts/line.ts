// Line and area charts: a two-series line with draw-in and endpoint pulse,
// and a single-series gradient area.

import { t as tr } from '../../i18n';
import {
  drawCompareHeader,
  drawGrid,
  drawGridLabels,
  drawHeader,
  drawLegend,
  drawSurface,
  easeOut,
  linePath,
  makeSeries,
  type Frame,
} from '../draw';
import { FONT, INK_SECONDARY } from '../theme';
import { plotRect, withAlpha, xAxisLabels } from './shared';

/** A series whose label is a bare flag emoji (two regional-indicator glyphs). */
const isFlagName = (n: string): boolean => /^(?:\p{Regional_Indicator}){2}$/u.test(n);

// Fraction of the x-range over which a gated marker fades from invisible to
// solid, finishing exactly as the draw-in line reaches its position — short
// enough that the marker reads as "arriving with the line", not floating in
// independently. Anchoring full opacity at the crossing (rather than a window
// past it) guarantees every marker is solid once the line has fully drawn,
// including ones hugging the right edge.
const MARKER_REVEAL_FADE = 0.06;

/**
 * Vertical era markers (dashed line + label) shared by the area and line
 * charts. Each label rides at the height where its dashed line crosses the
 * data curve (`curveY`), with a dot pinned on the crossing itself — the event
 * reads against the value it changed instead of sitting detached on the
 * x-axis. Labels that would collide nudge vertically until free.
 *
 * On the mobile deck (`f.compact`) each marker holds back until the draw-in
 * line — at x-fraction `progress` — reaches its position, then fades in over
 * `MARKER_REVEAL_FADE`, so events appear as the curve arrives at them instead
 * of all at once. Collision layout is computed for every marker regardless of
 * reveal, so labels never shift as later ones fade in. Elsewhere (ring/hero,
 * or when `progress` is omitted) every marker draws solid.
 */
export function drawEraMarkers(
  f: Frame,
  r: { x0: number; x1: number; y0: number; y1: number },
  marks: { at: number; label: string }[],
  curveY: (frac: number) => number,
  progress?: number,
): void {
  if (!marks.length) return;
  const { ctx, u } = f;
  const gated = f.compact && progress !== undefined;
  ctx.font = `500 ${13 * u}px ${FONT}`;
  const gap = 6 * u;
  const halfH = 9 * u;
  // Pitch a nudged label steps by to clear an overlap: the label box plus a
  // little breathing room, so a cluster of markers (several reforms in one
  // decade) stacks with air between the rows instead of the lines touching.
  const vStep = 2 * halfH + 5 * u;
  const yMin = r.y0 + 16 * u;
  const yMax = r.y1 - 12 * u;
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  // The y-axis tick labels sit inside the plot at the left edge (drawGridLabels
  // draws them at x≈pad, the bottom "0" tick ending on the baseline). Reserve
  // that bottom-left cell so a marker whose curve bottoms out at the left — an
  // invention/reform at year 0 on a from-zero series — doesn't stack its label
  // on the "0" tick; the collision loop below then lifts it one row clear.
  const pad = 36 * u;
  placed.push({ x0: pad - 4 * u, x1: pad + 64 * u, y0: yMax - 6 * u, y1: r.y1 });
  for (const m of marks) {
    const label = tr(m.label);
    const frac = Math.min(1, Math.max(0, m.at));
    const mx = r.x0 + (r.x1 - r.x0) * frac;
    // Placement is resolved for every marker (even hidden ones) so the settled
    // layout is stable while markers reveal in sequence.
    const labelW = ctx.measureText(label).width;
    const rightFits = mx + gap + labelW <= r.x1;
    const lx = mx + (rightFits ? gap : -gap);
    const x0 = rightFits ? lx : lx - labelW;
    const x1 = rightFits ? lx + labelW : lx;
    const overlaps = (y: number) =>
      placed.some((s) => x0 < s.x1 + gap && x1 + gap > s.x0 && y - halfH < s.y1 && y + halfH > s.y0);
    let ly = Math.min(yMax, Math.max(yMin, curveY(frac)));
    while (overlaps(ly) && ly + vStep <= yMax) ly += vStep;
    while (overlaps(ly) && ly - vStep >= yMin) ly -= vStep;
    placed.push({ x0, x1, y0: ly - halfH, y1: ly + halfH });

    // Fade spans [frac - FADE, frac]: solid by the moment the line arrives.
    const reveal = gated
      ? Math.min(1, Math.max(0, ((progress as number) - frac) / MARKER_REVEAL_FADE + 1))
      : 1;
    if (reveal <= 0) continue;

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.strokeStyle = 'rgba(224,156,96,0.8)';
    ctx.lineWidth = 1.5 * u;
    ctx.setLineDash([5 * u, 4 * u]);
    ctx.beginPath();
    ctx.moveTo(mx, r.y0);
    ctx.lineTo(mx, r.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    // Leader from the crossing point to the label's inner edge, capped with a
    // dot on the dashed line so the attachment point is unambiguous.
    ctx.fillStyle = 'rgba(224,156,96,0.8)';
    ctx.beginPath();
    ctx.moveTo(mx, ly);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, ly, 2 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(236,182,132,0.9)';
    ctx.textAlign = rightFits ? 'left' : 'right';
    ctx.fillText(label, lx, ly + 4.5 * u);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

/**
 * Data x-range for a plot with era markers: inset from the plot edge on any
 * side where a marker sits at (or hugs) the range boundary, so the dashed
 * line gets breathing room instead of merging with the y-axis.
 */
export function markerInsetRange(
  r: { x0: number; x1: number },
  marks: { at: number }[],
  u: number,
): { x0: number; x1: number } {
  const inset = 18 * u;
  return {
    x0: r.x0 + (marks.some((m) => m.at <= 0.03) ? inset : 0),
    x1: r.x1 - (marks.some((m) => m.at >= 0.97) ? inset : 0),
  };
}

/** y-position of the (normalized 0..1) series at a fraction of the x-range,
    matching linePath's point spacing and vertical mapping. */
export function curveYFn(
  data: number[],
  yTop: number,
  yBottom: number,
): (frac: number) => number {
  return (frac) => {
    const pos = frac * (data.length - 1);
    const i = Math.floor(pos);
    const v = data[i] + (data[Math.min(i + 1, data.length - 1)] - data[i]) * (pos - i);
    return yBottom - (yBottom - yTop) * v;
  };
}

/**
 * Stroke a series that turns into a projection at `splitX`: solid up to the
 * split, dashed beyond it — measured data reads solid, forecast dashed. The
 * current path style (color, width) applies to both halves; returns the end
 * point so the caller can cap the line with an arrowhead.
 */
function strokeSplit(
  ctx: CanvasRenderingContext2D,
  data: number[],
  x0: number,
  x1: number,
  yTop: number,
  yBottom: number,
  p: number,
  splitX: number,
  u: number,
): { x: number; y: number } {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 8 * u, -1e5, splitX - x0 + 8 * u, 2e5);
  ctx.clip();
  linePath(ctx, data, x0, x1, yTop, yBottom, p);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, -1e5, x1 - splitX + 8 * u, 2e5);
  ctx.clip();
  ctx.setLineDash([6 * u, 5 * u]);
  const end = linePath(ctx, data, x0, x1, yTop, yBottom, p);
  ctx.stroke();
  ctx.restore();
  return end;
}

/**
 * Arrowhead on a projected line's endpoint, oriented along the last segment —
 * tip exactly on the data end, so it says "heading here" without overflowing
 * the plot.
 */
function arrowHead(
  ctx: CanvasRenderingContext2D,
  data: number[],
  x0: number,
  x1: number,
  yTop: number,
  yBottom: number,
  end: { x: number; y: number },
  u: number,
  color: string,
): void {
  const n = data.length;
  const px = x0 + ((x1 - x0) * (n - 2)) / (n - 1);
  const py = yBottom - (yBottom - yTop) * data[n - 2];
  const a = Math.atan2(end.y - py, end.x - px);
  const len = 11 * u;
  const half = 4.5 * u;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - Math.cos(a) * len + Math.cos(a + Math.PI / 2) * half,
    end.y - Math.sin(a) * len + Math.sin(a + Math.PI / 2) * half,
  );
  ctx.lineTo(
    end.x - Math.cos(a) * len + Math.cos(a - Math.PI / 2) * half,
    end.y - Math.sin(a) * len + Math.sin(a - Math.PI / 2) * half,
  );
  ctx.closePath();
  ctx.fill();
}

export interface LineCfg {
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  /** `data` (normalized 0..1) wins over the seeded fallback series. */
  series: { name: string; color: string; data?: number[] }[];
  ticks: string[];
  xLabels?: string[];
  /** Cool vertical bands over samples where mask[i] is true (e.g. ice ages). */
  shade?: { mask: boolean[]; label: string };
  /** Vertical era markers along the x-range (0..1), e.g. reforms/treaties. */
  markers?: { at: number; label: string }[];
  /** Projection start (0..1 of the x-range): the lines render solid up to
      here, dashed with an arrowhead beyond — forecast, not measurement. */
  projectFrom?: number;
  /** Horizontal reference line at a normalized y (0..1 of the value range),
      e.g. a human baseline the series are measured against. Dashed ink, not a
      series colour — it is context, never data. */
  refLine?: { at: number; label: string };
}

/** Two-series line chart with draw-in, endpoint pulse and direct labels. */
export function lineChart(f: Frame, cfg: LineCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const top = cfg.series.length > 1 ? drawCompareHeader(f, cfg.label) : drawHeader(f, cfg.label);
  // The legend gets its own row above the plot: the top tick label draws at
  // r.y0 - 6u, so a legend near r.y0 would collide with it once translated
  // names plus emoji make the row span most of the panel width.
  const r = plotRect(f, top + 48 * u);
  const marks = cfg.markers ?? [];
  const d = markerInsetRange(r, marks, u);

  // Shaded bands (behind grid + series): contiguous true-runs of the mask.
  if (cfg.shade) {
    const mask = cfg.shade.mask;
    const n = mask.length;
    let bandStartX = r.x0;
    let firstBand = true;
    ctx.fillStyle = 'rgba(96,156,224,0.13)';
    for (let i = 0; i < n; ) {
      if (!mask[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && mask[j]) j++;
      const x0 = d.x0 + ((d.x1 - d.x0) * (i - 0.5)) / (n - 1);
      const x1 = d.x0 + ((d.x1 - d.x0) * (j - 0.5)) / (n - 1);
      ctx.fillRect(x0, r.y0, x1 - x0, r.y1 - r.y0);
      if (firstBand) {
        bandStartX = x0;
        firstBand = false;
      }
      i = j;
    }
    // Anchor the label to the start of the actual band, not the plot edge, so
    // a band that only covers the right side (e.g. the smartphone era) is not
    // mislabeled over the years before it. Clamp so it never spills off-plot.
    ctx.fillStyle = 'rgba(150,190,235,0.85)';
    ctx.font = `500 ${13 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    const shadeLabel = tr(cfg.shade.label);
    const labelW = ctx.measureText(shadeLabel).width;
    const lx = Math.min(bandStartX + 6 * u, r.x1 - labelW - 6 * u);
    ctx.fillText(shadeLabel, Math.max(r.x0 + 6 * u, lx), r.y0 + 16 * u);
  }

  drawGrid(f, r.y0, r.y1, cfg.ticks.length);
  drawLegend(f, r.y0 - 30 * u, cfg.series);

  // Reference line (e.g. "human = 100 %"): dashed ink behind the series, its
  // label tucked above the left end so converging lines stay readable.
  if (cfg.refLine) {
    const ry = r.y1 - 6 * u - cfg.refLine.at * (r.y1 - 6 * u - (r.y0 + 14 * u));
    ctx.strokeStyle = withAlpha(INK_SECONDARY, 0.55);
    ctx.lineWidth = 1.5 * u;
    ctx.setLineDash([6 * u, 5 * u]);
    ctx.beginPath();
    ctx.moveTo(d.x0, ry);
    ctx.lineTo(d.x1, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = withAlpha(INK_SECONDARY, 0.85);
    ctx.font = `500 ${12 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(tr(cfg.refLine.label), d.x0 + 4 * u, ry - 6 * u);
  }

  const p = easeOut(t / 1.4);
  const datas = cfg.series.map(
    (s, si) => s.data ?? makeSeries(cfg.seed + si * 97, 14, si === 0 ? 0.6 : 0.25),
  );
  const yTop = r.y0 + 14 * u;
  const yBottom = r.y1 - 6 * u;
  const splitX =
    cfg.projectFrom !== undefined ? d.x0 + (d.x1 - d.x0) * cfg.projectFrom : undefined;
  const ends: { x: number; y: number }[] = [];
  cfg.series.forEach((s, si) => {
    const data = datas[si];
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5 * u;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let end: { x: number; y: number };
    if (splitX !== undefined) {
      // Projection: dashed beyond the split, arrow instead of endpoint dot —
      // the "now" anchor below marks where measurement ends.
      end = strokeSplit(ctx, data, d.x0, d.x1, yTop, yBottom, p, splitX, u);
      if (p >= 1) arrowHead(ctx, data, d.x0, d.x1, yTop, yBottom, end, u, s.color);
    } else {
      end = linePath(ctx, data, d.x0, d.x1, yTop, yBottom, p);
      ctx.stroke();
      // Endpoint marker on measured data.
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    // The front series gets a soft live pulse — on the endpoint, or on the
    // projection split ("today") once the draw-in has passed it.
    const anchor =
      splitX !== undefined && cfg.projectFrom !== undefined
        ? { x: splitX, y: curveYFn(data, yTop, yBottom)(cfg.projectFrom) }
        : end;
    if (splitX !== undefined && p >= (cfg.projectFrom ?? 0)) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 4.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    if (si === 0 && p >= 1) {
      const pulse = (t * 0.9) % 1;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = (1 - pulse) * 0.5;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, (5 + pulse * 14) * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ends.push(end);
  });
  // Direct endpoint labels for many-series flag charts: a top legend swatch
  // alone can't tell two lines apart where they converge (e.g. two countries
  // hugging a cash/press-freedom floor). When every series is labelled by a
  // flag, repeat the flag in the right margin at the line's end, de-collided
  // vertically, so each line stays identifiable there regardless of colour.
  if (splitX === undefined && cfg.series.length >= 3 && cfg.series.every((s) => isFlagName(s.name)) && p >= 1) {
    ctx.font = `${15 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lineH = 17 * u;
    const lx = r.x1 + 6 * u;
    const items = ends
      .map((e, i) => ({ y: e.y, name: cfg.series[i].name }))
      .toSorted((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < lineH) items[i].y = items[i - 1].y + lineH;
    }
    const overflow = items.length ? items[items.length - 1].y - (r.y1 - 2 * u) : 0;
    if (overflow > 0) for (const it of items) it.y -= overflow;
    for (const it of items) ctx.fillText(it.name, lx, it.y);
    ctx.textBaseline = 'alphabetic';
  }
  drawEraMarkers(f, { ...r, ...d }, marks, curveYFn(datas[0], yTop, yBottom), p);
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, cfg.xLabels ?? ['Q1', 'Q2', 'Q3', 'Q4'], d.x0, d.x1, r.y1);
}

export interface AreaCfg {
  label: string;
  value: number;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  color: string;
  ticks: string[];
  data?: number[];
  xLabels?: string[];
  /** Vertical event marker at `at` (0..1 of the x-range), e.g. an invention. */
  marker?: { at: number; label: string };
  /** Several era markers along the x-range; labels alternate rows so close
      ones do not overlap. */
  markers?: { at: number; label: string }[];
  /** Uncertainty band (normalized 0..1, same length as `data`), drawn as a
      translucent fill behind the line — e.g. a reconstruction's 90% range. */
  band?: { lo: number[]; hi: number[] };
  /** Projection start (0..1 of the x-range): the line renders solid up to
      here, dashed with an arrowhead beyond — forecast, not measurement. */
  projectFrom?: number;
}

/** Single-series area chart with a gradient fill sweeping in. */
export function areaChart(f: Frame, cfg: AreaCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const r = plotRect(f, top + 26 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);
  const marks = [...(cfg.marker ? [cfg.marker] : []), ...(cfg.markers ?? [])];
  const d = markerInsetRange(r, marks, u);

  const data = cfg.data ?? makeSeries(cfg.seed, 18, 0.7);
  const p = easeOut(t / 1.4);

  // Uncertainty band behind everything else, revealed with the draw-in.
  if (cfg.band) {
    const { lo, hi } = cfg.band;
    const n = lo.length;
    const yTop = r.y0 + 14 * u;
    const yBottom = r.y1 - 6 * u;
    const bx = (i: number) => d.x0 + ((d.x1 - d.x0) * i) / (n - 1);
    const by = (v: number) => yBottom - (yBottom - yTop) * v;
    ctx.save();
    ctx.beginPath();
    ctx.rect(d.x0, r.y0, (d.x1 - d.x0) * p, r.y1 - r.y0);
    ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(bx(i), by(hi[i]));
      else ctx.lineTo(bx(i), by(hi[i]));
    }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(bx(i), by(lo[i]));
    ctx.closePath();
    ctx.fillStyle = withAlpha(cfg.color, 0.16);
    ctx.fill();
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  grad.addColorStop(0, `${cfg.color}59`);
  grad.addColorStop(1, `${cfg.color}00`);

  const end = linePath(ctx, data, d.x0, d.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.save();
  ctx.lineTo(end.x, r.y1);
  ctx.lineTo(d.x0, r.y1);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2.5 * u;
  ctx.lineJoin = 'round';
  if (cfg.projectFrom !== undefined) {
    // Projection: dashed beyond the split with an arrowhead; a dot anchors
    // the last measured value ("today") instead of the forecast endpoint.
    const splitX = d.x0 + (d.x1 - d.x0) * cfg.projectFrom;
    const pEnd = strokeSplit(ctx, data, d.x0, d.x1, r.y0 + 14 * u, r.y1 - 6 * u, p, splitX, u);
    if (p >= 1) arrowHead(ctx, data, d.x0, d.x1, r.y0 + 14 * u, r.y1 - 6 * u, pEnd, u, cfg.color);
    if (p >= cfg.projectFrom) {
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(splitX, curveYFn(data, r.y0 + 14 * u, r.y1 - 6 * u)(cfg.projectFrom), 4.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    linePath(ctx, data, d.x0, d.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
    ctx.stroke();
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vertical era markers (dashed line + label), drawn on top of the curve.
  drawEraMarkers(f, { ...r, ...d }, marks, curveYFn(data, r.y0 + 14 * u, r.y1 - 6 * u), p);

  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, cfg.xLabels ?? ['Mon', 'Wed', 'Fri', 'Sun'], d.x0, d.x1, r.y1);
}
