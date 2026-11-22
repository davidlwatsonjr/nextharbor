import { expect, test } from '@playwright/test';

test('Chromium accepts the production app for installation and can reopen it offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const devTools = await context.newCDPSession(page);
  const { installabilityErrors } = await devTools.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);

  const quickCapture = page.getByRole('textbox', { name: 'Quick capture' });
  await quickCapture.fill('Check the offline workspace');
  await quickCapture.press('Enter');
  const saved = page.getByRole('button', { name: 'Clarify Check the offline workspace' });
  await expect(saved).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(saved).toBeVisible();
    await quickCapture.fill('Capture while offline');
    await quickCapture.press('Enter');
    await expect(page.getByRole('button', { name: 'Clarify Capture while offline' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
