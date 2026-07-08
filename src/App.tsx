import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useEnvironment } from '@react-three/drei';
import { Carousel3D } from './components/Carousel3D';
import { MobileDeck } from './components/MobileDeck';
import { PerfHud } from './components/PerfHud';
import { LoadingScreen } from './components/LoadingScreen';
import { GlobalStyle } from './GlobalStyle';
import { loadLiveData } from './data/sources';
import { useIsMobile } from './hooks/useIsMobile';
import { LOCALE, onLocaleChange } from './i18n';

// "Loading" is a staged boot sequence: it gives the pulse loader one full
// beat before the iris hands the screen center over to the blooming ring,
// while the live-data fetches race ahead in the background.
const BOOT_MS = 2400;

const Stage = styled.main`
  position: fixed;
  inset: 0;
  background: #05070c;
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

  return (
    <Stage>
      <GlobalStyle />
      {done && (isMobile ? <MobileDeck key={locale} /> : <Carousel3D />)}
      {!isMobile && <PerfHud />}

      {showLoader && (
        <LoadingScreen done={done} onExited={() => setShowLoader(false)} />
      )}
    </Stage>
  );
}
