// Shared theme-filter view-model for both stages (desktop ring and mobile
// deck): the persisted tag, the chips that are actually visible, and the
// FAVORITEN lifecycle rule. The views only differ in how they resolve a tag
// to a card set — that stays local to each.
import { useEffect } from 'react';
import { TAGS } from '../dashboards';
import { useFavorites } from './useFavorites';
import { useTagFilter } from './useTagFilter';

type Tag = (typeof TAGS)[number];

export const DEFAULT_TAG: string = TAGS[0].id;

interface ThemeFilter {
  tag: string;
  setTag: (t: string) => void;
  /** Starred card ids (live) — for star toggles and chip visibility. */
  favoriteIds: readonly string[];
  /** Chips to render: FAVORITEN only exists once something is starred. */
  visibleTags: Tag[];
}

export function useThemeFilter(): ThemeFilter {
  const [tag, setTag] = useTagFilter(DEFAULT_TAG);
  const favoriteIds = useFavorites();
  const visibleTags = TAGS.filter((t) => t.id !== 'favoriten' || favoriteIds.length > 0);

  // The FAVORITEN chip vanishes when the last star is removed; if that theme
  // is active at that moment, glide back to the default one.
  useEffect(() => {
    if (tag === 'favoriten' && favoriteIds.length === 0) setTag(DEFAULT_TAG);
  }, [tag, favoriteIds, setTag]);

  return { tag, setTag, favoriteIds, visibleTags };
}
