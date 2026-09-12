import { test, expect } from '@playwright/test';

test.describe('Forgot / reset password', () => {
  test('advances after send when API returns message-only success', async ({ page }) => {
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

    await expect(page).toHaveURL(/\/reset-password\?email=/);
    await expect(page.getByText(/no data in response/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
  });

  test('advances after send when API returns data.message', async ({ page }) => {
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { message: 'If the email exists, a reset code has been sent' },
        }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/^email$/i).fill('daacaddeveloper@gmail.com');
    await page.getByRole('button', { name: /send reset code/i }).click();

    await expect(page).toHaveURL(/\/reset-password\?email=/);
    await expect(page.getByText(/no data in response/i)).toHaveCount(0);
  });

  test('completes reset when API returns message-only success', async ({ page }) => {
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
    await page.getByLabel('Digit 1').pressSequentially('123456');
    await page.getByLabel(/^new password$/i).fill('newpassword1');
    await page.getByLabel(/^confirm password$/i).fill('newpassword1');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByRole('heading', { name: /password reset/i })).toBeVisible();
    await expect(page.getByText(/no data in response/i)).toHaveCount(0);
  });
});
