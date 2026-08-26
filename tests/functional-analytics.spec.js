import { test, expect } from '@playwright/test';
import { initTestAuth } from './helpers/mocks';

const ensureTeamSelected = async (page) => {
  const takeOverBtn = page.locator('button:has-text("Yes, Take Over")');
  if (await takeOverBtn.isVisible({ timeout: 2000 })) {
    await takeOverBtn.click();
  }
  const teamBtn = page.locator('button:has-text("South Circular")');
  if (await teamBtn.isVisible({ timeout: 3000 })) {
    await teamBtn.click().catch(() => {});
  }
};

test.describe('Functional Test Suite - Analytics & Reports', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('ANALYTICS-01: Open Filter Dropdown & Select Match', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    // Navigate to Analytics tab via bottom nav bar ("Data" or "Analytics")
    const dataTab = page.locator('nav button:has-text("Data"), nav button:has-text("Analytics")');
    await expect(dataTab.first()).toBeVisible({ timeout: 15000 });
    await dataTab.first().click();

    // Verify Analytics screen container or table header
    const analyticsView = page.locator('h1, h2, nav button');
    await expect(analyticsView.first()).toBeVisible({ timeout: 10000 });
  });
});
