// Dev-only review gallery — the frosted toolbar: search, category, sort, size
// and locale, plus the count and the way back to the app. One glass bar over
// the aurora; every control shares the app's accent focus and the same glass
// dropdown, so the whole toolbar reads as one component system.

import styled from 'styled-components';
import { LOCALES, type Locale } from '../i18n';
import type { SortKey } from './galleryData';
import { TextInput, Button, Label, DIM, glassPanel } from './galleryChrome';
import { GlassSelect, type GlassSelectOption } from './GlassSelect';

export interface CategoryOption {
  value: string;
  label: string;
  count: number;
}

interface GalleryToolbarProps {
  query: string;
  onQuery: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  categories: CategoryOption[];
  sort: SortKey;
  onSort: (v: SortKey) => void;
  size: number;
  onSize: (v: number) => void;
  locale: Locale;
  onLocale: (v: Locale) => void;
  count: number;
  onClose: () => void;
}

const SORTS: GlassSelectOption[] = [
  { value: 'newest', label: 'neueste' },
  { value: 'category', label: 'Kategorie' },
  { value: 'id', label: 'A–Z (id)' },
];

const SIZES: GlassSelectOption[] = [
  { value: '220', label: 'S' },
  { value: '300', label: 'M' },
  { value: '380', label: 'L' },
];

const LOCALE_OPTIONS: GlassSelectOption[] = LOCALES.map((l) => ({
  value: l,
  label: l.toUpperCase(),
}));

const Bar = styled.div`
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
  padding: 12px 16px;
  ${glassPanel}
  border-radius: 0;
  border-width: 0 0 1px 0;
`;

const Count = styled.span`
  margin-left: auto;
  color: ${DIM};
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
`;

export function GalleryToolbar({
  query,
  onQuery,
  category,
  onCategory,
  categories,
  sort,
  onSort,
  size,
  onSize,
  locale,
  onLocale,
  count,
  onClose,
}: GalleryToolbarProps) {
  const categoryOptions: GlassSelectOption[] = categories.map((c) => ({
    value: c.value,
    label: `${c.label} (${c.count})`,
  }));

  return (
    <Bar>
      <Button type="button" onClick={onClose} aria-label="Zurück zur App">
        ← App
      </Button>
      <TextInput
        type="search"
        placeholder="Suche id / Titel…"
        autoComplete="off"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <Label>
        Kategorie
        <GlassSelect
          value={category}
          options={categoryOptions}
          onChange={onCategory}
          ariaLabel="Kategorie filtern"
          minWidth={150}
        />
      </Label>
      <Label>
        Sortierung
        <GlassSelect
          value={sort}
          options={SORTS}
          onChange={(v) => onSort(v as SortKey)}
          ariaLabel="Sortierung"
          minWidth={130}
        />
      </Label>
      <Label>
        Größe
        <GlassSelect
          value={String(size)}
          options={SIZES}
          onChange={(v) => onSize(Number(v))}
          ariaLabel="Kachelgröße"
          minWidth={56}
        />
      </Label>
      <Label>
        Sprache
        <GlassSelect
          value={locale}
          options={LOCALE_OPTIONS}
          onChange={(v) => onLocale(v as Locale)}
          ariaLabel="Sprache"
          minWidth={56}
        />
      </Label>
      <Count>{count} Karten</Count>
    </Bar>
  );
}
