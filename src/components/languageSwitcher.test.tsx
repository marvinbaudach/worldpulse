import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as i18n from '../i18n';
import { DeckActionMenu } from './DeckActionMenu';

// Guards the mobile language switch: every locale the app ships must be
// reachable *and* actually switch when its control is clicked in the action
// menu. Regression cover for the bug where only DE/EN could be picked while
// FR/IT stayed dead. (The desktop switch lives in the gallery toolbar and is
// covered by the e2e suite, language-switcher.desktop.spec.ts.)

// The plain two-letter code the menu uses. `de` is the source language, so we
// drive switches away from it and reset back before each case.
const SWITCH_TARGETS: readonly { locale: i18n.Locale; code: string }[] = [
  { locale: 'en', code: 'EN' },
  { locale: 'fr', code: 'FR' },
  { locale: 'it', code: 'IT' },
];

beforeEach(async () => {
  await i18n.setLocale('de');
});

afterEach(() => {
  cleanup();
});

describe('language switcher — mobile action menu', () => {
  const renderMenu = () =>
    render(
      <DeckActionMenu
        open
        onToggle={vi.fn()}
        onClose={vi.fn()}
        current={undefined}
        onShowSource={vi.fn()}
        onAskMotion={null}
      />,
    );

  it('offers every shipped locale', () => {
    renderMenu();
    const group = screen.getByRole('group', { name: /Sprache|Language|Langue|Lingua/i });
    for (const code of ['DE', 'EN', 'FR', 'IT']) {
      expect(within(group).getByRole('button', { name: code })).toBeTruthy();
    }
  });

  it.each(SWITCH_TARGETS)('switches the active locale to $locale on click', async ({ locale, code }) => {
    renderMenu();
    const group = screen.getByRole('group', { name: /Sprache|Language|Langue|Lingua/i });

    fireEvent.click(within(group).getByRole('button', { name: code }));

    await waitFor(() => expect(i18n.LOCALE).toBe(locale));
  });
});
