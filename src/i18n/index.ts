// Lightweight i18n: the source language is German (all copy in the code stays
// German), and `t()` maps a German string to the visitor's browser language.
// Dictionaries are keyed by the exact German source string, so cards and
// components never deal with translation keys. Unknown strings fall through
// unchanged, so a missing entry can never blank out a panel.

import { EN } from './en';
import { FR } from './fr';
import { IT } from './it';

export type Locale = 'de' | 'en' | 'fr' | 'it';

const DICTS: Partial<Record<Locale, Record<string, string>>> = {
  en: EN,
  fr: FR,
  it: IT,
};

/** First browser-preferred language we support; English for everyone else. */
function detectLocale(): Locale {
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const lang of prefs) {
    const primary = lang?.slice(0, 2).toLowerCase();
    if (primary === 'de' || primary === 'en' || primary === 'fr' || primary === 'it') {
      return primary;
    }
  }
  return 'en';
}

export const LOCALE: Locale = detectLocale();

const TAGLINE: Record<Locale, string> = {
  de: '3D-Datenkarussell',
  en: '3D data carousel',
  fr: 'Carrousel de données 3D',
  it: 'Carosello di dati 3D',
};

if (typeof document !== 'undefined') {
  document.documentElement.lang = LOCALE;
  document.title = `Worldpulse · ${TAGLINE[LOCALE]}`;
}

/**
 * Translate a German UI string into the active locale. Falls back to
 * translating the ' · '-separated segments individually, so composed labels
 * like `Militärausgaben · 2025` still resolve their static parts while the
 * dynamic parts (years, numbers) pass through untouched.
 */
export function t(s: string): string {
  if (LOCALE === 'de' || !s) return s;
  const dict = DICTS[LOCALE];
  if (!dict) return s;
  const hit = dict[s];
  if (hit) return hit;
  if (s.includes(' · ')) {
    return s
      .split(' · ')
      .map((seg) => dict[seg] ?? seg)
      .join(' · ');
  }
  return s;
}

/** Locale-aware integer with thousands separators (12183 → "12.183"/"12,183"). */
export function localeInt(v: number): string {
  return Math.round(v).toLocaleString(LOCALE);
}
