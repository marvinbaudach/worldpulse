// Dev-only review gallery — the frosted toolbar: search, category, sort, size,
// locale and a live-data reload, plus the count and the way back to the app.
// One glass bar over the aurora; every control shares the app's accent focus.

import styled from 'styled-components';
import { LOCALES, type Locale } from '../i18n';
import type { SortKey } from './galleryData';
import { TextInput, Select, Button, Label, DIM, INK, glassPanel } from './galleryChrome';

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
  onReloadLive: () => void;
  reloading: boolean;
  count: number;
  onClose: () => void;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'neueste' },
  { value: 'category', label: 'Kategorie' },
  { value: 'id', label: 'A–Z (id)' },
];

const SIZES: { value: number; label: string }[] = [
  { value: 220, label: 'S' },
  { value: 320, label: 'M' },
  { value: 460, label: 'L' },
];

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
  onReloadLive,
  reloading,
  count,
  onClose,
}: GalleryToolbarProps) {
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
        <Select value={category} onChange={(e) => onCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.value || 'all'} value={c.value}>
              {c.label} ({c.count})
            </option>
          ))}
        </Select>
      </Label>
      <Label>
        Sortierung
        <Select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Label>
      <Label>
        Größe
        <Select value={String(size)} onChange={(e) => onSize(Number(e.target.value))}>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Label>
      <Label>
        Sprache
        <Select value={locale} onChange={(e) => onLocale(e.target.value as Locale)}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </Select>
      </Label>
      <Button
        type="button"
        onClick={onReloadLive}
        disabled={reloading}
        title="Live-Daten neu laden und neu zeichnen"
        style={{ color: INK }}
      >
        🔄 {reloading ? 'lädt…' : 'Neu laden'}
      </Button>
      <Count>{count} Karten</Count>
    </Bar>
  );
}
