// One card tile of the desktop gallery: a canvas thumbnail drawn by the shared
// engine under a shimmer skeleton until its first paint, plus a caption
// (#index · id · category chip · added date). Memoized so filtering/reordering
// the grid doesn't redraw untouched tiles; the canvas repaints only when its
// size or the redraw token (locale switch, live-data landing) changes.

import { memo, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { t as tr } from '../../i18n';
import { drawCard, type CardEntry, type Category } from './galleryData';
import { ACCENT, ACCENT_RGB, INK, DIM } from './galleryChrome';

interface GalleryThumbProps {
  entry: CardEntry;
  category: Category | undefined;
  /** Thumbnail width in CSS px (grid column width). */
  width: number;
  /** Thumbnail height in CSS px. */
  height: number;
  /** Bumped on locale switch / live-data update to force a repaint. */
  redrawToken: string;
  onOpen: (entry: CardEntry) => void;
  onContextMenu: (entry: CardEntry, x: number, y: number) => void;
  onRendered?: (id: string) => void;
}

const Figure = styled.figure<{ $w: number; $h: number }>`
  margin: 0;
  cursor: pointer;
  outline: none;
  /* Skip layout/paint for tiles scrolled out of view; the intrinsic size (tile
     width + caption) keeps the scrollbar stable until each row first renders. */
  content-visibility: auto;
  contain-intrinsic-size: auto ${(p) => p.$w}px auto ${(p) => p.$h + 54}px;

  canvas {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: #000;
    box-shadow:
      0 8px 24px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition:
      border-color 0.16s ease,
      box-shadow 0.16s ease;
  }
  /* Hover lights the tile rather than moving it — accent rim + globe-blue glow
     over a deepened drop, so it lifts off the grid. */
  &:hover canvas {
    border-color: ${ACCENT};
    box-shadow:
      0 0 0 1px rgba(${ACCENT_RGB}, 0.45),
      0 12px 30px -10px rgba(0, 0, 0, 0.6),
      0 0 28px rgba(${ACCENT_RGB}, 0.36);
  }
  &:focus-visible canvas {
    border-color: ${ACCENT};
    box-shadow:
      0 0 0 2px rgba(${ACCENT_RGB}, 0.6),
      0 0 28px rgba(${ACCENT_RGB}, 0.36);
  }
`;

const Caption = styled.figcaption`
  padding: 6px 2px 0;
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;

  .top {
    color: ${INK};
    word-break: break-all;
  }
  .idx {
    color: ${DIM};
  }
  .meta {
    margin-top: 4px;
    display: flex;
    gap: 8px;
    align-items: center;
    color: ${DIM};
  }
  .chip {
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: #05070c;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 1px 3px rgba(0, 0, 0, 0.35);
  }
`;

const CanvasWrap = styled.div`
  position: relative;
  border-radius: 12px;
  overflow: hidden;
`;

// Shimmer as an opacity pulse (compositor-only), not a background-position
// sweep — a dozen visible skeletons animating a paint property would repaint
// continuously during the one window where the grid is already busy drawing.
const Skeleton = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, #ffffff08 30%, #ffffff14 50%, #ffffff08 70%);
  animation: thumb-shimmer 1.4s ease-in-out infinite alternate;
  @keyframes thumb-shimmer {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

function GalleryThumbImpl({
  entry,
  category,
  width,
  height,
  redrawToken,
  onOpen,
  onContextMenu,
  onRendered,
}: GalleryThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const reported = useRef(false);

  // Stagger first paint across the full grid. This keeps the shell responsive,
  // makes each skeleton meaningful, and lets the determinate global progress
  // bar honestly reach 100% without requiring the visitor to scroll first.
  useEffect(() => {
    const id = window.setTimeout(() => setOnScreen(true), Math.min(entry.idx * 8, 1200));
    return () => window.clearTimeout(id);
  }, [entry.idx]);

  // Paint while on-screen. The drawn signature is remembered so scrolling a tile
  // out and back doesn't repaint (and flash) an unchanged canvas; a locale
  // switch or resize changes the signature, so on-screen tiles repaint while
  // off-screen ones stay stale until they return.
  const drawnKey = useRef('');
  useEffect(() => {
    if (!onScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const key = `${entry.card.id}|${width}|${height}|${redrawToken}`;
    if (drawnKey.current === key) return;
    drawCard(canvas, entry.card, width, height);
    drawnKey.current = key;
    setRendered(true);
    if (!reported.current) {
      reported.current = true;
      onRendered?.(entry.card.id);
    }
  }, [onScreen, entry.card, width, height, redrawToken, onRendered]);

  return (
    <Figure
      $w={width}
      $h={height}
      tabIndex={0}
      role="button"
      aria-label={`${entry.card.id} · ${tr('öffnen')}`}
      onClick={() => onOpen(entry)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(entry, e.clientX, e.clientY);
      }}
    >
      <CanvasWrap>
        <canvas ref={canvasRef} />
        {!rendered && <Skeleton aria-hidden />}
      </CanvasWrap>
      <Caption>
        <div className="top">
          <span className="idx">#{entry.idx} </span>
          {entry.card.id}
        </div>
        <div className="meta">
          {category && (
            <span className="chip" style={{ background: category.accent }}>
              {tr(category.label).toLowerCase()}
            </span>
          )}
          <span>{entry.card.added ? entry.card.added.slice(0, 10) : '—'}</span>
        </div>
      </Caption>
    </Figure>
  );
}

export const GalleryThumb = memo(GalleryThumbImpl);
