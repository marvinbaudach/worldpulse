// Dev-only review gallery — the responsive thumbnail grid with keyboard
// navigation: Tab into the grid, arrows move by the live column count, Home/End
// jump to the ends, Enter/Space opens the focused card in the lightbox.

import { useRef } from 'react';
import styled from 'styled-components';
import { GalleryThumb } from './GalleryThumb';
import type { CardEntry, Category } from './galleryData';

interface GalleryGridProps {
  list: CardEntry[];
  width: number;
  height: number;
  redrawToken: string;
  categoryOf: (tag: string) => Category | undefined;
  /** False while the lightbox owns the arrow keys — the grid stops moving. */
  keyboardActive: boolean;
  onOpen: (entry: CardEntry) => void;
  onContextMenu: (entry: CardEntry, x: number, y: number) => void;
}

const Grid = styled.div<{ $tw: number }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${(p) => p.$tw}px, 1fr));
  gap: 22px;
  padding: 22px;
  align-items: start;
`;

/** Columns the auto-fill grid currently lays out — needed for row-wise (up/down)
    movement, which depends on the responsive column count. */
function columnCount(grid: HTMLElement): number {
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  return Math.max(1, cols);
}

export function GalleryGrid({
  list,
  width,
  height,
  redrawToken,
  categoryOf,
  keyboardActive,
  onOpen,
  onContextMenu,
}: GalleryGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!keyboardActive) return;
    const grid = gridRef.current;
    if (!grid) return;
    const figures = grid.children;
    if (!figures.length) return;
    const current = Array.prototype.indexOf.call(figures, document.activeElement);

    if (e.key === 'Enter' || e.key === ' ') {
      if (current >= 0 && list[current]) {
        e.preventDefault();
        onOpen(list[current]);
      }
      return;
    }

    const cols = columnCount(grid);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = current < 0 ? 0 : current + 1;
    else if (e.key === 'ArrowLeft') next = current < 0 ? 0 : current - 1;
    else if (e.key === 'ArrowDown') next = current < 0 ? 0 : current + cols;
    else if (e.key === 'ArrowUp') next = current < 0 ? 0 : current - cols;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = figures.length - 1;

    if (next !== null) {
      e.preventDefault();
      const clamped = Math.max(0, Math.min(figures.length - 1, next));
      const el = figures[clamped] as HTMLElement;
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <Grid ref={gridRef} $tw={width} onKeyDown={handleKeyDown}>
      {list.map((entry) => (
        <GalleryThumb
          key={entry.card.id}
          entry={entry}
          category={categoryOf(entry.primaryTag)}
          width={width}
          height={height}
          redrawToken={redrawToken}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </Grid>
  );
}
