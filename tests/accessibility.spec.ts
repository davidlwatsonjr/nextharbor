import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.failureSummary) }))).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`key screens meet automated accessibility checks in system ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue('system');
    await expect(page.locator('html')).toHaveCSS('background-color',
      colorScheme === 'dark' ? 'rgb(19, 27, 23)' : 'rgb(247, 248, 244)');
    const quickCapture = page.getByRole('textbox', { name: 'Quick capture' });
    await expect(quickCapture).toBeVisible();
    await audit(page);

    await quickCapture.fill('Send the agenda');
    await quickCapture.press('Enter');
    await page.getByRole('button', { name: 'Clarify Send the agenda' }).click();
    const editor = page.getByRole('dialog', { name: 'Clarify item' });
    await expect(editor.getByRole('radio').first()).toBeFocused();
    await editor.getByRole('radio', { name: /Next Actions/ }).check();
    await audit(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Clarify Send the agenda' })).toBeFocused();

    const navigation = page.getByRole('navigation', { name: 'Workspace' });
    await navigation.getByRole('button', { name: 'Weekly Review' }).click();
    await expect(page.getByRole('heading', { name: 'Weekly Review', level: 1 })).toBeFocused();
    await audit(page);
    await page.getByRole('button', { name: 'Data & backups' }).click();
    await expect(page.getByLabel('Choose backup')).toBeVisible();
    await audit(page);
  });
}

test('keyboard navigation and reflow at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const inbox = page.getByRole('heading', { name: 'Inbox', level: 1 });
  await expect(inbox).toBeFocused();

  const open = page.getByRole('button', { name: 'Open navigation' });
  await open.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => {
      const active = document.activeElement;
      return active === document.body || Boolean(active?.closest('#mobile-navigation'));
    })).toBe(true);
  }
  await audit(page);
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await page.keyboard.press('Enter');
  await drawer.getByRole('button', { name: 'Data & backups' }).click();
  await expect(page.getByRole('heading', { name: 'Data & backups', level: 1 })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await audit(page);
});
