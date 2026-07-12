// The desktop shell: the aubergine backdrop plus the gallery — no boot loader.
// The gallery owns its skeletons and load-progress bar; this shell only holds
// what must outlive the gallery: the backdrop's accent mood and the shared
// boot work (live-data kickoff, dictionary gate so the first paint is already
// translated).

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { loadLiveData } from '../data/sources';
import { useDictReady } from '../hooks/useDictReady';
import Gallery from './gallery/Gallery';
import { AubergineBackdrop } from './gallery/AubergineBackdrop';
import { FpsMeter } from './gallery/FpsMeter';
import { ACCENT } from './gallery/galleryChrome';

// Perf HUD opt-in, checked once: append `?fps` to the URL to overlay the
// rAF-cadence meter (works on the deployed page too, for on-device jank
// hunts).
const SHOW_FPS = new URLSearchParams(window.location.search).has('fps');

const Wrap = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
`;

export default function DesktopApp() {
  const [accent, setAccent] = useState(ACCENT);
  const dictReady = useDictReady();

  useEffect(() => {
    // Fire-and-forget; loadLiveData guards against StrictMode double-mount.
    loadLiveData();
  }, []);

  return (
    <Wrap>
      <AubergineBackdrop accent={accent} />
      {dictReady && <Gallery onAccentChange={setAccent} />}
      {SHOW_FPS && <FpsMeter />}
    </Wrap>
  );
}
