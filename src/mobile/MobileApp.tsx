// The mobile/tablet experience, unchanged by the desktop split: the staged
// boot beat hands the playful loader one full pulse while the live-data
// fetches race ahead, then the swipe deck takes over. `key={locale}` remounts
// the deck on a language switch — cards read t() at draw time and the deck
// holds no transient state worth preserving (the desktop gallery repaints in
// place instead; see Gallery's redrawToken).

import { useEffect, useState } from 'react';
import { MobileDeck } from '../components/MobileDeck';
import { LoadingScreen } from '../components/loading/LoadingScreen';
import { loadLiveData } from '../data/sources';
import { useDictReady } from '../hooks/useDictReady';
import { LOCALE, onLocaleChange } from '../i18n';

const BOOT_MS = 2400;

export default function MobileApp() {
  const [done, setDone] = useState(false);
  const [locale, setLocaleState] = useState(LOCALE);
  const [showLoader, setShowLoader] = useState(true);
  const dictReady = useDictReady();

  useEffect(() => onLocaleChange(setLocaleState), []);
  useEffect(() => {
    // Fire-and-forget; loadLiveData guards against StrictMode double-mount.
    loadLiveData();
    const id = setTimeout(() => setDone(true), BOOT_MS);
    return () => clearTimeout(id);
  }, []);

  // Hold the loader until both the boot beat and the dictionary are ready, so
  // a panel never paints German for a non-German visitor mid-handoff.
  const ready = done && dictReady;
  return (
    <>
      {ready && <MobileDeck key={locale} />}
      {showLoader && <LoadingScreen done={ready} onExited={() => setShowLoader(false)} />}
    </>
  );
}
