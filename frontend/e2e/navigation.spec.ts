import { test, expect } from '@playwright/test';

test.describe('Public navigation', () => {
  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot|reset/i })).toBeVisible();
  });

  test('verify OTP page loads', async ({ page }) => {
    await page.goto('/verify-otp');
    await expect(page.getByRole('heading', { name: /verify/i })).toBeVisible();
  });
});

test.describe('Protected route redirects', () => {
  const protectedPaths = [
    '/team',
    '/analytics',
    '/settings',
    '/conversations',
  ];

  for (const path of protectedPaths) {
    test(`${path} redirects unauthenticated users to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
