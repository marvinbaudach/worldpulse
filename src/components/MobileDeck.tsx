import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { ALL_DASHBOARDS } from '../dashboards';
import { favoriteDashboards } from '../favorites';
import { refreshLiveData } from '../data/refresh';
import { useDeviceTilt } from '../hooks/useDeviceTilt';
import { useDismissOnOutsideTap } from '../hooks/useDismissOnOutsideTap';
import { useMotionPermission } from '../hooks/useMotionPermission';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useThemeFilter } from '../hooks/useThemeFilter';
import { t as trans } from '../i18n';
import { BuildBadge } from './BuildBadge';
import { DeckActionMenu } from './DeckActionMenu';
import { Dots, DotsDock } from './DeckPager';
import { FavPill } from './FavPill';
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

const RefreshPill = styled.div<{ $error?: boolean }>`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 68px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 999px;
  color: ${(p) => (p.$error ? '#ffb3ab' : '#cfe4ff')};
  font: 600 12px/1 inherit;
  letter-spacing: 0.1em;
  white-space: nowrap;
  pointer-events: none;
  ${glassSurface}
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.span`
  width: 12px;
  height: 12px;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(207, 228, 255, 0.25);
  border-top-color: #cfe4ff;
  animation: ${spin} 0.8s linear infinite;
  /* Static ring under reduced motion — the label carries the meaning. */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// How long the offline/error pill stays before it dismisses itself.
const ERROR_PILL_MS = 3500;

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
  /* Sits above the 56px action cluster (top at inset + 74px) with a gap. */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 86px);
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
  // browsing must not yank cards out from under the swipe. Every other chip
  // filters the clustered deck as usual.
  const dashboards = useMemo(() => {
    if (tag === 'favoriten') return favoriteDashboards();
    return ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag));
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
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'error'>('idle');
  // Stable identity: SwipeDeck holds this in a prop, and a fresh closure per
  // render would churn its internals for no reason.
  const refresh = useCallback(async () => {
    if (refreshState === 'loading') return;
    // Known-offline: skip the doomed fetches and say so right away.
    if (!navigator.onLine) {
      setRefreshState('error');
      return;
    }
    setRefreshState('loading');
    try {
      const anyLoaded = await refreshLiveData();
      setRefreshState(anyLoaded ? 'idle' : 'error');
    } catch {
      // A throw must not leave the spinner stuck on screen.
      setRefreshState('error');
    }
  }, [refreshState]);

  // The error pill dismisses itself — there is nothing to act on beyond
  // reading it, and it must not linger into the next successful pull.
  useEffect(() => {
    if (refreshState !== 'error') return;
    const id = setTimeout(() => setRefreshState('idle'), ERROR_PILL_MS);
    return () => clearTimeout(id);
  }, [refreshState]);

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

      {refreshState === 'loading' && (
        <RefreshPill>
          <Spinner aria-hidden />
          {trans('Daten werden aktualisiert …')}
        </RefreshPill>
      )}
      {refreshState === 'error' && (
        <RefreshPill $error role="alert">
          {trans('Keine Verbindung — Daten nicht aktualisiert')}
        </RefreshPill>
      )}

      {/* The one-time swipe hint borrows the pager's spot: until the first
          swipe it IS the pagination affordance, then the dots take over. */}
      {swiped && (
        <DotsDock>
          <Dots count={dashboards.length} active={Math.min(active, dashboards.length - 1)} />
        </DotsDock>
      )}

      {!swiped && dashboards.length > 1 && <Hint $gone={false}>{trans('← wischen zum Blättern →')}</Hint>}

      <FavPill current={current} />

      <BuildBadge />

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
