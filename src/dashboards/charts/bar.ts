// Vertical and horizontal bar charts, both sharing the magnitude ramp so a
// bar's length and its color both encode the value.

import { t as tr } from '../../i18n';
import {
  drawGrid,
  drawGridLabels,
  drawHeader,
  drawSurface,
  easeOut,
  fmtCompact,
  makeSeries,
  roundRect,
  stagger,
  type Frame,
} from '../draw';
import { BASELINE, FONT, GRID, INK, INK_SECONDARY, MUTED } from '../theme';
import { MONTHS, barGradient, drawSource, ellipsize, lighten, plotRect, withAlpha, withFlag } from './shared';

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
  /** `sub` is a small pre-translated annotation after the name (e.g. a
      per-area density) — compose it with `tr()` in the card. */
  rows: { name: string; v: number; sub?: string }[];
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
      // No room for a second line here — the annotation joins the label and
      // shares its ellipsis budget.
      const label = d.sub ? `${withFlag(d.name)} · ${d.sub}` : withFlag(d.name);
      ctx.fillText(ellipsize(ctx, label, labelMax), labelX, ty);
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
    const nameStr = ellipsize(ctx, withFlag(d.name), labelMax);
    ctx.fillText(nameStr, pad, y + 14 * u);
    // Secondary annotation trails the name, smaller and muted so the row
    // still reads name → value first; it yields (ellipsizes to nothing)
    // before ever pushing into the right-aligned value.
    if (d.sub) {
      const subX = pad + ctx.measureText(nameStr).width + 8 * u;
      ctx.fillStyle = MUTED;
      ctx.font = `500 ${13 * u}px ${FONT}`;
      const subMax = pad + labelMax - subX;
      if (subMax > 24 * u) ctx.fillText(ellipsize(ctx, d.sub, subMax), subX, y + 14 * u);
    }
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

// ---------------------------------------------------------------------------
// Opposed-losses chart: two sides mirrored across a central axis, each with a
// solid "documented floor" bar and a fainter "estimate" ghost extending past
// it — so the reader sees the hard lower bound and the uncertainty in one
// mark. Neutral context rows (civilians, an earlier phase) sit full-width
// below. Built for the Ukraine death-toll card; the point is the honesty of
// floor-vs-estimate, not a single fake total.

export interface WarLossesCfg {
  label: string;
  /** Small caption under the header, e.g. "Soldaten · belegt / Schätzung". */
  caption: string;
  left: { name: string; doc: number; est: number; color: string };
  right: { name: string; doc: number; est: number; color: string };
  /** Full-width neutral context rows below the opposed bars. */
  rows: { name: string; v: number }[];
  fmt: (v: number) => string;
  /** [documented-label, estimate-label] for the legend. */
  legend: [string, string];
  source: string;
}

export function warLosses(f: Frame, cfg: WarLossesCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;
  const cx = w / 2;
  const reveal = easeOut(t / 1.1);

  const footerReserve = 74 * u;
  const zone = h - top - footerReserve;

  ctx.fillStyle = MUTED;
  ctx.font = `700 ${13 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(withFlag(cfg.caption).toUpperCase(), cx, top + 22 * u);

  // Opposed soldier bars, sat in the upper part of the panel.
  const barH = 62 * u;
  const yc = top + zone * 0.3;
  ctx.font = `600 ${17 * u}px ${FONT}`;
  ctx.fillStyle = INK_SECONDARY;
  ctx.textAlign = 'right';
  ctx.fillText(withFlag(cfg.left.name), cx - 14 * u, yc - barH / 2 - 16 * u);
  ctx.textAlign = 'left';
  ctx.fillText(withFlag(cfg.right.name), cx + 14 * u, yc - barH / 2 - 16 * u);

  const maxV = Math.max(cfg.left.est, cfg.right.est, 1);
  const scale = ((cx - pad - 76 * u) / maxV) * reveal;

  const side = (s: WarLossesCfg['left'], dir: -1 | 1) => {
    const estLen = s.est * scale;
    const docLen = s.doc * scale;
    const gx = dir < 0 ? cx - estLen : cx;
    const dx = dir < 0 ? cx - docLen : cx;
    // Estimate ghost with a faint outline, so the band beyond the documented
    // floor reads as its own "up to" range.
    ctx.fillStyle = withAlpha(s.color, 0.22);
    roundRect(ctx, gx, yc - barH / 2, estLen, barH, 7 * u);
    ctx.fill();
    ctx.strokeStyle = withAlpha(s.color, 0.5);
    ctx.lineWidth = 1 * u;
    roundRect(ctx, gx, yc - barH / 2, estLen, barH, 7 * u);
    ctx.stroke();
    // Documented floor, solid, on top.
    ctx.fillStyle = s.color;
    roundRect(ctx, dx, yc - barH / 2, docLen, barH, 7 * u);
    ctx.fill();
    // Documented (bold) over estimate (muted) at the outer end.
    const ox = dir < 0 ? cx - estLen - 14 * u : cx + estLen + 14 * u;
    ctx.textAlign = dir < 0 ? 'right' : 'left';
    ctx.fillStyle = INK;
    ctx.font = `800 ${30 * u}px ${FONT}`;
    ctx.fillText(cfg.fmt(s.doc), ox, yc + 2 * u);
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.fillText(cfg.fmt(s.est), ox, yc + 24 * u);
  };
  side(cfg.left, -1);
  side(cfg.right, 1);

  ctx.strokeStyle = BASELINE;
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(cx, yc - barH / 2 - 10 * u);
  ctx.lineTo(cx, yc + barH / 2 + 10 * u);
  ctx.stroke();

  // Neutral full-width context rows, filling the lower half.
  const divY = top + zone * 0.47;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1 * u;
  ctx.beginPath();
  ctx.moveTo(pad, divY);
  ctx.lineTo(w - pad, divY);
  ctx.stroke();
  const rowMax = Math.max(...cfg.rows.map((r) => r.v), 1);
  const rowsTop = divY + 34 * u;
  const rowH = (h - footerReserve - rowsTop) / Math.max(1, cfg.rows.length);
  cfg.rows.forEach((r, i) => {
    const y = rowsTop + i * rowH + rowH * 0.36;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${17 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(withFlag(r.name), pad, y);
    ctx.fillStyle = INK;
    ctx.font = `700 ${19 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(cfg.fmt(r.v), w - pad, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 14 * u, w - 2 * pad, 7 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = withAlpha(INK_SECONDARY, 0.45);
    roundRect(ctx, pad, y + 14 * u, Math.max((w - 2 * pad) * (r.v / rowMax) * reveal, 7 * u), 7 * u, 3.5 * u);
    ctx.fill();
  });

  // Legend: solid = documented floor, ghost = estimate.
  const ly = h - 46 * u;
  ctx.font = `500 ${12.5 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  let lx = pad;
  const swatch = (label: string, ghost: boolean) => {
    ctx.fillStyle = ghost ? withAlpha(INK_SECONDARY, 0.3) : INK_SECONDARY;
    roundRect(ctx, lx, ly - 9 * u, 16 * u, 11 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.fillText(tr(label), lx + 22 * u, ly);
    lx += 22 * u + ctx.measureText(tr(label)).width + 24 * u;
  };
  swatch(cfg.legend[0], false);
  swatch(cfg.legend[1], true);

  drawSource(f, cfg.source);
}
