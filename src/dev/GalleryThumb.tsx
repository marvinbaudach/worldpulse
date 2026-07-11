// Dev-only review gallery — one card tile: a canvas thumbnail drawn by the
// shared engine, plus a caption (#index · id · category chip · added date).
// Memoized so filtering/reordering the grid doesn't redraw untouched tiles;
// the canvas repaints only when its size or the redraw token (locale switch,
// live-data landing) changes.

import { memo, useEffect, useRef } from 'react';
import styled from 'styled-components';
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
}

const Figure = styled.figure`
  margin: 0;
  cursor: pointer;
  outline: none;

  canvas {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    background: #000;
    transition:
      border-color 0.16s ease,
      box-shadow 0.16s ease;
  }
  /* Hover lights the tile rather than moving it — accent rim + globe-blue glow. */
  &:hover canvas {
    border-color: ${ACCENT};
    box-shadow:
      0 0 0 1px rgba(${ACCENT_RGB}, 0.45),
      0 0 24px rgba(${ACCENT_RGB}, 0.32);
  }
  &:focus-visible canvas {
    border-color: ${ACCENT};
    box-shadow:
      0 0 0 2px rgba(${ACCENT_RGB}, 0.6),
      0 0 24px rgba(${ACCENT_RGB}, 0.32);
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
}: GalleryThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawCard(canvas, entry.card, width, height);
  }, [entry.card, width, height, redrawToken]);

  return (
    <Figure
      tabIndex={0}
      role="button"
      aria-label={`${entry.card.id} öffnen`}
      onClick={() => onOpen(entry)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(entry, e.clientX, e.clientY);
      }}
    >
      <canvas ref={canvasRef} />
      <Caption>
        <div className="top">
          <span className="idx">#{entry.idx} </span>
          {entry.card.id}
        </div>
        <div className="meta">
          {category && (
            <span className="chip" style={{ background: category.accent }}>
              {category.label.toLowerCase()}
            </span>
          )}
          <span>{entry.card.added ? entry.card.added.slice(0, 10) : '—'}</span>
        </div>
      </Caption>
    </Figure>
  );
}

export const GalleryThumb = memo(GalleryThumbImpl);
