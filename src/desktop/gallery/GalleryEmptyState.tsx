// Empty state for a filter combination that matches zero cards: a fan of ghost
// card skeletons in the glass idiom, the headline, an echo of what was searched
// so the dead end is explainable, and a one-click reset. Replaces the grid
// (Gallery renders one or the other), announced politely via role="status".

import styled, { css, keyframes } from 'styled-components';
import { t as tr } from '../../i18n';
import { Button, ACCENT_RGB, INK, DIM, RADIUS, SPACE, UI_FONT } from './galleryChrome';

interface GalleryEmptyStateProps {
  /** The (deferred) search text the empty list was computed from. */
  query: string;
  /** German label of the active category chip, if one is set. */
  categoryLabel?: string;
  onReset: () => void;
}

const appear = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const drift = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(-7px); }
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${SPACE.md};
  /* Fill the scroll area below the sticky toolbar (~64px) so the composition
     centers in the visible viewport instead of hanging in its upper third. */
  min-height: calc(100dvh - 64px);
  padding: ${SPACE.xxl};
  text-align: center;
  animation: ${appear} 0.35s ease-out both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Fan = styled.div`
  position: relative;
  width: 220px;
  height: 150px;
  margin-bottom: ${SPACE.lg};
`;

/** One ghost card: the grid tile's silhouette (same 4:5 portrait), dashed and
    hollow where a real card is dense — unmistakably "a card that isn't here". */
const ghostCss = css`
  position: absolute;
  left: 50%;
  top: 0;
  width: 96px;
  height: 120px;
  padding: 10px;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
  border-radius: ${RADIUS.menu};
  background: linear-gradient(158deg, rgba(32, 42, 62, 0.34) 0%, rgba(9, 12, 19, 0.3) 100%);
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.55);
`;

const GhostSide = styled.div<{ $r: number; $x: number }>`
  ${ghostCss}
  transform: translateX(calc(-50% + ${(p) => p.$x}px)) rotate(${(p) => p.$r}deg);
  opacity: 0.55;
`;

const GhostLead = styled.div`
  ${ghostCss}
  transform: translateX(-50%) translateY(-8px);
  border-color: rgba(${ACCENT_RGB}, 0.55);
  box-shadow: 0 12px 34px -12px rgba(0, 0, 0, 0.6);
  animation: ${drift} 3.2s ease-in-out infinite alternate;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/** Skeleton strokes inside a ghost — the card anatomy (eyebrow, title, chart)
    reduced to faint bars, echoing the loading skeletons' layout language. */
const Bone = styled.div<{ $w: string; $h?: string }>`
  width: ${(p) => p.$w};
  height: ${(p) => p.$h ?? '6px'};
  margin-bottom: 7px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
`;

const Headline = styled.p`
  margin: 0;
  color: ${INK};
  font: 600 16px/1.4 ${UI_FONT};
`;

const Hint = styled.p`
  margin: 0;
  color: ${DIM};
  font: 14px/1.4 ${UI_FONT};
`;

function Ghost() {
  return (
    <>
      <Bone $w="42%" />
      <Bone $w="80%" $h="8px" />
      <Bone $w="65%" />
      <Bone $w="100%" $h="34px" />
    </>
  );
}

export function GalleryEmptyState({ query, categoryLabel, onReset }: GalleryEmptyStateProps) {
  const parts: string[] = [];
  const q = query.trim();
  if (q) parts.push(`„${q}“`);
  if (categoryLabel) parts.push(tr(categoryLabel).toLowerCase());

  return (
    <Wrap role="status">
      <Fan aria-hidden="true">
        <GhostSide $r={-10} $x={-52}>
          <Ghost />
        </GhostSide>
        <GhostSide $r={9} $x={52}>
          <Ghost />
        </GhostSide>
        <GhostLead>
          <Ghost />
        </GhostLead>
      </Fan>
      <Headline>{tr('Keine Karten gefunden')}</Headline>
      {parts.length > 0 && (
        <Hint>
          {tr('Kein Treffer für')} {parts.join(' · ')}
        </Hint>
      )}
      <Button type="button" data-empty-reset onClick={onReset}>
        {tr('Filter zurücksetzen')}
      </Button>
    </Wrap>
  );
}
