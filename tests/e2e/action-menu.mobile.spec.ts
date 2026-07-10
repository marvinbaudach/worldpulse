import { test, expect } from '@playwright/test';
import { actionsToggle, bootWithLocale, openActions } from './helpers';

// Mobile action menu (DeckActionMenu) shell behaviour: the "⋯" context button
// opens a glass popover gathering the card actions and the language switcher.
// This guards the open/close contract and the menu's contents, independent of
// the locale-switch assertions in language-switcher.mobile.spec.ts.

test.describe('mobile action menu', () => {
  test('the ⋯ button toggles the menu open and closed', async ({ page }) => {
    await bootWithLocale(page, 'de');

    const toggle = actionsToggle(page);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('group', { name: /Sprache/i })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('group', { name: /Sprache/i })).toBeHidden();
  });

  test('marks the active locale in the language row', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openActions(page);

    const group = page.getByRole('group', { name: /Sprache/i });
    await expect(group.getByRole('button', { name: 'DE', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const code of ['EN', 'FR', 'IT']) {
      await expect(group.getByRole('button', { name: code, exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });
});
