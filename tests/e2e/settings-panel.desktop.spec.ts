import { test, expect } from '@playwright/test';
import { bootWithLocale, openSettings, settingsToggle } from './helpers';

// Desktop settings panel (HotkeyPanel) shell behaviour: the popover open/close,
// the accordion folds, the "?" / "/" discovery hotkey, and outside-tap dismiss.
// These are the interactions the language-switch regression lived inside, so
// they get their own guard independent of the locale assertions.

test.describe('desktop settings panel', () => {
  test('toggles open and closed from the gear button', async ({ page }) => {
    await bootWithLocale(page, 'de');

    const toggle = settingsToggle(page);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: /Einstellungen/ })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('accordion folds expand and collapse independently', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openSettings(page);

    const formation = page.getByRole('button', { name: /FORMATION/ });
    const controls = page.getByRole('button', { name: /STEUERUNG/ });

    // FORMATION opens by default so the switchers sit above the fold; the long
    // STEUERUNG hint list starts collapsed.
    await expect(formation).toHaveAttribute('aria-expanded', 'true');
    await expect(controls).toHaveAttribute('aria-expanded', 'false');

    await controls.click();
    await expect(controls).toHaveAttribute('aria-expanded', 'true');
    // Opening one fold must not close another — they are independent.
    await expect(formation).toHaveAttribute('aria-expanded', 'true');

    await formation.click();
    await expect(formation).toHaveAttribute('aria-expanded', 'false');
    await expect(controls).toHaveAttribute('aria-expanded', 'true');
  });

  test('the "/" hotkey folds the panel while a control has focus', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const toggle = settingsToggle(page);

    // Open via the gear so focus lands on the toggle button. The "?" / "/"
    // shortcut then folds the panel from the keyboard. NB: Firefox reserves "/"
    // for its Quick-Find bar while the page body holds focus, so the shortcut
    // only reaches the app once a control is focused — which the click ensures.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('/');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('/');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('an outside tap dismisses the open panel', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const toggle = settingsToggle(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Empty sky above the orbiting cards — a pointerdown here is outside the
    // panel, so it closes it (and misses every card, so no hero opens).
    await page.mouse.click(640, 64);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
