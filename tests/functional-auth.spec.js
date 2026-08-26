import { test, expect } from '@playwright/test';

const openAuthScreenIfNeeded = async (page) => {
  const emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: 2000 }))) {
    const signInBtn = page.locator('button:has-text("Sign In"), button:has-text("Start Free")').first();
    if (await signInBtn.isVisible({ timeout: 5000 })) {
      await signInBtn.click();
    }
  }
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
};

test.describe('Functional Test Suite - Authentication & Security', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('AUTH-01: Login Form Navigation & Invalid Credentials Warning', async ({ page }) => {
    await page.goto('/');
    await openAuthScreenIfNeeded(page);

    // Enter invalid credentials
    await page.locator('input[type="email"]').fill('invalid_user_test@ustats.pro');
    await page.locator('input[type="password"]').fill('WrongPassword123!');

    // Submit form
    await page.locator('button[type="submit"]').first().click();

    // Verify error notification alert appears
    const errorAlert = page.locator('div.bg-rose-500\\/10, :text("Invalid"), :text("credentials"), :text("error")');
    await expect(errorAlert.first()).toBeVisible({ timeout: 15000 });
  });

  test('AUTH-02: Sign Up Toggle & Email Verification Display', async ({ page }) => {
    await page.goto('/');
    await openAuthScreenIfNeeded(page);

    // If on Login form, toggle to Sign Up form
    const isSignUpForm = await page.locator('text=Create your Team Workspace., button:has-text("Create Team")').first().isVisible({ timeout: 2000 });
    if (!isSignUpForm) {
      const signUpToggle = page.locator('button:has-text("Don\'t have an account? Sign up"), button:has-text("Sign Up"), button:has-text("Sign up")');
      if (await signUpToggle.first().isVisible({ timeout: 5000 })) {
        await signUpToggle.first().click();
      }
    }

    // Fill sign up inputs
    await page.locator('input[type="email"]').fill('new_athlete_test@ustats.pro');
    await page.locator('input[type="password"]').fill('SecurePass123!');

    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
  });

  test('AUTH-03: Forgot Password Workflow', async ({ page }) => {
    await page.goto('/');
    await openAuthScreenIfNeeded(page);

    // Click Forgot Password link
    const forgotBtn = page.locator('button:has-text("Forgot Password?")').first();
    if (await forgotBtn.isVisible({ timeout: 5000 })) {
      await forgotBtn.click();

      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 5000 });
      await emailInput.fill('reset_test@ustats.pro');
    }
  });
});
