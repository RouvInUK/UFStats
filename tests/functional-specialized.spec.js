import { test, expect } from '@playwright/test';
import { initTestAuth } from './helpers/mocks';

const ensureTeamSelected = async (page) => {
  const teamBtn = page.locator('button:has-text("South Circular")');
  if (await teamBtn.isVisible({ timeout: 3000 })) {
    await teamBtn.click().catch(() => {});
  }
};

test.describe('Functional Test Suite - Specialized Modules (AI, Tournaments, Training)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('SPECIALIZED-01: Training Setup Screen Navigation', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    await page.goto('/training');

    // Verify page container or header renders cleanly
    const mainView = page.locator('div#root, h1, h2, button');
    await expect(mainView.first()).toBeVisible({ timeout: 10000 });
  });

  test('SPECIALIZED-02: Tournament Organizer Desk Navigation', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    await page.goto('/tournament');

    // Verify page container or header renders cleanly
    const mainView = page.locator('div#root, h1, h2, button');
    await expect(mainView.first()).toBeVisible({ timeout: 10000 });
  });
});
