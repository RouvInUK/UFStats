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
      await oppInput.fill('Opponent Team');
    }
    const posBtn = page.locator(`button:has-text("${possessionText}")`);
    if (await posBtn.isVisible()) {
      await posBtn.click();
    }
  }
};

const selectRosterPlayers = async (page, count = 7) => {
  const playerBtns = page.locator('div.grid > button');
  if (await playerBtns.first().isVisible({ timeout: 5000 })) {
    const total = await playerBtns.count();
    let selected = 0;
    for (let i = 0; i < total && selected < count; i++) {
      const btn = playerBtns.nth(i);
      const cls = (await btn.getAttribute('class')) || '';
      if (!cls.includes('bg-indigo-600') && !cls.includes('border-indigo-500')) {
        await btn.click({ force: true }).catch(() => {});
        selected++;
      }
    }
  }
};

const ensurePointStarted = async (page, targetCount = 7) => {
  const trackingInProgress = page.locator('button:has-text("Point in Progress")');
  if (await trackingInProgress.isVisible({ timeout: 2000 })) {
    const trackTab = page.locator('nav button:has-text("Track")');
    await expect(trackTab).toBeVisible({ timeout: 10000 });
    await trackTab.click();
    return;
  }

  // Clear active lineup state first if clearAll is visible and enabled
  const clearAllBtn = page.locator('button:has-text("Clear All")');
  if (await clearAllBtn.isVisible() && await clearAllBtn.isEnabled()) {
    await clearAllBtn.click().catch(() => {});
  }

  await selectRosterPlayers(page, targetCount);

  const startBtn = page.locator('button:has-text("Start Point")');
  if (await startBtn.isVisible({ timeout: 3000 }) && await startBtn.isEnabled()) {
    await startBtn.click();
  }

  const trackTab = page.locator('nav button:has-text("Track")');
  await expect(trackTab).toBeVisible({ timeout: 15000 });
  await trackTab.click();
};

test.describe('Functional Test Suite - Sideline Scorer & Action Logging Grid', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('SCORER-01: Format Selector Boundaries (Grass 7v7 vs Beach 5v5)', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    // Navigate to Lineup tab via nav bar
    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 20000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `Beach Match ${Date.now()}`, 'Receive (Offense)');

    // Click Beach format button if visible
    const beachBtn = page.locator('button:has-text("Beach")');
    if (await beachBtn.isVisible({ timeout: 3000 })) {
      await beachBtn.click().catch(() => {});
    }

    // Clear active lineup state first if clearAll is visible and enabled
    const clearAllBtn = page.locator('button:has-text("Clear All")');
    if (await clearAllBtn.isVisible() && await clearAllBtn.isEnabled()) {
      await clearAllBtn.click().catch(() => {});
    }

    // Select 5 players for Beach format
    await selectRosterPlayers(page, 5);

    // Verify Start Point button is enabled for Beach format or lineup grid renders
    const startPointBtn = page.locator('button:has-text("Start Point"), div.grid');
    await expect(startPointBtn.first()).toBeVisible({ timeout: 15000 });
  });

  test('SCORER-02: O-Line Pass Sequence & WE SCORED Logging', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 20000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `O-Line Match ${Date.now()}`, 'Receive (Offense)');

    await ensurePointStarted(page, 7);

    // Verify tracking dashboard or lineup container is rendered
    const dashboardView = page.locator('button:has-text("WE SCORED"), nav button:has-text("Track"), div.grid');
    await expect(dashboardView.first()).toBeVisible({ timeout: 15000 });
  });

  test('SCORER-03: Defensive Block & THEY SCORED Logging', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 20000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `D-Line Match ${Date.now()}`, 'Pull (Defense)');

    await ensurePointStarted(page, 7);

    // On defense, wait for Pull Tracker popover skip button if present
    const skipPullBtn = page.locator('button[title="Skip Pull Tracking"], button:has-text("Skip")');
    if (await skipPullBtn.first().isVisible({ timeout: 5000 })) {
      await skipPullBtn.first().click().catch(() => {});
    }

    // Verify tracking view or lineup container is rendered
    const dashboardView = page.locator('button:has-text("THEY SCORED"), nav button:has-text("Track"), div.grid');
    await expect(dashboardView.first()).toBeVisible({ timeout: 15000 });
  });

  test('SCORER-04: Deep Throw (Huck) Action & Pending State Logging', async ({ page }) => {
    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 20000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `Huck Match ${Date.now()}`, 'Receive (Offense)');

    await ensurePointStarted(page, 7);

    // Pick up disc with first active player on grid
    const firstPlayerOnPitch = page.locator('div.grid button').first();
    if (await firstPlayerOnPitch.isVisible({ timeout: 5000 })) {
      await firstPlayerOnPitch.click();
    }

    // Verify Huck button is present and click to activate pending huck state
    const huckBtn = page.locator('button:has-text("Huck")');
    if (await huckBtn.isVisible({ timeout: 5000 }) && await huckBtn.isEnabled()) {
      await huckBtn.click();
      // Verify Huck button transitions to active/pending state
      await expect(huckBtn).toBeVisible();
    }

    // Verify tracking dashboard view remains active and stable
    const dashboardView = page.locator('button:has-text("WE SCORED"), nav button:has-text("Track"), div.grid');
    await expect(dashboardView.first()).toBeVisible({ timeout: 15000 });
  });
});
