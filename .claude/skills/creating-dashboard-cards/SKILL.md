---
name: creating-dashboard-cards
description: Use when adding, reworking, or removing a Worldpulse dashboard card, or when the user asks for new card ideas — covers proposal, implementation, and verification.
---

# Creating Dashboard Cards

The routine for taking a Worldpulse card from idea to verified. Six phases, each
with a gate you do not skip. The pipeline is one-directional (data → texture →
3D); read `CLAUDE.md` "Architecture" and "Adding a dashboard card" first.

**Core rule:** propose before you build, verify on real surfaces before you claim
done. Never fabricate data — every `live.*` read needs a real bundled/seeded
fallback (see `CLAUDE.md` "Data integrity & uncertainty").

## Phase gates

Run the phases in order. Do not enter the next phase until the current gate holds.

### 1. Planning
Understand the request and pin down, per card: concept · data source · chart type
· offline fallback · theme tags · `dynamic`/`live` flags.

- Research first (`CLAUDE.md` development-workflow): check `sources.ts`,
  `bundled.ts`, existing cards in `cards.ts`, and the chart helpers in
  `dashboards/charts/` + `draw.ts` before inventing anything. Reuse `trendCard()`
  / `eraMarkers()` where they fit.
- Confirm the API is keyless and public; note lag/encoding gotchas.

**Gate:** you can name the data source and the exact fallback for every live read.

### 2. Proposal + Rückfragen mit Auswahl
New card(s) → present proposals on an **Artifact FIRST** (see
[[present-cards-before-building]]): one block per card with concept, data source,
chart type, fallback, theme tags. Then use **AskUserQuestion** for the open
choices (which cards, chart variant, featured or not, live vs. static).

**Gate:** the user has picked/approved. No code lands in `POOL`/`TAGS_BY_ID`
before this.

### 3. Implementation
Follow the `CLAUDE.md` "Adding a dashboard card" checklist exactly:

1. Add the definition to `POOL` in `src/dashboards/cards.ts`. Build the chart
   config **inside `draw`** (never above it) so it reads live data per-frame.
   Provide a fallback for every `live.*` read.
2. Register tags in `TAGS_BY_ID` in `src/dashboards/index.ts`; add to `FEATURED`
   if it should lead the ring.
3. Live-fetched → `dynamic: true`. Keeps moving while idle → `live: true`. Purely
   bundled → leave both off.
4. New live source → add fetcher + `LIVE_FEEDS` entry in `data/sources.ts` and a
   typed field in `LiveData` (`data/store.ts`).
5. New/changed German copy → add the same key to `src/i18n/{en,fr,it}.ts` (or
   `identical.ts` if it truly reads the same in every locale).

**Color legibility — colors must be easy to tell apart, not just pretty.**
Colors come from `dashboards/theme.ts` only; this is what keeps them readable, so
never hand-pick hex.

- Categories → `SERIES` in identity order (8 slots, deliberately ordered so
  adjacent hues stay distinguishable — including under CVD and in dim light).
  Assign by identity, never cycle; don't reorder to place two near-hues side by
  side. The palette guarantees ≥3:1 contrast against the `#12151c` surface —
  a hand-picked hex forfeits that.
- Magnitude → the `SEQ` ramp, never random `SERIES` colors.
- `GOOD`/`CRITICAL` are reserved for good/bad semantics — never as a series color.
- Never rely on color alone: label series directly on the chart (this is the
  documented mitigation for the worst adjacent CVD pair). Two series that must be
  compared → pick well-separated `SERIES` slots.

Write a unit test alongside any pure helper you add (see `draw.test.ts`,
`timeline.test.ts` for shape).

**Gate:** code compiles in your head against the checklist; no hand-picked hex,
no config above `draw`.

### 4. Lint & build
```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build — this is what CI runs
```
**Gate:** both exit clean. (PostToolUse hooks run oxlint + incremental tsc per
edit; this is the authoritative full pass.)

### 5. Tests
```bash
npm run test     # vitest run
```
`cards.smoke.test.ts` draws every card offline (intro + settled) and fails if a
card throws or paints nothing — your new card is covered automatically.
`i18n.coverage.test.ts` fails on any untranslated/drifted German string.

**Gate:** full suite green, including your new helper tests.

### 6. Headless verification — mobile AND desktop
The app picks the renderer via `useIsMobile` — breakpoint
`(max-width: 820px), (pointer: coarse)`. Both paths must be seen, not assumed:

```bash
npm run dev &    # vite on :5173
```
Then drive Chrome headless (`use_browser`, see the browsing/browser-qa skills):

- **Desktop** — viewport ~1440×900 → `Carousel3D` (WebGL). Confirm the ring
  renders, the new card appears, console has no errors. Screenshot.
- **Mobile** — viewport ~390×844 (≤820 triggers the coarse path) → `MobileDeck`
  (2D canvas, no WebGL). Confirm the card renders there too. Screenshot.
- Toggle live data (or `npm run gallery`, which renders every card with a live
  toggle and lightbox) to confirm both the live and offline-fallback looks.
- **Eyeball the colors on the actual dark surface:** every series is distinct
  from its neighbours and from the background, no two look the same at ring-panel
  size, labels are readable. If a pair blurs together, re-pick `SERIES` slots or
  lean on direct labels — do not tweak hex.

**Gate:** both surfaces screenshotted, no console errors, card legible and its
colors clearly distinguishable on each. Only now is the card done.

## Quick reference

| Step | Command | Fails if |
|------|---------|----------|
| Lint | `npm run lint` | oxlint error |
| Build | `npm run build` | type or bundle error (CI gate) |
| Test | `npm run test` | card throws/paints nothing, i18n gap |
| Card QA | `npm run gallery` | new card looks wrong in the grid |
| App | `npm run dev` → :5173 | ring/deck broken at either viewport |

## Common mistakes

- **Skipping the proposal artifact.** New cards get approved on an Artifact
  before any code — cheaper to iterate on a proposal. [[present-cards-before-building]]
- **Building the chart config above `draw`.** It then captures stale/undefined
  live data and never updates per-frame. Always inside `draw`.
- **No fallback for a `live.*` read.** The ring looks broken offline and the
  smoke test may pass while the real app doesn't. Every read falls back.
- **Overlaying bundled onto live to fake a delta.** `bundled.ts` is an offline
  fallback, not an override. Never mix them into one figure.
- **Verifying desktop only.** Mobile is a separate 2D renderer (`MobileDeck`) —
  a card can render on WebGL and break on the phone canvas. Check both.
- **Hand-picking hex.** Colors come from `theme.ts` (`SERIES`/`SEQ`/`GOOD`/
  `CRITICAL`) only — the palette is CVD-validated for ≥3:1 on `#12151c`.
- **Colors that blur together.** Adjacent/compared series drawn in near-hues, or
  magnitude drawn in `SERIES` instead of `SEQ`, read as one blob. Use
  well-separated slots, `SEQ` for magnitude, and direct labels — verify by eye in
  phase 6, not just that it compiles.
- **Forgetting i18n.** New German copy without `{en,fr,it}` (or `identical.ts`)
  keys fails the coverage guard at build.
