import { lazy, Suspense, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useEnvironment } from '@react-three/drei';
import { Carousel3D } from './components/Carousel3D';
import { MobileDeck } from './components/MobileDeck';
import { PerfHud } from './components/PerfHud';
import { DevGalleryLink } from './components/DevGalleryLink';
import { LoadingScreen } from './components/loading/LoadingScreen';
import { GlobalStyle } from './GlobalStyle';
import { loadLiveData } from './data/sources';
import { useIsMobile } from './hooks/useIsMobile';
import { LOCALE, onLocaleChange, ensureLocaleReady } from './i18n';

// The card review gallery is a dev-only, desktop-only single-page view. Behind
// the static `import.meta.env.DEV` check the dynamic import is dead-code
// eliminated in production, so neither this chunk nor its imports ever ship.
const DevGallery = import.meta.env.DEV ? lazy(() => import('./dev/DevGallery')) : null;

// "Loading" is a staged boot sequence: it gives the pulse loader one full
// beat before the iris hands the screen center over to the blooming ring,
// while the live-data fetches race ahead in the background.
const BOOT_MS = 2400;

const Stage = styled.main`
  position: fixed;
  inset: 0;
  background: #080b14;
  overflow: hidden;

  & canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    touch-action: none; /* drag must not collide with page scroll */
  }
`;

export default function App() {
  const [done, setDone] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  // Phones skip the WebGL ring entirely for a light 2D-canvas card deck.
  const isMobile = useIsMobile();
  // Language hotkey: a locale switch re-renders the DOM overlays through
  // this state; the WebGL panels redraw their own textures in place (see
  // CarouselItem/HeroCard), so the ring never replays its boot intro.
  const [locale, setLocaleState] = useState(LOCALE);
  useEffect(() => onLocaleChange(setLocaleState), []);

  // Dev-only, desktop-only: toggle the in-app card gallery. Both views stay
  // mounted; this only flips which one is visible (a crossfade) and freezes the
  // other's render loop, so switching is smooth and loses no state either way.
  const [showGallery, setShowGallery] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV || isMobile) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      // Don't hijack the key while typing in the gallery's own controls.
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) {
        return;
      }
      setShowGallery((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);

  // Don't load the gallery's code split — or spin up its WebGL backdrop and
  // hundreds of thumbnail canvases — until it's first opened. After that it
  // stays mounted so re-toggling is instant and lossless. (In production the
  // whole gallery is compiled out regardless.)
  const [galleryMounted, setGalleryMounted] = useState(false);
  useEffect(() => {
    if (showGallery) setGalleryMounted(true);
  }, [showGallery]);

  // The active locale's dictionary is a separate chunk; load it before the ring
  // blooms so the first texture paint is already translated (German loads none,
  // so it starts ready). A failed chunk degrades to German rather than hanging.
  const [dictReady, setDictReady] = useState(LOCALE === 'de');
  useEffect(() => {
    let alive = true;
    void (async () => {
      await ensureLocaleReady();
      if (alive) setDictReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Fire off the public-API fetches and the price socket during the boot
    // beat, so most panels already hold real data when the ring blooms.
    loadLiveData();
    // Fetch + decode the scene's HDR environment during the boot beat too —
    // otherwise it lands mid-handoff and stalls the converge/iris animation.
    if (!isMobile) useEnvironment.preload({ preset: 'night' });
    const id = setTimeout(() => setDone(true), BOOT_MS);
    return () => clearTimeout(id);
  }, [isMobile]);

  // Hold the loader until both the boot beat and the dictionary are ready, so a
  // panel never paints German for a non-German visitor mid-handoff.
  const ready = done && dictReady;

  return (
    <Stage>
      <GlobalStyle />
      {ready && (isMobile ? <MobileDeck key={locale} /> : <Carousel3D paused={showGallery} />)}
      {!isMobile && !showGallery && <PerfHud />}
      {!isMobile && !showGallery && <DevGalleryLink onOpen={() => setShowGallery(true)} />}

      {!isMobile && DevGallery && ready && galleryMounted && (
        <Suspense fallback={null}>
          <DevGallery active={showGallery} onClose={() => setShowGallery(false)} />
        </Suspense>
      )}

      {showLoader && (
        <LoadingScreen done={ready} onExited={() => setShowLoader(false)} />
      )}
    </Stage>
  );
}
