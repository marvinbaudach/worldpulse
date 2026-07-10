# Loading Screen Visual Polish — Design

Approved 2026-07-10. Scope: `src/components/loading/` only. The exit
choreography (converge, flash, shockwave), progress logic and mobile deck
behavior stay untouched.

## 1. Composition — type block above the globe

Problem: the wordmark currently overlaps the globe's upper dome (the flex
column centers the type and only half-lifts it via `GlobeGap`).

- Anchor the type block (`Column`) absolutely: its bottom edge sits just above
  the progress ring's top edge (`bottom: calc(50% + ring-radius + gap)`), so
  title and globe never overlap at any viewport size.
- Shrink the globe slightly to make headroom: ring 68vmin → 62vmin, globe base
  factor 0.3 → 0.27 (desktop branch only; portrait phone sizing stays).
  The converge center remains the exact screen center.
- New eyebrow line above the wordmark: `LIVE · GLOBAL · DATA` — mono, small,
  tracked out. Deliberately language-neutral so no i18n keys are needed.
- Desktop gets the percent readout that so far exists only on portrait phones
  (`87 % · 3/7`), placed below the globe. Same mono styling; the distracting
  per-source feed list from earlier iterations does NOT return.

## 2. Depth & atmosphere

- Day/night lighting on the dot globe: fixed light vector (upper left, toward
  viewer); each sphere dot's alpha scales with `max(0, n·l)` on top of the
  existing z-depth factor. Implemented inside the existing alpha-bucket
  system — one extra multiply per dot, no new fill styles.
- Atmosphere rim: a soft blue ring glow hugging the globe's edge, as a static
  CSS radial-gradient layer behind the canvas (zero per-frame cost).
- Vignette: static radial gradient over the screen edges pulling focus center.

## 3. Motion

- Twinkle flares: a deterministic subset of sphere dots briefly flares bright
  (phase from frame time + dot index — no RNG per frame), reading as "data
  arriving".
- The EKG line under the wordmark loops: draw-on, hold, sweep-out, repeat
  (dashoffset 1 → 0 → -1), instead of drawing once and freezing.
- `prefers-reduced-motion` keeps disabling all of it, as today.
