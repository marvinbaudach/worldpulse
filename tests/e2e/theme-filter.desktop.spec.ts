import { test, expect, type Page } from '@playwright/test';
import { bootWithLocale } from './helpers';

// Desktop theme filter (LayoutControls). The primary themes are always-visible
// chips; the rest live behind the MEHR ("more") popover. This guards the
// popover's open/close contract and that picking an overflow theme selects it
// (pulling it into the row as the active chip) and dismisses the menu.

const more = (page: Page) => page.getByRole('button', { name: /Weitere Themen/ });

test.describe('desktop theme filter', () => {
  test('the MEHR popover opens and closes on Escape', async ({ page }) => {
    await bootWithLocale(page, 'de');

    const trigger = more(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu', { name: /Weitere Themen/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
  });

  test('picking an overflow theme selects it and closes the menu', async ({ page }) => {
    await bootWithLocale(page, 'de');

    // Exactly one chip is active at boot.
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);

    const trigger = more(page);
    await trigger.click();

    const item = page.getByRole('menu', { name: /Weitere Themen/ }).getByRole('menuitem').first();
    const label = (await item.textContent())?.trim() ?? '';
    expect(label.length).toBeGreaterThan(0);
    await item.click();

    // Menu dismisses, and the chosen theme is now the active row chip.
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
