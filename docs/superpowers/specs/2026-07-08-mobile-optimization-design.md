# Mobile Optimization — Readability & App Feel

**Date:** 2026-07-08
**Status:** Approved
**Scope:** Mobile path only (`MobileDeck` / `SwipeDeck` / `CardCanvas` and new
mobile-only additions). The desktop WebGL carousel and the card definitions in
`dashboards/cards.ts` stay untouched.

## Goal

Two user-facing improvements, in this order:

1. **Readability** — card text (labels, axes, legends) is too small on phones,
   and the desktop-density layout feels crowded.
2. **App feel** — polish and effects that make the mobile view feel like a
   native app: PWA install, micro-interactions, a living background, and
   gyro parallax.

## 1. Readability (first)

- **u-boost at the mobile entry point.** `CardCanvas` currently computes
  `u = w / 512` (the shared 512-wide reference layout). Lower the mobile
  reference width to **~420** (single constant, tuned by eye in device
  emulation). Every font, stroke, legend and axis label across all ~110 cards
  scales up ~22% uniformly — one central change, no per-card edits.
- **Compact flag.** Add `compact?: boolean` to the `Frame` interface
  (`dashboards/draw.ts`). `CardCanvas` sets it. `drawSource`
  (`dashboards/charts/shared.ts`) early-returns when compact — on mobile the
  source already lives behind the "i" button, so the muted footer line is
  redundant and its removal frees bottom space.
- **Acceptance:** the densest cards (multi-series lines with legends, ranked
  lists, maps) checked in Chrome DevTools mobile emulation; no colliding or
  clipped labels. The reference-width constant is the tuning knob.

## 2. PWA polish

- `public/manifest.webmanifest`: name Worldpulse, `display: standalone`,
  `background_color`/`theme_color` `#05070c`, maskable PNG icons (192/512)
  generated from the existing `favicon.svg`.
- `index.html`: manifest link, `apple-touch-icon`, `viewport-fit=cover`
  (safe-area insets are already consumed in `MobileDeck`).
- Minimal pass-through service worker (network-only fetch handler) so Chrome
  offers the install prompt. Registered with a relative path so the GitHub
  Pages subpath (`base: './'`) keeps working. No offline caching — out of
  scope.

## 3. Micro-interactions

- **Page dots** replace the `3 / 12` counter: iOS-pager style — active dot
  emphasized and animated; with many cards the edge dots shrink (compressed
  pager) so the row stays bounded.
- **Sheet polish:** the theme sheet's backdrop gains `backdrop-filter: blur`
  and a fade-in; the sheet keeps its slide-up animation.
- **Pull-to-refresh** on the deck (vertical gesture — no conflict with the
  horizontal card swipe): re-triggers the live-data fetchers with a small
  glow/spinner affordance at the top. Cards marked `dynamic` redraw when data
  lands (existing behavior).
- **Chart animation on every card.** Today only the very first card plays the
  fly-in; afterwards `CardCanvas` locks the settled frame. Change: each card
  replays its intro when it lands in front after a swipe (not while peeking
  behind — the stack stays calm). The replay starts together with the landing
  animation so the settled→restart flash reads as part of the transition.
  Cards with `live: true` (e.g. the debt clock) additionally keep a continuous
  rAF loop while they are the front card instead of freezing. Both respect
  `prefers-reduced-motion` (settled frame, no replay).

## 4. Living background

- The mobile path deliberately has no WebGL, so no R3F aurora. Instead: a
  fixed layer behind the deck with 2–3 large radial-gradient blobs, animated
  slowly via `transform` (GPU-cheap, no per-frame JS).
- Tint follows the active theme's `TAGS[].accent` with a soft transition —
  same "the room changes mood" read as the desktop aurora.
- Disabled under `prefers-reduced-motion` (static tinted gradient instead).

## 5. Gyro parallax / tilt

- New hook `useDeviceTilt` wrapping `deviceorientation`: the active card tilts
  subtly (±3–4°, damped) and the background blobs shift slightly the other way
  (parallax).
- Android/desktop: enabled automatically where the event fires without
  permission. **iOS:** a discreet glass chip ("Bewegungseffekte aktivieren",
  UI copy in German + i18n keys for en/fr/it) triggers
  `DeviceOrientationEvent.requestPermission()` on tap; the choice persists in
  `localStorage` so the chip shows only until answered.
- Fully disabled under `prefers-reduced-motion`.

## Order & verification

Implement 1 → 2 → 3 → 4 → 5. After each block: `npm run lint` and
`npm run build` (the CI gates) plus a visual pass in mobile emulation.

## Non-goals

- No changes to the desktop carousel, card definitions, data pipeline or
  theme palette.
- No offline caching / full PWA offline support.
- No per-card mobile layout variants.
