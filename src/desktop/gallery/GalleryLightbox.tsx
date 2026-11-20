// The desktop gallery's lightbox: a full 768×960 render of one card beside
// its metadata and detail notes, with prev/next to walk the current filtered
// set, Esc / arrow keys, and a PNG export that reuses the app's poster
// renderer (so the download is byte-for-byte the mobile deck's share image).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { INTRO_S } from '../../dashboards';
import { downloadCard } from '../../exportCard';
import { t as tr } from '../../i18n';
import { drawCard, type CardEntry, type Category } from './galleryData';
import { Button, INK, DIM, SPACE, UI_FONT, glassPanel } from './galleryChrome';
import { ChevronIcon, CloseIcon, DownloadIcon } from './galleryIcons';

const FULL_W = 768;
const FULL_H = 960;

interface GalleryLightboxProps {
  list: CardEntry[];
  index: number;
  redrawToken: string;
  categoryOf: (tag: string) => Category | undefined;
  onClose: () => void;
  onNavigate: (delta: number) => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  /* A uniform near-black dim, deliberately without a backdrop-filter: the
     blur re-ran on every fly-in frame (the canvas damages the filter region)
     and stuttered the intro on real hardware. */
  background: rgba(2, 3, 7, 0.96);
  animation: lbFade 200ms ease;

  @keyframes lbFade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Stage = styled.div`
  margin: auto;
  display: flex;
  gap: ${SPACE.xxl};
  align-items: flex-start;
  padding: 28px 64px;
  max-width: 100%;
  max-height: 100%;
  animation: lbRise 320ms cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes lbRise {
    from {
      transform: scale(0.955) translateY(10px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  canvas {
    display: block;
    /* Auto width+height bounded by BOTH maxes: the browser scales the card
       down (never up past its 768×960 intrinsic) to fit the viewport while
       preserving aspect — an explicit height alone kept the card at full size
       and overflowed short viewports. */
    width: auto;
    height: auto;
    max-width: min(58vw, 640px);
    max-height: 88vh;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px;
    background: #000;
    /* The dim behind is near-black, so a dark drop alone does nothing there:
       the rim border plus one neutral light lift the card off it. */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 30px 80px -20px rgba(0, 0, 0, 0.7),
      0 0 60px rgba(255, 255, 255, 0.08);
    animation: lbCardIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes lbCardIn {
    from {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    canvas {
      animation: none;
    }
  }
`;

const Info = styled.div`
  width: 340px;
  max-width: 340px;
  max-height: 88vh;
  overflow-y: auto;
  /* Keep wheel momentum inside the panel. */
  overscroll-behavior: contain;
  padding: ${SPACE.xl};
  ${glassPanel}
  font: 14px/1.5 ${UI_FONT};
  color: ${INK};

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 ${SPACE.xs};
    color: #fff;
    line-height: 1.3;
    text-wrap: balance;
  }
  .meta {
    margin: 0;
    color: ${DIM};
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .detail {
    margin-top: ${SPACE.lg};
    font-size: 13px;
    line-height: 1.55;
  }
  .detail p {
    margin: 0 0 ${SPACE.sm};
    color: ${INK};
  }
  /* Same semantic tones as the mobile detail sheet. */
  .dl {
    margin: ${SPACE.md} 0 ${SPACE.xs};
    font-size: 12px;
    font-weight: 600;
  }
  .dl.pro { color: #8fd694; }
  .dl.kontra { color: #ffb3ab; }
  .dl.hinweis { color: #ffd98a; }
  .detail ul {
    margin: 0;
    padding-left: ${SPACE.lg};
    color: ${INK};
  }
  .detail li {
    margin: 2px 0;
  }
  .src {
    margin-top: ${SPACE.lg};
    white-space: pre-wrap;
    color: ${DIM};
    font-size: 12px;
    line-height: 1.55;
  }
`;

const Nav = styled(Button)`
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 58px;
  justify-content: center;
`;

const Corner = styled(Button)`
  position: fixed;
  right: 16px;
  min-width: 104px;
  justify-content: flex-start;
`;

/** Keeps Tab / Shift+Tab inside `root`: wraps at either end and pulls focus
    back in if it ever sits outside the dialog. */
function trapTab(e: KeyboardEvent, root: HTMLElement | null): void {
  if (!root) return;
  const stops = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
  if (stops.length === 0) return;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;
  if (!(active instanceof Node) || !root.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

export function GalleryLightbox({
  list,
  index,
  redrawToken,
  categoryOf,
  onClose,
  onNavigate,
}: GalleryLightboxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [downloading, setDownloading] = useState(false);
  const entry = list[index];
  // The unmount cleanup below runs once, so it reads the card currently shown
  // through a ref instead of closing over the one that was open at mount.
  const currentId = useRef<string | undefined>(entry?.card.id);
  const entryId = entry?.card.id;
  useEffect(() => {
    currentId.current = entryId;
  }, [entryId]);

  // Paint before the browser shows the frame, so a navigation never flashes a
  // blank canvas — then replay the deck's fly-in: sweep the draw progress `t`
  // from 0 to the settled frame, on open and on every prev/next step (the
  // effect re-runs per entry; the canvas is keyed on the card id below, so the
  // CSS fade restarts too and a list change that only shifts the index keeps
  // the painted canvas). Reduced motion keeps the instant settled frame.
  const isSettled = useRef(false);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entry) return;
    isSettled.current = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawCard(canvas, entry.card, FULL_W, FULL_H);
      isSettled.current = true;
      return;
    }
    // The canvas displays well below its 768×960 intrinsic size (CSS caps it
    // at min(58vw, 640px) / 88vh), so animating the full backing store rasters
    // and uploads ~4× more pixels per frame than are visible — enough to
    // stutter. Intro frames render at the displayed size instead (the vector
    // draws scale via `u`); only the settled lock renders the full backing.
    // Captured once so the intrinsic-size change can't feed back into layout.
    const introW = canvas.clientWidth || FULL_W;
    const introH = canvas.clientHeight || FULL_H;
    drawCard(canvas, entry.card, introW, introH, 0);
    let raf = 0;
    let start = 0;
    const tick = (now: number): void => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      if (t < INTRO_S) {
        drawCard(canvas, entry.card, introW, introH, t);
        raf = requestAnimationFrame(tick);
      } else {
        drawCard(canvas, entry.card, FULL_W, FULL_H); // lock the settled frame
        isSettled.current = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entry]);

  // Locale switches and live-data updates bump redrawToken every time a
  // dataset (or the once-a-second tick) lands. Repaint the settled frame then
  // — but never restart the intro, and skip while it still plays (its rAF loop
  // repaints each frame anyway, so fresh data lands on the next sweep).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && entry && isSettled.current) drawCard(canvas, entry.card, FULL_W, FULL_H);
  }, [entry, redrawToken]);

  // Focus belongs to the dialog while it is open: it lands on the close button,
  // and goes back to the tile of the card on show when the lightbox unmounts
  // (the opener if that tile is gone, else the first tile, else the empty
  // state's reset button when the filter left no tiles at all).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      const tiles = document.querySelectorAll<HTMLElement>('[data-card-id]');
      const current = Array.from(tiles).find((tile) => tile.dataset.cardId === currentId.current);
      const resetButton = document.querySelector<HTMLElement>('[data-empty-reset]');
      const target = current ?? (opener?.isConnected ? opener : (tiles[0] ?? resetButton));
      target?.focus();
    };
  }, []);

  // Esc closes; arrows walk the set; Tab cycles inside the dialog. Owned here
  // so the grid stops moving focus underneath (Gallery gates the grid on the
  // lightbox being closed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
      else if (e.key === 'Tab') trapTab(e, dialogRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  if (!entry) return null;

  const download = async (): Promise<void> => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadCard(entry.card);
    } catch (err) {
      console.error('Card-Export fehlgeschlagen', err);
    } finally {
      setDownloading(false);
    }
  };

  const cat = categoryOf(entry.primaryTag);
  const meta = [cat ? tr(cat.label).toLowerCase() : null, `${index + 1} / ${list.length}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Overlay
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={tr('Karten-Detailansicht')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Corner ref={closeRef} type="button" style={{ top: 16 }} onClick={onClose}>
        <CloseIcon />
        {tr('Schließen')}
      </Corner>
      <Corner
        type="button"
        style={{ top: 58 }}
        disabled={downloading}
        onClick={() => void download()}
        aria-label={tr('Karte als PNG herunterladen')}
      >
        <DownloadIcon />
        PNG
      </Corner>
      {list.length > 1 && (
        <>
          <Nav
            type="button"
            style={{ left: 16 }}
            onClick={() => onNavigate(-1)}
            aria-label={tr('Zurück')}
          >
            <ChevronIcon dir="prev" />
          </Nav>
          <Nav
            type="button"
            style={{ right: 16 }}
            onClick={() => onNavigate(1)}
            aria-label={tr('Weiter')}
          >
            <ChevronIcon dir="next" />
          </Nav>
        </>
      )}
      <Stage>
        <canvas key={entry.card.id} ref={canvasRef} width={FULL_W} height={FULL_H} />
        <Info>
          <h2>{tr(entry.card.title)}</h2>
          <p className="meta">{meta}</p>
          {entry.card.detail && (
            <div className="detail">
              {entry.card.detail.kontext && <p>{tr(entry.card.detail.kontext)}</p>}
              {entry.card.detail.pro?.length ? (
                <>
                  <div className="dl pro">{tr('Was die Daten zeigen')}</div>
                  <ul>
                    {entry.card.detail.pro.map((p) => (
                      <li key={p}>{tr(p)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {entry.card.detail.kontra?.length ? (
                <>
                  <div className="dl kontra">{tr('Was sie nicht zeigen')}</div>
                  <ul>
                    {entry.card.detail.kontra.map((k) => (
                      <li key={k}>{tr(k)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {entry.card.detail.hinweise?.length ? (
                <>
                  <div className="dl hinweis">{tr('Hinweise der Autoren')}</div>
                  <ul>
                    {entry.card.detail.hinweise.map((h) => (
                      <li key={h}>{tr(h)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}
          {entry.card.source && <div className="src">{entry.card.source}</div>}
        </Info>
      </Stage>
    </Overlay>
  );
}
