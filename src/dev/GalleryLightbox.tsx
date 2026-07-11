// Dev-only review gallery — the lightbox: a full 768×960 render of one card
// beside its metadata, with prev/next to walk the current filtered set, Esc /
// arrow keys, and a PNG export that reuses the app's poster renderer (so the QA
// download is byte-for-byte the mobile deck's share image).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { downloadCard } from '../exportCard';
import { drawCard, type CardEntry, type Category } from './galleryData';
import { Button, INK, DIM, ACCENT_RGB, glassPanel } from './galleryChrome';

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
  /* A cool accent bloom from the top over a deep dim — atmosphere behind the
     glass, so the whole view reads as lit rather than a flat scrim. */
  background:
    radial-gradient(
      120% 85% at 50% -5%,
      rgba(${ACCENT_RGB}, 0.14) 0%,
      rgba(2, 3, 7, 0.44) 52%
    );
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
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
  gap: 24px;
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
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 12px;
    background: #000;
    /* Crisp rim + deep drop + a soft accent halo so the card glows off the
       glass instead of sitting flat on it. */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 30px 80px -20px rgba(0, 0, 0, 0.7),
      0 0 72px -12px rgba(${ACCENT_RGB}, 0.34);
    animation: lbCardIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes lbCardIn {
    from {
      opacity: 0.3;
    }
  }
`;

const Info = styled.div`
  max-width: 340px;
  padding: 20px 22px;
  ${glassPanel}
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;

  h2 {
    font-size: 16px;
    margin: 0 0 10px;
    color: #fff;
    line-height: 1.3;
    text-shadow: 0 0 24px rgba(${ACCENT_RGB}, 0.4);
  }
  .row {
    margin: 6px 0;
    word-break: break-word;
    color: ${INK};
  }
  .k {
    color: ${DIM};
  }
  .src {
    margin-top: 14px;
    white-space: pre-wrap;
    color: ${DIM};
    font-size: 12px;
    line-height: 1.5;
  }
`;

const Nav = styled(Button)`
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 58px;
  font-size: 22px;
  justify-content: center;

  &:hover {
    transform: translateY(calc(-50% - 1px));
  }
`;

const Corner = styled(Button)`
  position: fixed;
  right: 16px;
`;

export function GalleryLightbox({
  list,
  index,
  redrawToken,
  categoryOf,
  onClose,
  onNavigate,
}: GalleryLightboxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const entry = list[index];

  // Paint before the browser shows the frame, so a navigation never flashes a
  // blank canvas; keyed on index (below) so the fade-in restarts each step.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && entry) drawCard(canvas, entry.card, FULL_W, FULL_H);
  }, [entry, redrawToken]);

  // Esc closes; arrows walk the set. Owned here so the grid stops moving focus
  // underneath (DevGallery gates the grid on the lightbox being closed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
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
  const added = entry.card.added ? entry.card.added.slice(0, 16).replace('T', ' ') : '—';

  return (
    <Overlay
      role="dialog"
      aria-modal="true"
      aria-label="Karten-Detailansicht"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Corner type="button" style={{ top: 16 }} onClick={onClose}>
        ✕ Esc
      </Corner>
      <Corner
        type="button"
        style={{ top: 58 }}
        disabled={downloading}
        onClick={() => void download()}
        aria-label="Karte als PNG herunterladen"
      >
        ⭳ PNG
      </Corner>
      {list.length > 1 && (
        <>
          <Nav
            type="button"
            style={{ left: 16 }}
            onClick={() => onNavigate(-1)}
            aria-label="Zurück"
          >
            ‹
          </Nav>
          <Nav
            type="button"
            style={{ right: 16 }}
            onClick={() => onNavigate(1)}
            aria-label="Weiter"
          >
            ›
          </Nav>
        </>
      )}
      <Stage>
        <canvas key={index} ref={canvasRef} width={FULL_W} height={FULL_H} />
        <Info>
          <h2>{entry.card.title}</h2>
          <div>
            <div className="row">
              <span className="k">id </span>
              {entry.card.id}
            </div>
            <div className="row">
              <span className="k"># </span>
              {entry.idx}
            </div>
            <div className="row">
              <span className="k">Kategorie </span>
              {cat ? cat.label : '—'}
            </div>
            <div className="row">
              <span className="k">hinzugefügt </span>
              {added}
            </div>
            <div className="row">
              <span className="k">tags </span>
              {entry.card.tags?.length ? entry.card.tags.join(' · ') : '—'}
            </div>
            <div className="row">
              <span className="k">Position </span>
              {index + 1} / {list.length}
            </div>
          </div>
          {entry.card.source && <div className="src">{entry.card.source}</div>}
        </Info>
      </Stage>
    </Overlay>
  );
}
