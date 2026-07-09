// Vertical and horizontal bar charts, both sharing the magnitude ramp so a
// bar's length and its color both encode the value.

import { t as tr } from '../../i18n';
import {
  drawGrid,
  drawGridLabels,
  drawHeader,
  drawSurface,
  fmtCompact,
  makeSeries,
  roundRect,
  stagger,
  type Frame,
} from '../draw';
import { FONT, GRID, INK, INK_SECONDARY } from '../theme';
import { MONTHS, barGradient, ellipsize, lighten, plotRect, withAlpha, withFlag } from './shared';

export interface BarCfg {
  label: string;
  value: number;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  color: string;
  ticks: string[];
  data?: number[];
  labels?: string[];
  /** Raw value of the tallest bar, for its direct label. */
  peak?: number;
}

/** Monthly vertical bars growing from the baseline, max bar direct-labeled. */
export function barChart(f: Frame, cfg: BarCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const r = plotRect(f, top + 26 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);

  const data = cfg.data ?? makeSeries(cfg.seed, 12, 0.5);
  const labels = cfg.labels ?? MONTHS;
  const maxI = data.indexOf(Math.max(...data));
  const slot = (r.x1 - r.x0) / data.length;
  const bw = slot - 2 * u - 6 * u;
  // Same ramp as the horizontal bars, running up from the baseline: muted at
  // the bottom, full color partway up, brightened at the top so the tallest
  // columns end on the hottest tone.
  const grad = ctx.createLinearGradient(0, r.y1, 0, r.y0 + 20 * u);
  grad.addColorStop(0, withAlpha(cfg.color, 0.32));
  grad.addColorStop(0.5, cfg.color);
  grad.addColorStop(1, lighten(cfg.color, 0.5));
  data.forEach((v, i) => {
    const p = stagger(t, i, 0.045);
    const bh = (r.y1 - r.y0 - 20 * u) * v * p;
    const x = r.x0 + slot * i + (slot - bw) / 2;
    ctx.fillStyle = grad;
    roundRect(ctx, x, r.y1 - bh, bw, bh, 4 * u);
    ctx.fill();
    if (i === maxI && p >= 1) {
      ctx.fillStyle = INK;
      ctx.font = `600 ${14 * u}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(fmtCompact(cfg.peak ?? cfg.value * v), x + bw / 2, r.y1 - bh - 8 * u);
      ctx.textAlign = 'left';
    }
    // Axis text uses INK_SECONDARY, not MUTED — muted gray sits below
    // comfortable reading contrast on the dark surface.
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `400 ${13 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(tr(labels[i] ?? ''), x + bw / 2, r.y1 + 22 * u);
    ctx.textAlign = 'left';
  });
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
}

export interface HBarCfg {
  label: string;
  value: number;
  delta: number | null;
  color: string;
  unit?: string;
  /** Headline formatter; falls back to compact notation with `unit`. */
  fmt?: (v: number) => string;
  /** Per-row value formatter (e.g. percentages); same fallback. */
  rowFmt?: (v: number) => string;
  rows: { name: string; v: number }[];
}

/** Horizontal top-N bars sliding in, every row direct-labeled. */
export function hBarChart(f: Frame, cfg: HBarCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const unit = cfg.unit ?? '€';
  const rowFmt = cfg.rowFmt ?? ((v: number) => fmtCompact(v, unit));
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;
  const rowH = (f.h - 60 * u - (top + 10 * u)) / cfg.rows.length;
  const max = Math.max(...cfg.rows.map((d) => d.v));
  const grad = barGradient(ctx, pad, w - pad, cfg.color);

  // Tight rows (long lists on the short mobile cards): the label-above-bar
  // group would collide with its neighbors, so the row collapses into one
  // thick bar carrying its own name and value — every row stays readable
  // instead of everything squeezing together.
  if (rowH < 32 * u) {
    const barH = Math.min(22 * u, rowH - 5 * u);
    cfg.rows.forEach((d, i) => {
      const p = stagger(t, i, 0.08);
      const y = top + 10 * u + rowH * i + (rowH - barH) / 2;
      const bw = (w - 2 * pad) * (d.v / max) * p;
      ctx.fillStyle = GRID;
      roundRect(ctx, pad, y, w - 2 * pad, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = grad;
      roundRect(ctx, pad, y, Math.max(bw, barH), barH, barH / 2);
      ctx.fill();
      // Text rides on the bar; a soft shadow keeps it legible over the
      // bright end of the magnitude ramp.
      const ty = y + barH / 2 + 5 * u;
      const valueStr = rowFmt(d.v * p);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 3 * u;
      ctx.fillStyle = INK;
      ctx.font = `600 ${13.5 * u}px ${FONT}`;
      // Label and value share this font, so measuring the value here also
      // tells us how much room the label has before it would collide with it.
      const labelX = pad + 9 * u;
      const labelMax = w - pad - 9 * u - ctx.measureText(valueStr).width - 10 * u - labelX;
      ctx.fillText(ellipsize(ctx, withFlag(d.name), labelMax), labelX, ty);
      ctx.textAlign = 'right';
      ctx.fillText(valueStr, w - pad - 9 * u, ty);
      ctx.textAlign = 'left';
      ctx.restore();
    });
    return;
  }

  // Label sits right above its bar (small fixed gap); the pair forms one
  // ~30u group centered in the row slot, so all the slack of tall rows
  // pools between the groups — the label reads as tied to its own bar, not
  // drifting toward the row above.
  const groupH = 30 * u;
  cfg.rows.forEach((d, i) => {
    const p = stagger(t, i, 0.08);
    const y = top + 10 * u + rowH * i + Math.max(0, (rowH - groupH) / 2);
    const valueStr = rowFmt(d.v * p);
    // Measure the value in its own weight, then cap the label so it can't run
    // under the right-aligned value on a narrow panel.
    ctx.font = `600 ${17 * u}px ${FONT}`;
    const labelMax = w - pad - ctx.measureText(valueStr).width - 12 * u - pad;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${17 * u}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, withFlag(d.name), labelMax), pad, y + 14 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${17 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(valueStr, w - pad, y + 14 * u);
    ctx.textAlign = 'left';

    const bw = (w - 2 * pad) * (d.v / max) * p;
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 20 * u, w - 2 * pad, 10 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = grad;
    roundRect(ctx, pad, y + 20 * u, Math.max(bw, 10 * u), 10 * u, 5 * u);
    ctx.fill();
  });
}
