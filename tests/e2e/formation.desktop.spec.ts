import { test, expect } from '@playwright/test';
import { bootWithLocale, openSettings } from './helpers';

// Desktop formation switcher (HotkeyPanel FORMATION fold). The switch itself
// only shows up in the WebGL scene, but the panel rows carry the selected state
// via aria-pressed, so this guards that picking a formation — by click and by
// number hotkey — actually moves the active selection.

test.describe('desktop formation switcher', () => {
  test('marks the active formation and moves it on click', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openSettings(page);

    const ring = page.getByRole('button', { name: /RING/ });
    const helix = page.getByRole('button', { name: /HELIX/ });
    const sphere = page.getByRole('button', { name: /KUGEL/ });

    // Boots into the ring formation.
    await expect(ring).toHaveAttribute('aria-pressed', 'true');
    await expect(helix).toHaveAttribute('aria-pressed', 'false');

    await helix.click();
    await expect(helix).toHaveAttribute('aria-pressed', 'true');
    await expect(ring).toHaveAttribute('aria-pressed', 'false');
    await expect(sphere).toHaveAttribute('aria-pressed', 'false');
  });

  test('number keys pick a formation', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openSettings(page);

    const ring = page.getByRole('button', { name: /RING/ });
    const helix = page.getByRole('button', { name: /HELIX/ });
    const sphere = page.getByRole('button', { name: /KUGEL/ });

    await page.keyboard.press('3');
    await expect(sphere).toHaveAttribute('aria-pressed', 'true');
    await expect(ring).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('2');
    await expect(helix).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('1');
    await expect(ring).toHaveAttribute('aria-pressed', 'true');
    await expect(sphere).toHaveAttribute('aria-pressed', 'false');
  });
});
