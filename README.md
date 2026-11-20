# Worldpulse

A gallery of canvas-drawn data dashboards on topics such as US debt, military
spending, nuclear warheads, refugees, population and Wikipedia trends. The pool
holds about 230 cards. Some are fed by keyless public APIs, the others use
datasets bundled with the app. Card text is available in German, English,
French and Italian.

**Live: [marvinbaudach.github.io/worldpulse](https://marvinbaudach.github.io/worldpulse/)**

## What it does

Desktop and mobile are two separate views. Touch devices and screens up to
820 px wide get the mobile deck, everything else gets the gallery. Add
`?view=mobile` or `?view=desktop` to the URL to force one.

### Desktop gallery

- **Grid:** every card as a thumbnail, newest first. The tile size can be set
  to S, M or L. A progress bar and skeleton tiles show while thumbnails paint.
- **Search:** matches the card id, the German title and the title in the
  current language. The card count appears once a search or category is active,
  and a zero-result state offers a button to reset the filters.
- **Categories:** filter by theme (tech, geld, krieg, deutschland, soziales,
  freiheit, gesundheit, corona, welt). The backdrop takes on the color of the
  chosen category.
- **Languages:** a switcher for DE, EN, FR and IT. The browser language is the
  default, a manual pick is remembered. Thumbnails and the open card repaint in
  place.
- **Lightbox:** click a tile to see the card at full size next to its notes
  (context, what the data show, what they do not show, authors' notes) and the
  source. Previous and next buttons walk the current result list. The PNG
  button downloads the card as a poster image with the source stamped on it.
- **Context menu:** right-click a tile to copy its id, its id and title, or the
  card as an image.
- **Keyboard:** Tab into the grid, arrow keys move between tiles by the current
  column count, Home and End jump to the first and last tile, Enter or Space
  opens the lightbox. In the lightbox, Left and Right arrows change the card,
  Esc closes it, Tab stays inside the dialog, and focus returns to the tile of
  the last viewed card on close.
- **Frame rate meter:** append `?fps` to the URL to show a small frame rate
  overlay.

### Mobile deck

- A swipe deck: swipe sideways between cards, pull down to refresh the live
  data.
- A theme sheet to filter by category, including a stack of favorites.
- A star marks a card as favorite. Favorites are stored in the browser.
- An action menu with share (or save image where sharing files is not
  supported), details or source, motion effects for the background, and a
  language switch.

## Data

- Live data comes from keyless public APIs (Treasury Fiscal Data, World Bank,
  Open-Meteo, Wikimedia, Tech for Palestine, ArcGIS and others). Derived shapes
  are cached in localStorage with a per-source TTL.
- When a source is down, its cards fall back to bundled values for the same
  series. Bundled data is never layered over live data.
- The card smoke test renders every card offline, so a missing feed cannot
  break the gallery unnoticed.

## Tech

- React 19, TypeScript, Vite 8, styled-components, oxlint
- Charts are drawn with Canvas 2D. The same renderers produce the thumbnails,
  the lightbox image and the PNG export.
- i18n: dictionaries keyed by the German source string, loaded per language on
  demand. A test fails the build if a rendered string has no translation.
- Tests: Vitest with jsdom for the logic, Playwright for the gallery on desktop
  Firefox and the deck on mobile Chromium.
- CI runs lint, tests and build, then deploys to GitHub Pages on push to `main`.

## Develop

```bash
pnpm install
pnpm dev         # dev server
pnpm build       # type-checked production build
pnpm lint
pnpm test        # unit tests
pnpm e2e         # Playwright
```
