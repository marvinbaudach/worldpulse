import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { bgDiag } from './MobileAurora';
import { glassSurface } from './glass';

// Easter egg: an invisible tap target in the top-right corner. Tap it to flash
// the running build's commit id — a quick way to confirm which deploy is live
// on the phone, without dev tools. Auto-hides after a few seconds; tap again to
// dismiss early. The id is baked in at build time (see vite.config.ts).
const Hotspot = styled.button`
  position: fixed;
  top: 0;
  right: 0;
  width: 60px;
  height: calc(env(safe-area-inset-top, 0px) + 56px);
  z-index: 13;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
`;

const Badge = styled.div`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  right: 16px;
  z-index: 13;
  padding: 8px 12px;
  border-radius: 14px;
  color: #cfe4ff;
  font: 600 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em;
  text-align: right;
  /* Taps fall through to the hotspot beneath, so tapping the pill dismisses. */
  pointer-events: none;
  ${glassSurface}
`;

const Diag = styled.div`
  font-size: 10px;
  font-weight: 500;
  color: rgba(207, 228, 255, 0.75);
`;

export function BuildBadge() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(false), 4000);
    return () => clearTimeout(id);
  }, [shown]);

  return (
    <>
      <Hotspot aria-label="Build-Info" onClick={() => setShown((s) => !s)} />
      {shown && (
        <Badge>
          #{__COMMIT_ID__}
          {/* Which background path this device actually resolved to (GL bit
              depth + GPU, or the fallback reason) — read on tap, so it shows
              the state after init rather than a stale module snapshot. */}
          <Diag>{bgDiag.info}</Diag>
        </Badge>
      )}
    </>
  );
}
