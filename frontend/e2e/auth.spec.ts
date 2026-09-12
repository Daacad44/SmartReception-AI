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

  test('forgot password continues when API returns message-only success', async ({ page }) => {
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
    await page.getByLabel(/^email$/i).fill('daacaddeveloper@gmail.com');
    await page.getByRole('button', { name: /send reset code/i }).click();

    await expect(page).toHaveURL(/\/reset-password\?email=daacaddeveloper%40gmail\.com/);
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await expect(page.getByText('No data in response')).toHaveCount(0);
  });

  test('reset password succeeds when API returns message-only success', async ({ page }) => {
    await page.route('**/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Password reset successfully',
        }),
      });
    });

    await page.goto('/reset-password?email=daacaddeveloper@gmail.com');
    const otpInputs = page.locator('input[inputmode="numeric"]');
    for (const [index, digit] of [...'123456'].entries()) {
      await otpInputs.nth(index).fill(digit);
    }
    await page.getByLabel(/^new password$/i).fill('NewSecure1');
    await page.getByLabel(/^confirm password$/i).fill('NewSecure1');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByRole('heading', { name: /password reset/i })).toBeVisible();
    await expect(page.getByText('No data in response')).toHaveCount(0);
  });
});
