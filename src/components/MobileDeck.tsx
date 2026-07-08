import { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { ALL_DASHBOARDS, NEWEST } from '../dashboards';
import { favoriteDashboards } from '../favorites';
import { refreshLiveData } from '../data/refresh';
import { useDeviceTilt } from '../hooks/useDeviceTilt';
import { useDismissOnOutsideTap } from '../hooks/useDismissOnOutsideTap';
import { useMotionPermission } from '../hooks/useMotionPermission';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useThemeFilter } from '../hooks/useThemeFilter';
import { t as trans } from '../i18n';
import { DeckActionMenu } from './DeckActionMenu';
import { Dots, DotsDock } from './DeckPager';
import { MobileAurora, hasWebGL } from './MobileAurora';
import { MobileBackground } from './MobileBackground';
import { SwipeDeck } from './SwipeDeck';
import { ThemeSheet } from './ThemeSheet';
import { glassSurface } from './glass';

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

/**
 * Mobile view: no 3D ring at all — a filter plus a swipeable deck of cards,
 * each drawn straight to a 2D canvas. Far lighter than the WebGL carousel.
 */
export function MobileDeck() {
  // One theme is always active (the full 110-card pool is gone); like the 3D
  // view, the filter persists via URL param and localStorage (shared
  // view-model, including the FAVORITEN fallback when the last star goes).
  const { tag, setTag, visibleTags } = useThemeFilter();

  // FAVORITEN is a snapshot taken when the chip is picked: un-starring while
  // browsing must not yank cards out from under the swipe. NEU shows the whole
  // pool newest-first; every other chip filters the clustered deck as usual.
  const dashboards = useMemo(() => {
    if (tag === 'favoriten') return favoriteDashboards();
    return tag === 'neu' ? NEWEST : ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag));
  }, [tag]);

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

  const { motion, askMotion } = useMotionPermission();
  useDeviceTilt(motion === 'granted' && !reducedMotion, tiltRef, bgRef);

  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Tooltip behavior for the source note and the action menu: any tap outside
  // the element (or the button that owns it) dismisses it.
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  useDismissOnOutsideTap(infoOpen, 'data-source-ui', closeInfo);
  useDismissOnOutsideTap(actionsOpen, 'data-actions-ui', closeActions);

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
  const activeTag = visibleTags.find((t) => t.id === tag) ?? visibleTags[0];
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
          {trans(activeTag.label)}
          <span aria-hidden>▾</span>
        </FilterButton>
      </TopBar>

      <TiltFrame>
        <TiltLayer ref={tiltRef}>
          <SwipeDeck key={tag} dashboards={dashboards} onIndex={onIndex} onRefresh={refresh} onColor={onCardColor} />
        </TiltLayer>
      </TiltFrame>

      {refreshing && <RefreshPill>{trans('Daten werden aktualisiert …')}</RefreshPill>}

      {/* The one-time swipe hint borrows the pager's spot: until the first
          swipe it IS the pagination affordance, then the dots take over. */}
      {swiped && (
        <DotsDock>
          <Dots count={dashboards.length} active={Math.min(active, dashboards.length - 1)} />
        </DotsDock>
      )}

      {!swiped && dashboards.length > 1 && <Hint $gone={false}>{trans('← wischen zum Blättern →')}</Hint>}

      <DeckActionMenu
        open={actionsOpen}
        onToggle={() => {
          setInfoOpen(false);
          setActionsOpen((o) => !o);
        }}
        onClose={closeActions}
        current={current}
        onShowSource={() => setInfoOpen(true)}
        onAskMotion={motion === 'ask' ? () => void askMotion() : null}
      />
      {infoOpen && source && (
        <SourceNote data-source-ui onClick={closeInfo}>
          {trans('Quelle')}: {trans(source)}
        </SourceNote>
      )}

      {menuOpen && (
        <ThemeSheet
          tags={visibleTags}
          active={tag}
          onPick={pick}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </Deck>
  );
}
