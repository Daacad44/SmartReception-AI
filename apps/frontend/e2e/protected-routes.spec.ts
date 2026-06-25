import { test, expect } from '@playwright/test';

test.describe('Protected routes', () => {
  test('customers page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/customers');
    await expect(page).toHaveURL(/\/login/);
  });

  test('appointments page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/login/);
  });

  test('knowledge page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page).toHaveURL(/\/login/);
  });

  test('billing page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveURL(/\/login/);
  });
});
