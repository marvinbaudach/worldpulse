import { css } from 'styled-components';

// ── Design tokens ───────────────────────────────────────────────────────────
// One source of truth for the glass system, shared by the app chrome (this dir)
// and the dev gallery (which re-exports these from galleryChrome so its modules
// keep a single import site).

// Two blues, two roles:
// - ACCENT: the saturated signature blue (loader globe) for glows, focus rings,
//   active fills and borders.
// - ACCENT_TEXT: its light tint, used as the accent *text* color for active /
//   selected labels, where the saturated blue would read too dark on glass.
export const ACCENT = '#3870f8';
export const ACCENT_RGB = '56, 112, 248';
export const ACCENT_TEXT = '#cfe4ff';
// Neutral text on glass: primary and secondary. DIM is tuned to hold >= 4.5:1
// on the brightest stop of the backdrop ramp (#571b52 bloom) under the toolbar.
export const INK = '#dfe3ec';
export const DIM = '#a9b0c0';

// One UI face for the chrome — the same system sans the mobile deck uses.
// Monospace is reserved for data and code; none of the chrome is either.
export const UI_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Corner-radius scale. One system: controls < menu rows < menu popovers < large
// panes. Rows nest concentrically inside a popover (popover radius − padding).
export const RADIUS = {
  control: '10px', // buttons, inputs, select triggers
  item: '7px', // rows inside a menu
  menu: '12px', // dropdown / context-menu popovers
  panel: '16px', // large frosted panes (toolbar, info, toast)
  pill: '999px',
} as const;

// Spacing scale (4px base) — one rhythm for gaps and padding across the page.
// Use these for layout whitespace instead of ad-hoc pixel values.
export const SPACE = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
} as const;

// Shared glassmorphism surface for the GUI overlays (control bar, chips,
// buttons, HUD): a frosted, background-blurring pane in the macOS-vibrancy
// idiom. backdrop-filter blurs the backdrop behind it so the aurora reads
// through as diffuse color; a top-lit gradient fill + bright top rim make it
// read as a lit pane of glass rather than a flat tint, and the layered shadow
// (ambient drop + tight contact + inner bottom shade) gives real depth. Cheap:
// it's all DOM compositing.
export const glassSurface = css`
  background:
    linear-gradient(
      158deg,
      rgba(32, 42, 62, 0.5) 0%,
      rgba(15, 20, 31, 0.42) 46%,
      rgba(9, 12, 19, 0.5) 100%
    );
  backdrop-filter: blur(20px) saturate(1.7);
  -webkit-backdrop-filter: blur(20px) saturate(1.7);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 14px 44px -14px rgba(0, 0, 0, 0.6),
    0 3px 10px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -30px 50px -36px rgba(0, 0, 0, 0.45);
`;

// Shared hover/focus reaction for the floating glass controls — the gallery
// launcher, the FPS HUD and the settings toggle. The accent border blooms and
// an accent glow lifts the control a hair off the backdrop, identical everywhere
// so all the corner chrome behaves as one. Pair it with `glassSurface` (which
// sets the resting border + shadow) and make sure the element's own
// `transition` lists `transform`, `border-color` and `box-shadow` so the glow
// eases in. Extra per-control transitions (opacity, color) compose alongside.
export const controlGlow = css`
  &:hover,
  &:focus-visible {
    outline: none;
    transform: translateY(-1px);
    border-color: ${ACCENT};
    box-shadow:
      0 14px 44px -14px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 0 22px -2px rgba(${ACCENT_RGB}, 0.5);
  }
`;
