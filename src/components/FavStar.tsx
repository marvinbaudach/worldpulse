// The star glyph inside the favorite toggles (hero footer + swipe deck),
// with the app-like feedback baked in: starring pops the star with a springy
// overshoot and fires an expanding gold ring; un-starring gives a quick dip.
// The animation only plays on an actual toggle — moving to another card that
// happens to be starred re-renders silently (the deck keeps one button
// instance alive across cards, so `id` guards against that).

import { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { SERIES } from '../dashboards/theme';

const pop = keyframes`
  0% { transform: scale(0.3) rotate(-30deg); }
  55% { transform: scale(1.4) rotate(10deg); }
  100% { transform: scale(1) rotate(0deg); }
`;

const dip = keyframes`
  0% { transform: scale(0.75); }
  100% { transform: scale(1); }
`;

const ring = keyframes`
  0% { transform: scale(0.5); opacity: 0.9; }
  100% { transform: scale(1.9); opacity: 0; }
`;

const Glyph = styled.span<{ $anim: 'pop' | 'dip' | null }>`
  display: inline-block;
  animation: ${(p) => (p.$anim === 'pop' ? pop : p.$anim === 'dip' ? dip : 'none')}
    ${(p) => (p.$anim === 'pop' ? '450ms' : '200ms')} cubic-bezier(0.34, 1.56, 0.64, 1) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Expanding, fading ring over the button on starring — the same radar-ping
// language the map cards speak. Needs a positioned parent (both buttons are).
const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid ${SERIES[2]};
  pointer-events: none;
  animation: ${ring} 500ms ease-out both;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

interface FavStarProps {
  /** Card id — a change resets the toggle tracking without animating. */
  id: string;
  active: boolean;
}

export function FavStar({ id, active }: FavStarProps) {
  const prevId = useRef(id);
  const prevActive = useRef(active);
  // Monotonic keys so a re-toggle replays the animation from the start.
  const [anim, setAnim] = useState<{ kind: 'pop' | 'dip'; n: number } | null>(null);

  useEffect(() => {
    if (prevId.current !== id) {
      prevId.current = id;
      prevActive.current = active;
      setAnim(null);
      return;
    }
    if (prevActive.current === active) return;
    prevActive.current = active;
    setAnim((a) => ({ kind: active ? 'pop' : 'dip', n: (a?.n ?? 0) + 1 }));
  }, [id, active]);

  return (
    <>
      {anim?.kind === 'pop' && <Ring key={`r${anim.n}`} aria-hidden />}
      <Glyph key={anim ? `${anim.kind}${anim.n}` : 'idle'} aria-hidden $anim={anim?.kind ?? null}>
        {active ? '★' : '☆'}
      </Glyph>
    </>
  );
}
