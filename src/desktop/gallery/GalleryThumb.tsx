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

// Tiles hold their canvas backing store only while near the viewport: ~230
// thumbs at dpr 2 would otherwise pin ~400 MB of canvas memory, which drags
// weaker machines to half refresh on the unfiltered grid. One shared
// IntersectionObserver per scroll root tells each tile when to (re)draw and
// when to release; the margin starts the redraw a full viewport early so even
// fast scrolling meets already-painted tiles (~36 live tiles ≈ 15 MB).
const NEAR_MARGIN = '100%';

type NearCallback = (isNear: boolean) => void;
const nearCallbacks = new WeakMap<Element, NearCallback>();
const observersByRoot = new Map<Element | null, IntersectionObserver>();

function scrollRoot(el: HTMLElement): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

/** Observe an element's proximity to its scroll viewport; returns unobserve. */
function observeNear(el: HTMLElement, cb: NearCallback): () => void {
  const root = scrollRoot(el);
  let observer = observersByRoot.get(root);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) nearCallbacks.get(e.target)?.(e.isIntersecting);
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    observersByRoot.set(root, observer);
  }
  nearCallbacks.set(el, cb);
  observer.observe(el);
  return () => {
    nearCallbacks.delete(el);
    observer.unobserve(el);
  };
}

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

// Sized by aspect ratio, not by the canvas: an unpainted <canvas> reports the
// browser default 300×150, so a height:auto tile would mount collapsed and
// jump to full height on first paint. Every card shares one ratio — locking it
// here means skeletons occupy the tile's final size from the first frame.
const CanvasWrap = styled.div<{ $w: number; $h: number }>`
  position: relative;
  aspect-ratio: ${(p) => p.$w} / ${(p) => p.$h};
  border-radius: 12px;
  overflow: hidden;
  background: #000;
`;

// Shimmer as a translateX sweep (compositor-only): a soft light band glides
// across the placeholder. Deliberately NOT a background-position animation —
// that would repaint every skeleton continuously during the one window where
// the grid is already busy drawing; transform stays off the paint path.
const Skeleton = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #ffffff0a;

  &::after {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 55%;
    background: linear-gradient(100deg, transparent, #ffffff24 50%, transparent);
    animation: thumb-sweep 1.6s ease-in-out infinite;
    will-change: transform;
  }
  @keyframes thumb-sweep {
    from {
      transform: translateX(-110%);
    }
    to {
      transform: translateX(300%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
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
  const figureRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [isNear, setIsNear] = useState(false);
  const [rendered, setRendered] = useState(false);
  const reported = useRef(false);

  // Stagger first paint across the full grid. This keeps the shell responsive,
  // makes each skeleton meaningful, and lets the determinate global progress
  // bar honestly reach 100% without requiring the visitor to scroll first.
  useEffect(() => {
    const id = window.setTimeout(() => setOnScreen(true), Math.min(entry.idx * 8, 1200));
    return () => window.clearTimeout(id);
  }, [entry.idx]);

  useEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    return observeNear(el, setIsNear);
  }, []);

  // Paint while near the viewport, release when far. The drawn signature is
  // remembered so an unchanged tile isn't repainted (and flashed); a locale
  // switch or resize changes the signature, so near tiles repaint while far
  // ones stay released until they return.
  const drawnKey = useRef('');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!onScreen || !canvas) return;
    const key = `${entry.card.id}|${width}|${height}|${redrawToken}`;
    if (isNear) {
      if (drawnKey.current === key) return;
      drawCard(canvas, entry.card, width, height);
      drawnKey.current = key;
      setRendered(true);
      if (!reported.current) {
        reported.current = true;
        onRendered?.(entry.card.id);
      }
      return;
    }
    // Far from the viewport: paint once so the load-progress bar stays honest
    // (the card provably draws), then drop the backing store right away.
    if (!reported.current) {
      drawCard(canvas, entry.card, width, height);
      reported.current = true;
      onRendered?.(entry.card.id);
    }
    if (canvas.width) {
      canvas.width = 0;
      canvas.height = 0;
    }
    drawnKey.current = '';
    setRendered(false);
  }, [onScreen, isNear, entry.card, width, height, redrawToken, onRendered]);

  return (
    <Figure
      ref={figureRef}
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
      <CanvasWrap $w={width} $h={height}>
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
