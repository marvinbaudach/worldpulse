// The desktop gallery's frosted toolbar: search, category, size and locale,
// plus the result count. One glass bar over the aubergine backdrop; every
// control shares the app's accent focus and the same glass dropdown, so the
// whole toolbar reads as one component system. Copy is authored in German and
// translated through t() like every other product surface.

import styled from 'styled-components';
import { LOCALES, t as tr, type Locale } from '../../i18n';
import { TextInput, Label, DIM, SPACE, glassPanel } from './galleryChrome';
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
  size: number;
  onSize: (v: number) => void;
  locale: Locale;
  onLocale: (v: Locale) => void;
  count: number;
}

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
  gap: ${SPACE.md} ${SPACE.xl};
  align-items: center;
  padding: ${SPACE.lg} ${SPACE.xxl};
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
  size,
  onSize,
  locale,
  onLocale,
  count,
}: GalleryToolbarProps) {
  const categoryOptions: GlassSelectOption[] = categories.map((c) => ({
    value: c.value,
    label: `${tr(c.label).toLowerCase()} (${c.count})`,
  }));

  return (
    <Bar>
      <TextInput
        type="search"
        placeholder={tr('Suche…')}
        autoComplete="off"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <Label>
        {tr('Kategorie')}
        <GlassSelect
          value={category}
          options={categoryOptions}
          onChange={onCategory}
          ariaLabel={tr('Kategorie filtern')}
          minWidth={150}
        />
      </Label>
      <Label>
        {tr('Größe')}
        <GlassSelect
          value={String(size)}
          options={SIZES}
          onChange={(v) => onSize(Number(v))}
          ariaLabel={tr('Kachelgröße')}
          minWidth={56}
        />
      </Label>
      <Label>
        {tr('Sprache')}
        <GlassSelect
          value={locale}
          options={LOCALE_OPTIONS}
          onChange={(v) => onLocale(v as Locale)}
          ariaLabel={tr('Sprache')}
          minWidth={56}
        />
      </Label>
      <Count>
        {count} {tr('Karten')}
      </Count>
    </Bar>
  );
}
