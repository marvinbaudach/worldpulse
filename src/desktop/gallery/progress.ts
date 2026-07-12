/** Determinate load progress: rendered thumbnails / total, as a 0–100 integer.
    Floors instead of rounding so 100 is only reported once every thumbnail is
    actually in (199/200 must read 99, not "done"). With nothing to render
    (empty filter) there is nothing to wait for → 100. */
export function progressPct(rendered: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((rendered / total) * 100)));
}
