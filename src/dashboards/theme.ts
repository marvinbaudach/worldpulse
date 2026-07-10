// Chart theme for the canvas-rendered dashboards. Dark-mode values validated
// (scripts from the dataviz method) against the panel surface #12151c:
// lightness band, chroma floor and >=3:1 contrast all pass; the worst adjacent
// CVD pair sits in the floor band, mitigated by direct labels on every chart.
// The surface was since deepened to #0a0c11 for distance readability on the
// orbiting ring — darkening the ground only *raises* the ink/series contrast
// the check measured, so every validated pair stays comfortably above floor.

export const SURFACE = '#0a0c11';
export const SURFACE_DEEP = '#06070a';

export const INK = '#ffffff';
// Brightened from #c3c2b7 on user request — axis ticks and eyebrow titles
// were hard to read; still warm-tinted so it stays below pure-white INK.
export const INK_SECONDARY = '#dedcd3';
export const MUTED = '#898781';
export const GRID = '#242a35';
export const BASELINE = '#3a4150';

/** Categorical slots in fixed order (identity — assigned, never cycled). */
export const SERIES = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#7d55d9', // violet — darker/more saturated than the blue slot so the pair stays readable in dim light
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
] as const;

/** Sequential blue ramp (low -> high) for magnitude on the dark surface. */
export const SEQ = [
  '#184f95',
  '#1c5cab',
  '#256abf',
  '#2a78d6',
  '#3987e5',
  '#5598e7',
  '#6da7ec',
  '#86b6ef',
] as const;

/** Status — reserved, never used as series colors. */
export const GOOD = '#0ca30c';
export const CRITICAL = '#d03b3b';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
