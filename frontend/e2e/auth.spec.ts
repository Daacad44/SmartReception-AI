import { test, expect } from '@playwright/test';

test.describe('Public pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /abuur akoon|create account/i })).toBeVisible();
  });

  test('unauthenticated users redirect to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot password continues after a message-only success response', async ({ page }) => {
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'If the email exists, a reset code has been sent',
        }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).fill('owner@clinic.com');
    await page.getByRole('button', { name: /send reset code/i }).click();

    await expect(page).toHaveURL(/\/reset-password\?email=owner%40clinic\.com/);
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await expect(page.getByText(/no data in response/i)).toHaveCount(0);
  });
});
