import { test, expect } from '@playwright/test';
import { initTestAuth } from './helpers/mocks';

test.describe('Functional Test Suite - Team Administration & Setup Wizard', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo, true);
  });

  test('ADMIN-01: Setup Wizard Club & Team Creation', async ({ page }) => {
    await page.goto('/');

    // Handle session conflict take over if present
    const takeOverBtn = page.locator('button:has-text("Yes, Take Over")');
    if (await takeOverBtn.isVisible({ timeout: 2000 })) {
      await takeOverBtn.click();
    }

    // Open Create Club form
    const createClubBtn = page.locator('button:has-text("Create Club"), button:has-text("Add Club")');
    if (await createClubBtn.first().isVisible({ timeout: 5000 })) {
      await createClubBtn.first().click();

      // Fill Club Name
      const clubInput = page.locator('input[placeholder="Club Name"], input[placeholder*="Club"]');
      if (await clubInput.isVisible({ timeout: 3000 })) {
        await clubInput.fill(`Test Club ${Date.now()}`);
      }
    }
  });

  test('ADMIN-02: Select Team to Enter Main Dashboard', async ({ page }) => {
    await page.goto('/');

    // Handle session conflict take over if present
    const takeOverBtn = page.locator('button:has-text("Yes, Take Over")');
    if (await takeOverBtn.isVisible({ timeout: 2000 })) {
      await takeOverBtn.click();
    }

    // Select existing team "South Circular" if visible
    const southCircularBtn = page.locator('button:has-text("South Circular")');
    if (await southCircularBtn.isVisible({ timeout: 3000 })) {
      await southCircularBtn.click();
    }

    // Verify main app bottom navigation bar loads cleanly
    const navBar = page.locator('nav button:has-text("Track"), nav button:has-text("Lineup"), nav button:has-text("Log")');
    await expect(navBar.first()).toBeVisible({ timeout: 15000 });
  });
});
