// The production desktop UI: the card grid, lightbox, filters and the
// determinate load progress, rendered in frosted glass over the aubergine
// backdrop (mounted by DesktopApp). Grew out of the former dev review gallery;
// mobile/tablet ships the swipe deck instead (see mobile/MobileApp).

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { onLiveUpdate } from '../../data/store';
import { LOCALE, onLocaleChange, setLocale, type Locale } from '../../i18n';
import {
  buildEntries,
  filterSort,
  CATEGORIES,
  type CardEntry,
  type Category,
} from './galleryData';
import { ACCENT } from './galleryChrome';
import { GalleryToolbar, type CategoryOption } from './GalleryToolbar';
import { GalleryGrid } from './GalleryGrid';
import { GalleryLightbox } from './GalleryLightbox';
import { GalleryCardMenu, GalleryToast, type CardMenuState } from './GalleryCardMenu';
import { ProgressBar } from './GallerySkeletons';
import { progressPct } from './progress';

interface GalleryProps {
  /** Fired from the category handler so DesktopApp can tint the backdrop. */
  onAccentChange?: (accent: string) => void;
}

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1;
  color-scheme: dark;
`;

const Scroll = styled.div`
  position: relative;
  z-index: 1;
  height: 100%;
  overflow-y: auto;
`;

const FULL_RATIO = 960 / 768;
const TOAST_MS = 1400;

export default function Gallery({ onAccentChange }: GalleryProps) {
  const entries = useMemo(() => buildEntries(), []);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState('');
  const [size, setSize] = useState(300);

  // Category picks also retint the backdrop — notified from the handler (not
  // an effect), so there is no extra render round-trip through the parent.
  const changeCategory = useCallback(
    (id: string) => {
      setCategory(id);
      onAccentChange?.((id && CATEGORIES.get(id)?.accent) || ACCENT);
    },
    [onAccentChange],
  );

  // Load progress, owned where the list lives: painted-once ids accumulate in
  // a ref and are flushed to state at most once per frame; the numerator only
  // counts ids in the *current* filtered list, so filtering mid-load re-bases
  // the bar instead of stranding it below 100% forever (filtered-out tiles
  // unmount without ever painting). A hidden tab throttles the paint stagger —
  // the bar then just sits at its honest partial value until focus returns.
  const doneRef = useRef<Set<string>>(new Set());
  const rafRef = useRef(0);
  const [progressTick, setProgressTick] = useState(0);
  const onThumbRendered = useCallback((id: string) => {
    doneRef.current.add(id);
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setProgressTick((t) => t + 1);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const [locale, setLoc] = useState<Locale>(LOCALE);
  useEffect(() => onLocaleChange(setLoc), []);
  const onLocale = useCallback((l: Locale) => void setLocale(l), []);

  // A repaint token: locale switches and (coalesced) live-data updates bump it,
  // and every mounted thumbnail + the lightbox redraw when it changes.
  const [redrawTick, setRedrawTick] = useState(0);
  useEffect(() => {
    let queued = false;
    return onLiveUpdate(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setRedrawTick((t) => t + 1);
      });
    });
  }, []);
  const redrawToken = `${locale}:${redrawTick}`;

  const list = useMemo(
    () => filterSort(entries, { query: deferredQuery, category, sort: 'newest' }),
    [entries, deferredQuery, category],
  );

  // progressTick invalidates the memo when new paints land; the ref itself is
  // stable, so it must ride the dep array as an explicit repaint token.
  const rendered = useMemo(
    () => list.reduce((n, e) => n + (doneRef.current.has(e.card.id) ? 1 : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progressTick is the invalidation token for doneRef
    [list, progressTick],
  );
  const pct = progressPct(rendered, list.length);

  const categories = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.primaryTag, (counts.get(e.primaryTag) ?? 0) + 1);
    // Labels stay the German TAGS originals; the toolbar translates through
    // t() (which knows the uppercase keys) and lowercases for display.
    const opts: CategoryOption[] = [{ value: '', label: 'alle', count: entries.length }];
    for (const [id, cat] of CATEGORIES) {
      const n = counts.get(id);
      if (n) opts.push({ value: id, label: cat.label, count: n });
    }
    return opts;
  }, [entries]);

  const categoryOf = useCallback((tag: string): Category | undefined => CATEGORIES.get(tag), []);

  // Lightbox: an index into the current filtered list (null = closed).
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const openCard = useCallback((entry: CardEntry) => setLbIndex(list.indexOf(entry)), [list]);
  const navigate = useCallback(
    (delta: number) =>
      setLbIndex((i) => (i === null ? i : (i + delta + list.length) % list.length)),
    [list.length],
  );
  const closeLightbox = useCallback(() => setLbIndex(null), []);
  // Filtering can shrink the list under an open lightbox — keep the index valid.
  useEffect(() => {
    setLbIndex((i) => (i !== null && i >= list.length ? (list.length ? list.length - 1 : null) : i));
  }, [list.length]);

  const [menu, setMenu] = useState<CardMenuState | null>(null);
  const openMenu = useCallback(
    (entry: CardEntry, x: number, y: number) => setMenu({ card: entry.card, x, y }),
    [],
  );
  const closeMenu = useCallback(() => setMenu(null), []);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const height = Math.round(size * FULL_RATIO);

  return (
    <Root>
      <ProgressBar pct={pct} />
      <Scroll>
        <GalleryToolbar
          query={query}
          onQuery={setQuery}
          category={category}
          onCategory={changeCategory}
          categories={categories}
          size={size}
          onSize={setSize}
          locale={locale}
          onLocale={onLocale}
          count={list.length}
        />
        <GalleryGrid
          list={list}
          width={size}
          height={height}
          redrawToken={redrawToken}
          categoryOf={categoryOf}
          keyboardActive={lbIndex === null}
          onOpen={openCard}
          onContextMenu={openMenu}
          onRendered={onThumbRendered}
        />
      </Scroll>
      {lbIndex !== null && list.length > 0 && (
        <GalleryLightbox
          list={list}
          index={Math.min(lbIndex, list.length - 1)}
          redrawToken={redrawToken}
          categoryOf={categoryOf}
          onClose={closeLightbox}
          onNavigate={navigate}
        />
      )}
      {menu && <GalleryCardMenu menu={menu} onClose={closeMenu} onToast={setToast} />}
      {toast && <GalleryToast message={toast} />}
    </Root>
  );
}
