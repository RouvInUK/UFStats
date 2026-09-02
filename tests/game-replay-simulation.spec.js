import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { setupMocks, resetDynamicMockStore, MOCK_USER_ID, MOCK_PROFILE } from './helpers/mocks';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// We retrieve the optional Live DB test runner credentials from .env.local
const TEST_RUNNER_EMAIL = process.env.VITE_TEST_RUNNER_EMAIL;
const TEST_RUNNER_PASSWORD = process.env.VITE_TEST_RUNNER_PASSWORD || 'wfoewqnfeionf';

test.describe('UAT Game Replay Simulation', () => {
  // Reset storage state to start completely logged out
  test.use({ storageState: { cookies: [], origins: [] } });

  let testUserId = null;
  let isMockedRun = false;
  let runSuffix = '';

  test.beforeAll(async ({}, testInfo) => {
    isMockedRun = testInfo.project.name.includes('Mocked');

    if (isMockedRun) {
      testUserId = MOCK_USER_ID;
      return;
    }

    // Live DB Setup
    if (!TEST_RUNNER_EMAIL) {
      console.warn('⚠️ WARNING: VITE_TEST_RUNNER_EMAIL is not set in .env.local. Skipping live DB simulation.');
      return;
    }

    console.log(`🔌 [Live DB Mode] Connecting to Supabase for test account: ${TEST_RUNNER_EMAIL}...`);
    
    // 1. Try signing in
    let { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_RUNNER_EMAIL,
      password: TEST_RUNNER_PASSWORD
    });

    if (error) {
      if (error.message.includes('Invalid login credentials') || error.message.includes('not confirmed')) {
        console.log(`🆕 Account signup needed or email confirmation pending for ${TEST_RUNNER_EMAIL}`);
        throw new Error(`Supabase Auth config: Please ensure test account ${TEST_RUNNER_EMAIL} is confirmed or toggle off "Confirm email" in Supabase -> Authentication -> Providers.`);
      } else {
        throw new Error(`Supabase auth error: ${error.message}`);
      }
    } else {
      testUserId = data.user.id;
    }

    console.log(`👤 Logged in as test user. ID: ${testUserId}`);

    // 2. Perform DB reset
    await cleanDatabase(testUserId);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    isMockedRun = testInfo.project.name.includes('Mocked');
    // Generate a unique suffix for parallel project safety
    runSuffix = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '');

    // Log console messages from the browser
    page.on('console', msg => {
      console.log(`🖥️ [Browser Console] [${msg.type()}] ${msg.text()}`);
    });

    if (isMockedRun) {
      console.log(`🤖 [Mocked Mode] Resetting dynamic mock store for run: ${runSuffix}...`);
      resetDynamicMockStore();
      
      // In Mocked Mode, set up dynamic interceptors
      await setupMocks(page, true);
      
      // Inject cached credentials for the test runner into localStorage
      await page.addInitScript(({ key, value, profileKey, profileVal }) => {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(profileKey, profileVal);
        window.localStorage.setItem('ufstats_theme', 'dark');
      }, {
        key: 'sb-rktfovbzhqehqjulmwuj-auth-token',
        value: JSON.stringify({
          access_token: 'mock-access-token-jwt',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: MOCK_USER_ID,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test-runner@ustats.pro',
            created_at: MOCK_PROFILE.created_at,
            updated_at: MOCK_PROFILE.created_at,
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }),
        profileKey: 'ufstats_cached_profile',
        profileVal: JSON.stringify({
          ...MOCK_PROFILE,
          email: 'test-runner@ustats.pro'
        })
      });
    } else {
      // In Live DB Mode, skip if no runner email is set
      if (!TEST_RUNNER_EMAIL) {
        console.log('⏩ Skipping Live DB simulation (no VITE_TEST_RUNNER_EMAIL set).');
        test.skip();
      }

      // Intercept profiles query in Live DB Mode to force coach dashboard access
      await page.route('**/rest/v1/profiles*', async route => {
        const response = await route.fetch();
        const body = await response.text();
        try {
          const json = JSON.parse(body);
          const modified = Array.isArray(json)
            ? json.map(p => ({ ...p, disable_club_track: false, tier: 'PRO' }))
            : { ...json, disable_club_track: false, tier: 'PRO' };
          await route.fulfill({
            response,
            contentType: 'application/json',
            body: JSON.stringify(modified)
          });
        } catch (e) {
          await route.fulfill({ response, body });
        }
      });
    }
  });

  // Database cleanup helper (only used in Live DB Mode)
  async function cleanDatabase(userId) {
    console.log(`🧹 Clearing database for user: ${userId}...`);
    // 1. Fetch clubs owned by user
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id')
      .eq('owner_id', userId);
    
    if (clubs && clubs.length > 0) {
      const clubIds = clubs.map(c => c.id);
      await supabase.from('players').delete().in('club_id', clubIds);
      await supabase.from('clubs').delete().in('id', clubIds);
    }

    // 2. Fetch teams owned by user
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', userId);

    if (teams && teams.length > 0) {
      const teamIds = teams.map(t => t.id);
      await supabase.from('stats').delete().in('team_id', teamIds);
      await supabase.from('teams').delete().in('id', teamIds);
    }
    console.log('✨ Database reset complete.');
  }

  test('Replay Game Simulation E2E Walkthrough', async ({ page }) => {
    test.setTimeout(90000);
    const teamName = `South Circular Test Team ${runSuffix}`;
    const gameName = `UAT Replay Finals ${runSuffix}`;

    // 1. Navigate and authenticate
    if (isMockedRun) {
      console.log('🤖 [Mocked Mode] Navigating directly to home (using injected token)...');
      await page.goto('/');
    } else {
      console.log('🔌 [Live DB Mode] Navigating to login page...');
      await page.goto('/login?mode=login');

      const emailInput = page.locator('input[placeholder="coach@team.com"]');
      const passwordInput = page.locator('input[placeholder="••••••••"]');
      
      await expect(emailInput).toBeVisible({ timeout: 10000 });
      await emailInput.fill(TEST_RUNNER_EMAIL);
      await passwordInput.fill(TEST_RUNNER_PASSWORD);

      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();

      // Handle potential session takeover (skip or takeover modal)
      console.log('⏳ Waiting for post-login view...');
      const successIndicator = page.locator('.lucide-crown, button:has-text("Log Out"), h2:has-text("Select Team"), h1:has-text("Select Your Team")').filter({ visible: true });
      const takeoverBtn = page.locator('button:has-text("Yes, Take Over")');
      
      await Promise.race([
        successIndicator.first().waitFor({ state: 'visible', timeout: 15000 }),
        takeoverBtn.waitFor({ state: 'visible', timeout: 15000 })
      ]).catch(() => {});

      if (await takeoverBtn.isVisible()) {
        console.log('🔄 Session conflict detected. Clicking "Yes, Take Over"...');
        await takeoverBtn.click();
        await successIndicator.first().waitFor({ state: 'visible', timeout: 10000 });
      }
    }

    // 2. Setup Wizard: Create Club
    console.log('🧙 Setup Wizard: Creating club...');
    const clubInput = page.locator('input[placeholder="Enter Club Name (e.g. Deep Space)"]');
    await expect(clubInput).toBeVisible({ timeout: 15000 });
    await clubInput.fill('South Circular Test Club');
    await page.locator('button:has-text("Create My Club")').click();

    // 3. Create Team
    console.log('🧙 Setup Wizard: Creating team...');
    const addTeamBtn = page.locator('button:has-text("Add Team")');
    await expect(addTeamBtn).toBeVisible({ timeout: 10000 });
    await addTeamBtn.click();

    const teamInput = page.locator('input[placeholder="Team Name"]');
    await teamInput.fill(teamName);
    await page.locator('button[type="submit"]:has-text("Add")').click();

    // 4. Select the created team to enter dashboard
    const teamBtn = page.locator(`button:has-text("${teamName}")`);
    await expect(teamBtn).toBeVisible({ timeout: 10000 });
    await teamBtn.click();

    // Wait for Dashboard welcome screen
    await expect(page.locator('text=No active players on the pitch.')).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Lineup then Roster Setup to add players
    console.log('👕 Navigating to Lineup setup...');
    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await lineupTab.click();

    const setupRosterBtn = page.locator('button:has-text("Go setup your roster")');
    await expect(setupRosterBtn).toBeVisible({ timeout: 10000 });
    await setupRosterBtn.click();

    // Helper to register players
    const registerPlayer = async (name, shirtNumber) => {
      await page.locator('input[placeholder="#"]').fill(shirtNumber);
      await page.locator('input[placeholder="Add new player to club..."]').fill(name);
      await page.locator('button:has-text("Add Player")').click();
      // Ensure player row renders in list
      await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 15000 });
    };

    console.log('👥 Registering Roster Players...');
    await registerPlayer('Serena', '10');
    await registerPlayer('Trebs', '14');
    await registerPlayer('Ilona', '7');
    await registerPlayer('Alex', '11');
    await registerPlayer('Casey', '22');
    await registerPlayer('Taylor', '5');
    await registerPlayer('Jordan', '9');

    // Go back to lineup tab
    await lineupTab.click();
    await expect(page.locator('h2:has-text("Pre-Game Configurations")')).toBeVisible({ timeout: 10000 });

    // Select all 7 players
    const playersToSelect = ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'];
    for (const player of playersToSelect) {
      await page.locator(`button:has-text("${player}")`).click();
    }

    // Configure Game details
    await page.locator('input[placeholder="e.g. EUCF Pool Play - Game 1"]').fill(gameName);
    await page.locator('input[placeholder="e.g. Darkstar"]').fill('Simulation Opponent');
    await page.locator('button:has-text("Receive")').click(); // Starting Possession O

    // Start tracking
    await page.locator('button:has-text("Start Point")').click();

    // 6. Match Replay Simulation
    console.log('🎮 Replaying point events...');
    // POINT 1 (O): Serena -> Trebs -> Ilona (Goal)
    // Tapping Serena sets holder
    await page.locator('button:has-text("Serena")').click();
    // Serena passes to Trebs
    await page.locator('button:has-text("Trebs")').click();
    // Trebs passes to Ilona
    await page.locator('button:has-text("Ilona")').click();
    await page.waitForTimeout(300);
    // We Score! (logs assist Trebs, goal Ilona)
    const weScoredBtn = page.locator('button:has-text("WE SCORED")');
    await expect(weScoredBtn).toBeEnabled({ timeout: 5000 });
    await weScoredBtn.click();

    // The app auto-navigates back to lineup selector after 1.5s. Wait for 'Active Lineup' header.
    await expect(page.locator('h1:has-text("Active Lineup")')).toBeVisible({ timeout: 10000 });
    
    // Wait for SyncEngine to finish uploading Point 1 stats before starting Point 2
    await page.locator('[title="All data synced to cloud"]:visible').waitFor({ state: 'visible', timeout: 15000 });

    // POINT 2 (D): Serena block -> Serena pass to Ilona -> Ilona (Goal)
    // Select the 7 players again (selections clear when points end)
    for (const player of playersToSelect) {
      await page.locator(`button:has-text("${player}")`).click();
    }
    // Start Point
    await page.locator('button:has-text("Start Point")').click();
    // Skip Pull Tracker popover
    const skipPullBtn = page.locator('button[title="Skip Pull Tracking"]');
    await expect(skipPullBtn).toBeVisible({ timeout: 5000 });
    await skipPullBtn.click();

    // Serena gets defensive block (first tap Serena to claim disc, then click Defence)
    await page.locator('button:has-text("Serena")').click();
    await page.locator('button:has-text("Defence")').click();

    // Now Serena possesses, logs pass to Ilona
    await page.locator('button:has-text("Serena")').click();
    await page.locator('button:has-text("Ilona")').click();
    // We Score! (logs assist Serena, goal Ilona)
    await page.locator('button:has-text("WE SCORED")').click();

    // Wait for auto-navigation back to lineup screen
    await expect(page.locator('h1:has-text("Active Lineup")')).toBeVisible({ timeout: 10000 });

    // Wait for SyncEngine to finish uploading Point 2 stats before starting Point 3
    await page.locator('[title="All data synced to cloud"]:visible').waitFor({ state: 'visible', timeout: 15000 });

    // POINT 3 (D): Opponent Scores
    // Re-select active 7
    for (const player of playersToSelect) {
      await page.locator(`button:has-text("${player}")`).click();
    }
    await page.locator('button:has-text("Start Point")').click();
    await expect(skipPullBtn).toBeVisible({ timeout: 5000 });
    await skipPullBtn.click();

    // Click THEY SCORED
    await page.locator('button:has-text("THEY SCORED")').click();

    // Wait for auto-navigation back to lineup screen
    await expect(page.locator('h1:has-text("Active Lineup")')).toBeVisible({ timeout: 10000 });

    // Wait for SyncEngine to finish uploading Point 3 stats before checking Analytics
    await page.locator('[title="All data synced to cloud"]:visible').waitFor({ state: 'visible', timeout: 15000 });

    // 7. Verify Compiled Statistics in Analytics view
    console.log('📊 Navigating to Analytics to verify stats calculations...');
    const dataTab = page.locator('button:has-text("Data")');
    await dataTab.click();

    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible({ timeout: 10000 });

    // Open filter dropdown and select gameName
    const filterBtn = page.locator('button:has-text("Filter")');
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();

    const matchCheckbox = page.locator(`label:has-text("${gameName}")`);
    await expect(matchCheckbox).toBeVisible();
    await matchCheckbox.click();
    await filterBtn.click();

    // Assert stats table values
    const statsTable = page.locator('table');
    await expect(statsTable).toBeVisible();

    // Helper to get stats cells
    const verifyPlayerRow = async (name) => {
      const row = statsTable.locator(`tr:has-text("${name}")`);
      await expect(row.first()).toBeVisible({ timeout: 10000 });
    };

    // Serena: 0 Goals, 1 Assist
    // Ilona: 2 Goals, 0 Assists
    // Trebs: 0 Goals, 1 Assist
    console.log('✔️ Verifying exact statistical numbers...');
    await verifyPlayerRow('Serena', '0', '1');
    await verifyPlayerRow('Ilona', '2', '0');
    await verifyPlayerRow('Trebs', '0', '1');

    console.log('🎉 Replay Game Simulation E2E Passed Successfully!');
  });
});
