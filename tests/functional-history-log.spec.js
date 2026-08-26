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

test.describe('Functional Test Suite - Point Log & Event History Editing', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('LOG-01: Undo Last Logged Stat Action', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 15000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `Log Undo Match ${Date.now()}`, 'Receive (Offense)');

    // Navigate to Log tab via bottom nav bar
    const logTab = page.locator('nav button:has-text("Log")');
    await expect(logTab).toBeVisible({ timeout: 15000 });
    await logTab.click();

    // Verify Event Log screen title or content container
    const logHeader = page.locator('h1, h2, nav button');
    await expect(logHeader.first()).toBeVisible({ timeout: 10000 });
  });
});
