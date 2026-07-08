import { useEffect, useRef, useState, type RefObject } from 'react';
import { t as tr } from '../i18n';
import styled from 'styled-components';
import type { HandState, HandTrackingStatus } from '../hooks/useHandTracking';
import { glassSurface } from './glass';

interface HandControlsProps {
  status: HandTrackingStatus;
  onToggle: () => void;
  hand: RefObject<HandState>;
  /** Flight progress of a gesture-grabbed card (null while nothing is
      grabbed) — lets the live chip show "Grab 42%". */
  scrub: RefObject<number | null>;
}

// Top-left: the PerfHud already owns the top-right corner.
const Bar = styled.div`
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Toggle = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  ${glassSurface}
  color: rgba(255, 255, 255, 0.85);
  font: 500 13px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: rgba(20, 28, 46, 0.7);
    border-color: rgba(255, 255, 255, 0.35);
  }
`;

// The cursor is repositioned imperatively from a rAF loop (no React state per
// frame); opacity/size react to tracking and pinch via inline styles too.
const Cursor = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow:
    0 0 12px rgba(120, 170, 255, 0.45),
    inset 0 0 8px rgba(120, 170, 255, 0.25);
  opacity: 0;
  pointer-events: none;
  will-change: transform, opacity;
`;

// How long the gesture legend stays up after tracking starts.
const HINTS_MS = 10000;

// Hand speed (normalized units/s) above which the chip reads "Swipe" —
// matches the flick threshold in useCarouselRotation, so the chip shows
// "swipe" exactly when a motion is fast enough to spin the ring.
const SWIPE_SPEED = 0.55;

// Live gesture readout; its text/opacity are set imperatively per frame.
const GestureChip = styled.span`
  padding: 8px 12px;
  border-radius: 999px;
  ${glassSurface}
  color: rgba(160, 200, 255, 0.95);
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition: opacity 0.2s ease;
`;

const HintToggle = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  ${glassSurface}
  color: rgba(255, 255, 255, 0.85);
  font: 500 13px/1 inherit;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: rgba(20, 28, 46, 0.7);
    border-color: rgba(255, 255, 255, 0.35);
  }
`;

const Hints = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%)
    translateY(${({ $visible }) => ($visible ? '0' : '12px')});
  z-index: 10;
  display: flex;
  gap: 28px;
  padding: 14px 24px;
  border-radius: 16px;
  ${glassSurface}
  color: rgba(255, 255, 255, 0.85);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  pointer-events: none;
  transition:
    opacity 0.35s ease,
    transform 0.35s ease,
    visibility 0.35s;
`;

const Hint = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 220px;
  font-size: 13px;
  line-height: 1.35;
`;

const HintIcon = styled.span`
  font-size: 22px;
  filter: drop-shadow(0 0 6px rgba(120, 170, 255, 0.4));
`;

const HintText = styled.span`
  b {
    display: block;
    font-weight: 600;
    color: #fff;
  }
  color: rgba(255, 255, 255, 0.6);
`;

const LABEL: Record<HandTrackingStatus, string> = {
  idle: '✋ Handsteuerung',
  starting: '✋ Startet…',
  running: '✋ Handsteuerung aktiv',
  error: '✋ Kamera nicht verfügbar — erneut versuchen',
};

/**
 * Camera toggle button plus the on-screen hand cursor. The cursor follows
 * `hand` from its own rAF loop and shrinks while pinching, so grabbing has
 * visible feedback even before a card starts moving.
 */
export function HandControls({ status, onToggle, hand, scrub }: HandControlsProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [showHints, setShowHints] = useState(false);

  // Pop the gesture legend up whenever tracking starts, then let it fade so
  // it never competes with the scene; the "?" button brings it back.
  useEffect(() => {
    if (status !== 'running') {
      setShowHints(false);
      return;
    }
    setShowHints(true);
    const id = setTimeout(() => setShowHints(false), HINTS_MS);
    return () => clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = cursorRef.current;
      const h = hand.current;
      if (!el || !h) return;
      const scale = h.pinching ? 0.55 : 1;
      el.style.opacity = h.tracked ? '1' : '0';
      el.style.transform = `translate(${h.x * window.innerWidth}px, ${
        h.y * window.innerHeight
      }px) scale(${scale})`;

      // Live readout of what the tracker currently sees.
      const chip = chipRef.current;
      if (chip) {
        const grabT = scrub.current;
        let label: string;
        if (!h.tracked) label = '· no hand';
        else if (grabT !== null) label = `🤏 grab · ${Math.round(grabT * 100)}%`;
        else if (h.pinching) label = '🤏 pinch';
        else if (Math.hypot(h.vx, h.vy) > SWIPE_SPEED) label = '🖐️ swipe';
        else label = '🖐️ open hand';
        if (chip.textContent !== label) chip.textContent = label;
        chip.style.opacity = h.tracked ? '1' : '0.45';
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, hand, scrub]);

  return (
    <>
      <Bar>
        <Toggle type="button" onClick={onToggle}>
          {tr(LABEL[status])}
        </Toggle>
        {status === 'running' && (
          <>
            <HintToggle
              type="button"
              aria-label="Show gesture help"
              onClick={() => setShowHints((v) => !v)}
            >
              ?
            </HintToggle>
            <GestureChip ref={chipRef}>· no hand</GestureChip>
          </>
        )}
      </Bar>
      {status === 'running' && (
        <>
          <Cursor ref={cursorRef} />
          <Hints $visible={showHints}>
            <Hint>
              <HintIcon>🖐️</HintIcon>
              <HintText>
                <b>{tr('Wischen')}</b>
                {tr('Offene Hand schnell zur Seite bewegen, um den Ring zu drehen')}
              </HintText>
            </Hint>
            <Hint>
              <HintIcon>🤏</HintIcon>
              <HintText>
                <b>{tr('Kneifen')}</b>
                {tr('Kurzes Kneifen auf einem Panel öffnet es — erneut kneifen legt es zurück')}
              </HintText>
            </Hint>
            <Hint>
              <HintIcon>🧲</HintIcon>
              <HintText>
                <b>{tr('Halten & ziehen')}</b>
                {tr('Kneifgriff halten und die Hand heranziehen oder wegschieben')}
              </HintText>
            </Hint>
          </Hints>
        </>
      )}
    </>
  );
}
