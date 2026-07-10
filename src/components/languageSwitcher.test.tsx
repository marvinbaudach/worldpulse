import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as i18n from '../i18n';
import { LAYOUT_MODES } from '../layouts';
import { HotkeyPanel } from './HotkeyPanel';
import { DeckActionMenu } from './DeckActionMenu';

// Guards the GUI language switch end to end: every locale the app ships must be
// reachable *and* actually switch when its control is clicked — on both the
// desktop settings panel and the mobile action menu. Regression cover for the
// bug where only DE/EN could be picked while FR/IT stayed dead (the fold clipped
// the lower rows so the scene canvas swallowed their clicks).

// The native label each locale carries in the desktop panel, and the plain
// two-letter code the mobile menu uses. `de` is the source language, so we drive
// switches away from it and reset back before each case.
const SWITCH_TARGETS: readonly { locale: i18n.Locale; label: RegExp; code: string }[] = [
  { locale: 'en', label: /English/, code: 'EN' },
  { locale: 'fr', label: /Français/, code: 'FR' },
  { locale: 'it', label: /Italiano/, code: 'IT' },
];

beforeEach(async () => {
  await i18n.setLocale('de');
});

afterEach(() => {
  cleanup();
});

describe('language switcher — desktop settings panel', () => {
  it('offers every shipped locale', () => {
    render(<HotkeyPanel layout={LAYOUT_MODES[0].id} onChange={vi.fn()} hidden={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));

    // All four locales, including FR and IT, must be present as controls.
    for (const label of [/Deutsch/, /English/, /Français/, /Italiano/]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it.each(SWITCH_TARGETS)('switches the active locale to $locale on click', async ({ locale, label }) => {
    render(<HotkeyPanel layout={LAYOUT_MODES[0].id} onChange={vi.fn()} hidden={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));

    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(i18n.LOCALE).toBe(locale));
  });
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
