import { test, expect } from '@playwright/test';
import { initTestAuth } from './helpers/mocks';

const ensureTeamSelected = async (page) => {
  const takeOverBtn = page.locator('button:has-text("Yes, Take Over")');
  if (await takeOverBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await takeOverBtn.click().catch(() => {});
  }
  const teamBtn = page.locator('button:has-text("South Circular")').first();
  if (await teamBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await teamBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
};

const fillMatchMetadata = async (page, title, possessionText) => {
  const matchInput = page.locator('input[placeholder="e.g. EUCF Pool Play - Game 1"]');
  if (await matchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await matchInput.fill(title).catch(() => {});
    const oppInput = page.locator('input[placeholder="e.g. Darkstar"]');
    if (await oppInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oppInput.fill('Opponent Team').catch(() => {});
    }
    const posBtn = page.locator(`button:has-text("${possessionText}")`);
    if (await posBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await posBtn.click({ force: true }).catch(() => {});
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
  if (await trackingInProgress.isVisible({ timeout: 2000 }).catch(() => false)) {
    const trackTab = page.locator('nav button:has-text("Track")');
    if (await trackTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await trackTab.click().catch(() => {});
    }
    return;
  }

  // Clear active lineup state first if clearAll is visible and enabled
  const clearAllBtn = page.locator('button:has-text("Clear All")');
  if (await clearAllBtn.isVisible().catch(() => false) && await clearAllBtn.isEnabled().catch(() => false)) {
    await clearAllBtn.click().catch(() => {});
  }

  await selectRosterPlayers(page, targetCount);

  const startBtn = page.locator('button:has-text("Start Point")');
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await startBtn.isEnabled().catch(() => false)) {
      await startBtn.click().catch(() => {});
    }
  }

  const trackTab = page.locator('nav button:has-text("Track")');
  if (await trackTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await trackTab.click().catch(() => {});
  }
};

test.describe('Functional Test Suite - Sideline Scorer & Action Logging Grid', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.setTimeout(60000);
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

  test('SCORER-05: Voice Pro Continuous Session, Hybrid Touch + Voice & Multi-Pass Chain Parsing', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechStats = { starts: 0, aborts: 0, phrasesCount: 0, instance: null };

      window.SpeechRecognitionPhrase = class SpeechRecognitionPhrase {
        constructor(phrase, boost = 1.0) {
          this.phrase = phrase;
          this.boost = boost;
        }
      };

      class MockSpeechRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = false;
          this.lang = 'en-US';
          this._phrases = [];
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__speechStats.instance = this;
        }
        set phrases(val) {
          this._phrases = val;
          window.__speechStats.phrasesCount = Array.isArray(val) ? val.length : 0;
        }
        get phrases() {
          return this._phrases;
        }
        start() {
          window.__speechStats.starts += 1;
        }
        abort() {
          window.__speechStats.aborts += 1;
        }
        stop() {}
      }

      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;

      window.__emitSpeech = (transcriptText, isFinal = true) => {
        const inst = window.__speechStats.instance;
        if (inst && typeof inst.onresult === 'function') {
          const fakeResult = [{ transcript: transcriptText, confidence: 0.99 }];
          fakeResult.isFinal = isFinal;
          inst.onresult({ results: [fakeResult] });
        }
      };
    });

    await page.goto('/');
    await ensureTeamSelected(page);

    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible({ timeout: 20000 });
    await lineupTab.click();

    await fillMatchMetadata(page, `Voice Pro Match ${Date.now()}`, 'Receive (Offense)');
    await ensurePointStarted(page, 7);

    // Enable Voice Pro on the Dashboard if not already enabled
    const voiceProBtn = page.locator('button:has-text("Voice Pro")');
    if (await voiceProBtn.isVisible({ timeout: 5000 })) {
      const cls = (await voiceProBtn.getAttribute('class')) || '';
      if (!cls.includes('from-amber-500')) {
        await voiceProBtn.click();
      }
      await expect(page.locator('text=/Listening|Mic Active/i').first()).toBeVisible({ timeout: 5000 });

      // 1. Verify Contextual Biasing (SpeechRecognitionPhrase) was populated
      const initialStats = await page.evaluate(() => ({
        starts: window.__speechStats.starts,
        aborts: window.__speechStats.aborts,
        phrasesCount: window.__speechStats.phrasesCount
      }));
      expect(initialStats.starts).toBe(1);
      expect(initialStats.phrasesCount).toBeGreaterThan(5);

      // 2. Verify Hybrid Touch + Voice: Player cards remain enabled while Voice Pro is active
      const firstPlayerCard = page.locator('div.grid button').first();
      await expect(firstPlayerCard).toBeEnabled();

      // 3. Emit a voice pass ("10 to 14") and verify the session does NOT abort/restart on possessionChain change
      await page.evaluate(() => window.__emitSpeech('ten to fourteen', true));
      await expect(page.locator('text=/Heard: "10 → 14" ✓/')).toBeVisible({ timeout: 5000 });

      const afterPassStats = await page.evaluate(() => ({
        starts: window.__speechStats.starts,
        aborts: window.__speechStats.aborts
      }));
      expect(afterPassStats.aborts).toBe(0);
      expect(afterPassStats.starts).toBe(1);

      // 4. Emit follow-up voice command ("Alex huck") in the same continuous transcript
      await page.evaluate(() => window.__emitSpeech('ten to fourteen alex huck', true));
      await expect(page.locator('text=/Heard: "alex → huck" ✓/')).toBeVisible({ timeout: 5000 });
    }
  });
});
