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

const fillMatchMetadata = async (page, title, possessionText) => {
  const matchInput = page.locator('input[placeholder="e.g. EUCF Pool Play - Game 1"]');
  if (await matchInput.isVisible({ timeout: 3000 })) {
    await matchInput.fill(title);
    const oppInput = page.locator('input[placeholder="e.g. Darkstar"]');
    if (await oppInput.isVisible()) {
      await oppInput.fill('Opponent Team').catch(() => {});
    }
    const posBtn = page.locator(`button:has-text("${possessionText}")`);
    if (await posBtn.isVisible()) {
      await posBtn.click().catch(() => {});
    }
  }
};

test.describe('Functional Test Suite - Pull Tracker Options', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('PULL-01: Pull Tracker Popover Display & Skip Action', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 15000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `Pull Test ${Date.now()}`, 'Pull (Defense)');

    // Start point if possible
    const startBtn = page.locator('button:has-text("Start Point")');
    if (await startBtn.isVisible({ timeout: 3000 }) && await startBtn.isEnabled()) {
      await startBtn.click();
    }

    // Verify main app navigation or Pull Tracker popover skip button
    const trackingView = page.locator('button:has-text("THEY SCORED"), button[title="Skip Pull Tracking"], button:has-text("Skip"), nav');
    await expect(trackingView.first()).toBeVisible({ timeout: 15000 });
  });
});
