import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { ALL_DASHBOARDS, TAGS } from '../dashboards';
import { refreshLiveData } from '../data/refresh';
import { shareCard } from '../exportCard';
import { useDeviceTilt } from '../hooks/useDeviceTilt';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTagFilter } from '../hooks/useTagFilter';
import { t as trans } from '../i18n';
import { MobileAurora, hasWebGL } from './MobileAurora';
import { MobileBackground } from './MobileBackground';
import { SwipeDeck } from './SwipeDeck';
import { glassSurface } from './glass';

// iOS gates deviceorientation behind a user-gesture permission prompt;
// everywhere else the event just fires. The user's choice persists so the
// opt-in chip shows only until answered.
type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const MOTION_KEY = 'worldpulse-motion';

function motionPermissionNeeded(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as DOEWithPermission).requestPermission === 'function'
  );
}

const Deck = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  /* Keep the z-index:-1 background layer inside Deck's stacking context in
     all engines (plain position:fixed doesn't create one in Firefox). */
  isolation: isolate;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px;
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 26px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 16px/1 inherit;
  letter-spacing: 0.14em;
  cursor: pointer;
  ${glassSurface}
`;

const DotsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.div<{ $active: boolean; $small: boolean }>`
  width: ${(p) => (p.$active ? 18 : 6)}px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.28)')};
  transform: scale(${(p) => (p.$small ? 0.6 : 1)});
  transition: width 0.25s ease, background 0.25s ease, transform 0.25s ease;
`;

// iOS-pager style dots: with many cards only a sliding window of dots shows,
// and the window-edge dots shrink to signal "more beyond".
const MAX_DOTS = 9;

function Dots({ count, active }: { count: number; active: number }) {
  if (count <= 1) return null;
  const visible = Math.min(count, MAX_DOTS);
  const start = Math.max(0, Math.min(active - Math.floor(MAX_DOTS / 2), count - visible));
  return (
    // The dots are purely visual; the row announces the position textually.
    <DotsRow role="status" aria-label={`${active + 1} / ${count}`}>
      {Array.from({ length: visible }, (_, j) => {
        const i = start + j;
        const edge =
          count > MAX_DOTS &&
          ((j === 0 && start > 0) || (j === visible - 1 && start + visible < count));
        return <Dot key={i} aria-hidden $active={i === active} $small={edge} />;
      })}
    </DotsRow>
  );
}

// One-time swipe cue: the pager is a native horizontal scroll, so nothing
// signals it is swipeable until you try. Fades out on the first swipe.
const Hint = styled.div<{ $gone: boolean }>`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 22px);
  transform: translateX(-50%);
  z-index: 12;
  padding: 9px 16px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  font: 600 12px/1 inherit;
  letter-spacing: 0.08em;
  white-space: nowrap;
  pointer-events: none;
  opacity: ${(p) => (p.$gone ? 0 : 1)};
  transition: opacity 0.4s ease;
  ${glassSurface}
`;

const RefreshPill = styled.div`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 68px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  padding: 9px 16px;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 12px/1 inherit;
  letter-spacing: 0.1em;
  white-space: nowrap;
  pointer-events: none;
  ${glassSurface}
`;

// Small round glass "i" next to the share button; only rendered when the
// active card declares a source. Sits below the swipe hint's pill (centered).
const InfoButton = styled.button`
  position: fixed;
  left: 68px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 17px/1 inherit;
  font-style: italic;
  font-family: Georgia, serif;
  cursor: pointer;
  ${glassSurface}
`;

// Round glass share button anchoring the bottom-left cluster (it is always
// available, while the "i" only shows when the card declares a source).
// Web Share sheet where available, PNG download otherwise.
const ShareButton = styled.button`
  position: fixed;
  left: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 18px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;

const MotionChip = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  padding: 12px 16px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 12px/1 inherit;
  letter-spacing: 0.08em;
  cursor: pointer;
  ${glassSurface}
`;

const TiltFrame = styled.div`
  flex: 1;
  display: flex;
  perspective: 1200px;
`;

const TiltLayer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SourceNote = styled.div`
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 70px);
  z-index: 12;
  padding: 12px 14px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.85);
  font: 400 13px/1.5 inherit;
  ${glassSurface}
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(3, 5, 9, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: backdrop-in 0.28s ease;

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const Sheet = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 31;
  padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 14px);
  border-radius: 22px 22px 0 0;
  ${glassSurface}
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  animation: sheet-up 0.28s ease;

  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

const Handle = styled.div`
  grid-column: 1 / -1;
  justify-self: center;
  width: 40px;
  height: 4px;
  margin: 2px 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
`;

const Option = styled.button<{ $active: boolean }>`
  padding: 14px 12px;
  border: none;
  border-radius: 12px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.75)')};
  font: 600 13px/1 inherit;
  letter-spacing: 0.1em;
  text-align: left;
  cursor: pointer;
`;

/**
 * Mobile view: no 3D ring at all — a filter plus a swipeable deck of cards,
 * each drawn straight to a 2D canvas. Far lighter than the WebGL carousel.
 */
export function MobileDeck() {
  // One theme is always active (the full 110-card pool is gone); like the 3D
  // view, the filter persists via URL param and localStorage.
  const [tag, setTag] = useTagFilter(TAGS[0].id);

  const dashboards = useMemo(
    () => ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag)),
    [tag],
  );

  const reducedMotion = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  // The background is either the shader canvas or the CSS blob layer — the
  // tilt parallax only needs *an* element, so the ref is width-typed and fed
  // through a callback (callback refs are contravariant, object refs aren't).
  const bgRef = useRef<HTMLElement | null>(null);
  const setBgRef = useCallback((el: HTMLElement | null) => {
    bgRef.current = el;
  }, []);
  // WebGL probe once per mount: shader aurora where possible, CSS blobs as
  // the fallback — and under reduced motion the (static) blobs always win.
  // The aurora can also bail at runtime (compile/link failure, lost context,
  // driver refusing the real context despite the probe) — then it hands the
  // slot back to the blobs instead of leaving a dead canvas.
  const [aurora, setAurora] = useState(hasWebGL);
  const disableAurora = useCallback(() => setAurora(false), []);
  // The background follows the front card's own chart color once it settles;
  // until then (and for ink-less cards) the theme accent carries the mood.
  const [cardTint, setCardTint] = useState<string | null>(null);
  const onCardColor = useCallback((c: string | null) => setCardTint(c), []);
  // Non-iOS grants implicitly.
  const [motion, setMotion] = useState<'granted' | 'ask' | 'denied'>(() => {
    if (!motionPermissionNeeded()) return 'granted';
    const stored = localStorage.getItem(MOTION_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'ask';
  });

  const askMotion = async () => {
    try {
      const res = await (DeviceOrientationEvent as DOEWithPermission).requestPermission?.();
      const next = res === 'granted' ? 'granted' : 'denied';
      localStorage.setItem(MOTION_KEY, next);
      setMotion(next);
    } catch {
      localStorage.setItem(MOTION_KEY, 'denied');
      setMotion('denied');
    }
  };

  // A previously granted iOS permission still needs a per-session
  // requestPermission() call, but it resolves silently — piggyback on the
  // first tap anywhere in the deck.
  useEffect(() => {
    if (!motionPermissionNeeded() || motion !== 'granted') return;
    const arm = () => void askMotion();
    window.addEventListener('pointerdown', arm, { once: true });
    return () => window.removeEventListener('pointerdown', arm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDeviceTilt(motion === 'granted' && !reducedMotion, tiltRef, bgRef);

  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Tooltip behavior for the source note: any tap outside the note or its
  // "i" button (both carry data-source-ui) dismisses it.
  useEffect(() => {
    if (!infoOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-source-ui]')) setInfoOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [infoOpen]);
  const [swiped, setSwiped] = useState(() => localStorage.getItem('worldpulse-swiped') === '1');
  const [refreshing, setRefreshing] = useState(false);
  // Stable identity: SwipeDeck holds this in a prop, and a fresh closure per
  // render would churn its internals for no reason.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshLiveData();
    } finally {
      // Always drop the pill — a throw must not leave it stuck on screen.
      setRefreshing(false);
    }
  }, [refreshing]);

  // Guard against same-index re-fires, and keep the identity stable via
  // useCallback: SwipeDeck's snap effect depends on onIndex, and a fresh
  // closure per parent render (e.g. the refresh pill toggling) would re-run
  // it with transition:'none' — killing the pull spring-back mid-flight.
  const lastIndex = useRef(0);
  const onIndex = useCallback(
    (i: number) => {
      setActive(i);
      if (i !== lastIndex.current) {
        lastIndex.current = i;
        setInfoOpen(false); // the note belongs to the card it was opened on
      }
      if (i > 0 && !swiped) {
        setSwiped(true);
        localStorage.setItem('worldpulse-swiped', '1');
      }
    },
    [swiped],
  );

  const current = dashboards[Math.min(active, dashboards.length - 1)];
  const source = current?.source;
  const activeTag = TAGS.find((t) => t.id === tag) ?? TAGS[0];
  const currentLabel = trans(activeTag.label);
  const pick = (next: string) => {
    setTag(next);
    setCardTint(null); // new theme, new deck — fall back to its accent
    setMenuOpen(false);
  };

  return (
    <Deck>
      {aurora && !reducedMotion ? (
        <MobileAurora ref={setBgRef} accent={cardTint ?? activeTag.accent} onFail={disableAurora} />
      ) : (
        <MobileBackground ref={setBgRef} accent={cardTint ?? activeTag.accent} />
      )}
      <TopBar>
        <FilterButton onClick={() => setMenuOpen(true)}>
          {currentLabel}
          <span aria-hidden>▾</span>
        </FilterButton>
        <Dots count={dashboards.length} active={Math.min(active, dashboards.length - 1)} />
      </TopBar>

      <TiltFrame>
        <TiltLayer ref={tiltRef}>
          <SwipeDeck key={tag} dashboards={dashboards} onIndex={onIndex} onRefresh={refresh} onColor={onCardColor} />
        </TiltLayer>
      </TiltFrame>

      {refreshing && <RefreshPill>{trans('Daten werden aktualisiert …')}</RefreshPill>}

      {!swiped && dashboards.length > 1 && <Hint $gone={false}>{trans('← wischen zum Blättern →')}</Hint>}

      {current && (
        <ShareButton aria-label={trans('Karte teilen')} onClick={() => void shareCard(current)}>
          <span aria-hidden>⤴</span>
        </ShareButton>
      )}
      {source && (
        <InfoButton
          data-source-ui
          aria-label={trans('Quelle anzeigen')}
          onClick={() => setInfoOpen((o) => !o)}
        >
          i
        </InfoButton>
      )}
      {infoOpen && source && (
        <SourceNote data-source-ui onClick={() => setInfoOpen(false)}>
          {trans('Quelle')}: {trans(source)}
        </SourceNote>
      )}

      {/* The swipe hint owns the bottom edge until the first swipe — showing
          both at once overlaps on narrow phones. */}
      {motion === 'ask' && (swiped || dashboards.length <= 1) && (
        <MotionChip onClick={askMotion}>{trans('Bewegungseffekte aktivieren')}</MotionChip>
      )}

      {menuOpen && (
        <>
          <Backdrop onClick={() => setMenuOpen(false)} />
          <Sheet>
            <Handle />
            {TAGS.map((t) => (
              <Option key={t.id} $active={tag === t.id} onClick={() => pick(t.id)}>
                {trans(t.label)}
              </Option>
            ))}
          </Sheet>
        </>
      )}
    </Deck>
  );
}
