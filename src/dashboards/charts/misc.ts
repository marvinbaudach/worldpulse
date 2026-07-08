// The remaining bespoke renderers: the wealth-inequality split, the Gantt-style
// conflict timeline, the running debt clock, the weekly weather forecast and
// the strip treemap.

import { t as tr } from '../../i18n';
import {
  drawGrid,
  drawGridLabels,
  drawHeader,
  drawSurface,
  drawTracked,
  easeOut,
  fmtCompact,
  linePath,
  roundRect,
  stagger,
  type Frame,
} from '../draw';
import {
  BASELINE,
  CRITICAL,
  FONT,
  GOOD,
  GRID,
  INK,
  INK_SECONDARY,
  MUTED,
  SEQ,
  SERIES,
} from '../theme';
import { drawSource, plotRect, xAxisLabels } from './shared';
import { drawEraMarkers } from './line';

export interface WealthSplitCfg {
  label: string;
  value: number;
  fmt: (v: number) => string;
  /** Caption above the population bar / below the wealth bar. */
  axisTop: string;
  axisBottom: string;
  /** Population share vs wealth share per group, both in % of the total. */
  groups: { name: string; pop: number; wealth: number; color: string }[];
  source: string;
}

/**
 * Inequality split: one 100% bar for people, one for wealth, with a band
 * connecting each group's share of both — a thin populace sliver ballooning
 * into half the wealth bar is the whole story at a glance.
 */
export function wealthSplit(f: Frame, cfg: WealthSplitCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt, null);
  const pad = 36 * u;
  const x0 = pad;
  const x1 = w - pad;
  const W = x1 - x0;
  const bh = 26 * u;
  const yPop = top + 46 * u;
  const yWealth = yPop + 170 * u;
  const gap = 1.5 * u;

  ctx.font = `600 ${13 * u}px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(tr(cfg.axisTop).toUpperCase(), x0, yPop - 12 * u);
  ctx.fillText(tr(cfg.axisBottom).toUpperCase(), x0, yWealth + bh + 26 * u);

  let px = x0;
  let wx = x0;
  cfg.groups.forEach((g, i) => {
    const gp = stagger(t, i, 0.15);
    const pw = (W * g.pop) / 100;
    const ww = (W * g.wealth) / 100;
    ctx.globalAlpha = Math.max(0, gp);

    // Connecting band: the group's population share flowing into its
    // wealth share.
    ctx.fillStyle = g.color;
    ctx.globalAlpha = Math.max(0, gp) * 0.22;
    ctx.beginPath();
    ctx.moveTo(px + gap, yPop + bh);
    ctx.lineTo(px + pw - gap, yPop + bh);
    ctx.lineTo(wx + ww - gap, yWealth);
    ctx.lineTo(wx + gap, yWealth);
    ctx.closePath();
    ctx.fill();

    // The two bar segments.
    ctx.globalAlpha = Math.max(0, gp);
    roundRect(ctx, px + gap, yPop, Math.max(pw - 2 * gap, 2 * u), bh, 3 * u);
    ctx.fill();
    roundRect(ctx, wx + gap, yWealth, Math.max(ww - 2 * gap, 2 * u), bh, 3 * u);
    ctx.fill();

    // Percent inside every segment wide enough to hold it.
    ctx.fillStyle = INK;
    ctx.font = `600 ${12 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    if (pw > 44 * u) ctx.fillText(`${g.pop} %`, px + pw / 2, yPop + bh / 2 + 4 * u);
    if (ww > 44 * u) ctx.fillText(`${g.wealth} %`, wx + ww / 2, yWealth + bh / 2 + 4 * u);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    px += pw;
    wx += ww;
  });

  // Legend: group name left, its wealth share right.
  const ly0 = yWealth + bh + 62 * u;
  const rowH = 30 * u;
  cfg.groups.forEach((g, i) => {
    const gp = stagger(t, i + 4, 0.08);
    const y = ly0 + rowH * i;
    ctx.globalAlpha = Math.max(0, gp);
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(x0 + 5 * u, y - 5 * u, 5 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.fillText(tr(g.name), x0 + 18 * u, y);
    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${g.wealth} %`, x1, y);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  });

  drawSource(f, cfg.source);
}

export interface TimelineCfg {
  label: string;
  value: number;
  fmt?: (v: number) => string;
  color: string;
  yearStart: number;
  yearEnd: number;
  /** Chronological events; omit `to` for coups / point interventions. */
  events: { name: string; from: number; to?: number; deaths: number }[];
  source: string;
}

/**
 * Gantt-style timeline: each event spans its years on a shared axis, one
 * lane per event. Bar weight scales with the death toll on a log ramp, so
 * a 300-victim coup stays visible next to a three-million-victim war.
 */
export function timelineChart(f: Frame, cfg: TimelineCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt ?? ((v) => fmtCompact(v)), null);
  const pad = 36 * u;
  const x0 = pad;
  const x1 = w - pad;
  const y0 = top + 14 * u;
  const y1 = h - 64 * u;
  const px = (year: number) =>
    x0 + ((year - cfg.yearStart) / (cfg.yearEnd - cfg.yearStart)) * (x1 - x0);

  // Decade grid, labeled along the baseline.
  ctx.lineWidth = 1 * u;
  ctx.font = `400 ${14 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  for (let yr = Math.ceil(cfg.yearStart / 10) * 10; yr <= cfg.yearEnd; yr += 10) {
    const x = px(yr);
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(`${yr}`, x, y1 + 24 * u);
  }
  ctx.textAlign = 'left';
  ctx.strokeStyle = BASELINE;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  const maxLog = Math.log10(Math.max(...cfg.events.map((e) => e.deaths)));
  const weight = (d: number) =>
    Math.min(1, Math.max(0.1, (Math.log10(d) - 2) / (maxLog - 2)));

  const laneH = (y1 - y0) / cfg.events.length;
  cfg.events.forEach((e, i) => {
    const p = stagger(t, i, 0.06);
    if (p <= 0) return;
    const cy = y0 + laneH * (i + 0.68);
    const bh = (5 + 13 * weight(e.deaths)) * u;
    const bx0 = px(e.from);
    const full = Math.max(px(e.to ?? e.from + 1) - bx0, bh);
    ctx.globalAlpha = Math.min(1, p * 2);
    ctx.fillStyle = cfg.color;
    roundRect(ctx, bx0, cy - bh / 2, Math.max(full * p, bh), bh, bh / 2);
    ctx.fill();

    // Name + toll next to the bar: right of it when there is room,
    // otherwise flipped to the left (events near the axis end).
    const dead = fmtCompact(e.deaths);
    ctx.font = `500 ${15 * u}px ${FONT}`;
    const eName = tr(e.name);
    const nameW = ctx.measureText(`${eName}  `).width;
    ctx.font = `600 ${15 * u}px ${FONT}`;
    const deadW = ctx.measureText(dead).width;
    const bx1 = bx0 + full;
    const tx = bx1 + 10 * u + nameW + deadW > x1 ? bx0 - nameW - deadW - 10 * u : bx1 + 10 * u;
    const ty = cy + 5 * u;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${15 * u}px ${FONT}`;
    ctx.fillText(eName, tx, ty);
    ctx.fillStyle = INK;
    ctx.font = `600 ${15 * u}px ${FONT}`;
    ctx.fillText(dead, tx + nameW, ty);
    ctx.globalAlpha = 1;
  });

  drawSource(f, cfg.source);
}

export interface DebtClockCfg {
  label: string;
  /** Latest official total, its record time and the recent growth rate. */
  latest: number;
  latestMs: number;
  ratePerMs: number;
  yoyPct: number;
  /** Monthly totals (normalized) for the trend area below the clock. */
  series: number[];
  ticks: string[];
  color: string;
  isLive: boolean;
  /** Vertical era markers along the x-range (0..1), e.g. crises. */
  markers?: { at: number; label: string }[];
}

/**
 * Debt clock: a wall-clock-extrapolated running total counting up between
 * official daily records, with the 12-month trend as an area chart below.
 */
export function debtClock(f: Frame, cfg: DebtClockCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const pad = 36 * u;
  const p = easeOut(t / 0.9);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${17 * u}px ${FONT}`;
  drawTracked(ctx, tr(cfg.label).toUpperCase(), pad, pad + 16 * u, 2.4 * u);

  // The running figure, auto-fitted so all 17 digits stay inside the panel.
  const now = cfg.latest + Math.max(0, Date.now() - cfg.latestMs) * cfg.ratePerMs;
  const text = `$${Math.round(now * p).toLocaleString('en-US')}`;
  let size = 44 * u;
  ctx.font = `700 ${size}px ${FONT}`;
  const maxW = w - 2 * pad;
  const tw = ctx.measureText(text).width;
  if (tw > maxW) {
    size *= maxW / tw;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.fillStyle = INK;
  ctx.fillText(text, pad, pad + 74 * u);

  // Rising debt is the alarming direction: the YoY chip stays critical-red.
  const chipText = `▲ ${cfg.yoyPct.toFixed(1)}% YoY`;
  ctx.font = `600 ${19 * u}px ${FONT}`;
  const cw = ctx.measureText(chipText).width;
  const cy = pad + 106 * u;
  ctx.fillStyle = 'rgba(208,59,59,0.14)';
  roundRect(ctx, pad - 6 * u, cy - 20 * u, cw + 20 * u, 30 * u, 15 * u);
  ctx.fill();
  ctx.fillStyle = CRITICAL;
  ctx.fillText(chipText, pad + 4 * u, cy + 2 * u);

  const perSec = cfg.ratePerMs * 1000;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${17 * u}px ${FONT}`;
  ctx.fillText(
    `${perSec >= 0 ? '+' : '−'}$${Math.abs(Math.round(perSec)).toLocaleString('de-CH')} / ${tr('Sekunde')}`,
    pad + cw + 32 * u,
    cy + 2 * u,
  );

  // Live pulse dot, matching the ticker panels' vocabulary.
  ctx.fillStyle = cfg.isLive ? GOOD : MUTED;
  ctx.beginPath();
  ctx.arc(w - pad - 44 * u, pad + 10 * u, 4.5 * u * (0.8 + 0.2 * Math.sin(t * 4)), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `600 ${15 * u}px ${FONT}`;
  ctx.fillText(cfg.isLive ? 'LIVE' : 'SYNC', w - pad - 32 * u, pad + 15 * u);

  // 125-year trend as a gradient area: flat for decades, then the wall.
  const r = plotRect(f, pad + 158 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);
  const grad = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  grad.addColorStop(0, `${cfg.color}59`);
  grad.addColorStop(1, `${cfg.color}00`);
  const end = linePath(ctx, cfg.series, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.save();
  ctx.lineTo(end.x, r.y1);
  ctx.lineTo(r.x0, r.y1);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2.5 * u;
  ctx.lineJoin = 'round';
  linePath(ctx, cfg.series, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.stroke();
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
  ctx.fill();
  drawEraMarkers(f, r, cfg.markers ?? []);
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, ['1900', '1940', '1980', 'heute'], r.x0, r.x1, r.y1);
}

export interface ForecastCfg {
  label: string;
  current: number;
  /** Seven days, today first, with WMO weather codes. */
  days: { day: string; code: number; min: number; max: number }[];
}

type IconKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'thunder';

function iconFor(code: number): IconKind {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'rain';
}

/** Small hand-drawn weather glyphs in the charts' color vocabulary. */
function drawWeatherIcon(
  ctx: CanvasRenderingContext2D,
  kind: IconKind,
  cx: number,
  cy: number,
  s: number,
): void {
  const [, , yellow] = SERIES;
  const sun = (x: number, y: number, r: number) => {
    ctx.strokeStyle = yellow;
    ctx.fillStyle = yellow;
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
      ctx.lineTo(x + Math.cos(a) * r * 1.95, y + Math.sin(a) * r * 1.95);
      ctx.stroke();
    }
  };
  const cloud = (x: number, y: number, k: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 0.42 * k, y + 0.1 * k, 0.34 * k, Math.PI * 0.4, Math.PI * 1.6);
    ctx.arc(x - 0.06 * k, y - 0.22 * k, 0.42 * k, Math.PI * 0.9, Math.PI * 1.98);
    ctx.arc(x + 0.44 * k, y + 0.06 * k, 0.36 * k, Math.PI * 1.3, Math.PI * 0.55);
    ctx.closePath();
    ctx.fill();
  };

  switch (kind) {
    case 'sun':
      sun(cx, cy, s * 0.52);
      break;
    case 'partly':
      sun(cx + s * 0.34, cy - s * 0.34, s * 0.36);
      cloud(cx - s * 0.08, cy + s * 0.18, s * 0.96, 'rgba(214,222,236,0.92)');
      break;
    case 'cloud':
      cloud(cx, cy, s * 1.06, 'rgba(214,222,236,0.92)');
      break;
    case 'fog':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.65)');
      ctx.strokeStyle = 'rgba(214,222,236,0.8)';
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5 + i * s * 0.12, cy + s * 0.34 + i * s * 0.26);
        ctx.lineTo(cx + s * 0.5 - i * s * 0.12, cy + s * 0.34 + i * s * 0.26);
        ctx.stroke();
      }
      break;
    case 'rain':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.strokeStyle = SERIES[1];
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * s * 0.34 + s * 0.06, cy + s * 0.3);
        ctx.lineTo(cx + i * s * 0.34 - s * 0.08, cy + s * 0.62);
        ctx.stroke();
      }
      break;
    case 'snow':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.fillStyle = '#eef3fb';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(cx + i * s * 0.34, cy + s * 0.46 + Math.abs(i) * s * 0.08, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'thunder':
      cloud(cx, cy - s * 0.26, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.fillStyle = yellow;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.1, cy - s * 0.05);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.38);
      ctx.lineTo(cx - s * 0.02, cy + s * 0.38);
      ctx.lineTo(cx - s * 0.14, cy + s * 0.72);
      ctx.lineTo(cx + s * 0.26, cy + s * 0.24);
      ctx.lineTo(cx + s * 0.04, cy + s * 0.24);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/**
 * 7-day forecast: one row per day with a weather glyph and the min–max span
 * drawn as a bar on a scale shared across the week (iOS-weather style).
 */
export function weatherForecast(f: Frame, cfg: ForecastCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.current, (v) => `${v.toFixed(1)}°C`, null);
  const pad = 36 * u;

  const lo = Math.min(...cfg.days.map((d) => d.min));
  const hi = Math.max(...cfg.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);

  const rowH = (h - 50 * u - top) / cfg.days.length;
  // Columns: day label | icon | min° | range bar | max°
  const barX0 = pad + 172 * u;
  const barX1 = w - pad - 44 * u;

  cfg.days.forEach((d, i) => {
    const p = stagger(t, i, 0.07);
    if (p <= 0) return;
    const y = top + rowH * i + rowH / 2;
    ctx.globalAlpha = p;

    ctx.fillStyle = i === 0 ? INK : INK_SECONDARY;
    ctx.font = `${i === 0 ? 600 : 500} ${17 * u}px ${FONT}`;
    ctx.fillText(tr(d.day), pad, y + 6 * u);

    drawWeatherIcon(ctx, iconFor(d.code), pad + 92 * u, y, 17 * u);

    ctx.fillStyle = MUTED;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(d.min)}°`, barX0 - 10 * u, y + 6 * u);
    ctx.textAlign = 'left';

    // Track plus the day's min–max span, growing with the stagger.
    ctx.fillStyle = GRID;
    roundRect(ctx, barX0, y - 4 * u, barX1 - barX0, 8 * u, 4 * u);
    ctx.fill();
    const x0 = barX0 + (barX1 - barX0) * ((d.min - lo) / span);
    const x1 = barX0 + (barX1 - barX0) * ((d.max - lo) / span);
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, SERIES[0]);
    grad.addColorStop(1, SERIES[2]);
    ctx.fillStyle = grad;
    roundRect(ctx, x0, y - 4 * u, Math.max((x1 - x0) * p, 8 * u), 8 * u, 4 * u);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.fillText(`${Math.round(d.max)}°`, barX1 + 10 * u, y + 6 * u);
    ctx.globalAlpha = 1;
  });
}

export interface TreemapCfg {
  label: string;
  value: number;
  fmt: (v: number) => string;
  /** Block areas; `muted` renders as a neutral filler (e.g. "Rest of world");
      `short` (e.g. a flag) labels blocks too narrow for the full name. */
  rows: { name: string; v: number; muted?: boolean; short?: string }[];
}

/**
 * Strip treemap — shares of a whole as nested rectangles. Reads far better
 * than a pie once there are ~10 slices: areas line up for comparison and
 * every block is large enough to be labeled directly.
 */
export function treemap(f: Frame, cfg: TreemapCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt, null);

  const pad = 36 * u;
  const x0 = pad;
  const y0 = top + 6 * u;
  const W = w - 2 * pad;
  const H = h - 40 * u - y0;
  const rows = [...cfg.rows].toSorted((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0);
  // Color rank over the non-muted blocks only, brightest = largest.
  let colorRank = 0;

  // Strip layout: horizontal strips top to bottom, each strip taking items
  // while the worst block aspect ratio keeps improving.
  let y = y0;
  let i = 0;
  let blockIndex = 0;
  while (i < rows.length) {
    let len = 1;
    let bestScore = Infinity;
    for (let tryLen = 1; tryLen <= rows.length - i; tryLen++) {
      const slice = rows.slice(i, i + tryLen);
      const sum = slice.reduce((s, r) => s + r.v, 0);
      const sh = (sum / total) * H;
      const worst = Math.max(
        ...slice.map((r) => {
          const bw = (r.v / sum) * W;
          return Math.max(bw / sh, sh / bw);
        }),
      );
      if (worst < bestScore) {
        bestScore = worst;
        len = tryLen;
      } else break;
    }

    const slice = rows.slice(i, i + len);
    const sum = slice.reduce((s, r) => s + r.v, 0);
    const sh = (sum / total) * H;
    let x = x0;
    for (const r of slice) {
      const bw = (r.v / sum) * W;
      const p = stagger(t, blockIndex, 0.06);
      const gap = 3 * u;

      ctx.globalAlpha = p;
      ctx.fillStyle = r.muted
        ? GRID
        : SEQ[Math.max(0, SEQ.length - 1 - colorRank)];
      roundRect(ctx, x + gap / 2, y + gap / 2, bw - gap, sh - gap, 4 * u);
      ctx.fill();

      // Direct labels once the block is big enough to hold them; narrower
      // blocks fall back to the short label (flag) plus the share, so no
      // block above a sliver stays anonymous.
      const pct = `${((r.v / total) * 100).toFixed(1)}%`;
      if (bw > 78 * u && sh > 44 * u) {
        ctx.fillStyle = r.muted ? INK_SECONDARY : INK;
        ctx.font = `500 ${13 * u}px ${FONT}`;
        ctx.fillText(tr(r.name), x + 10 * u, y + 22 * u, bw - 20 * u);
        ctx.font = `700 ${16 * u}px ${FONT}`;
        ctx.fillText(pct, x + 10 * u, y + 42 * u, bw - 20 * u);
      } else if (bw > 30 * u && sh > 40 * u) {
        ctx.fillStyle = r.muted ? INK_SECONDARY : INK;
        ctx.font = `500 ${12 * u}px ${FONT}`;
        ctx.fillText(tr(r.short ?? r.name), x + 7 * u, y + 19 * u, bw - 14 * u);
        ctx.font = `700 ${12 * u}px ${FONT}`;
        ctx.fillText(pct, x + 7 * u, y + 36 * u, bw - 14 * u);
      }
      ctx.globalAlpha = 1;

      if (!r.muted) colorRank++;
      x += bw;
      blockIndex++;
    }
    y += sh;
    i += len;
  }
}
