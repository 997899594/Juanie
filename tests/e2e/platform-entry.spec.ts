import { expect, test } from '@playwright/test';

test('login surface and startup probe are reachable', async ({ page, request }) => {
  const startup = await request.get('/api/health/startup');
  expect(startup.ok()).toBeTruthy();

  await page.goto('/login');
  await expect(page).toHaveTitle(/Juanie/u);
  await expect(page.locator('body')).toBeVisible();
});

test('unknown wake host fails closed without exposing internals', async ({ request }) => {
  const response = await request.get('/api/wake', {
    headers: { host: 'unknown.invalid' },
  });
  expect([404, 503]).toContain(response.status());
  expect(await response.text()).not.toContain('stack');
});
