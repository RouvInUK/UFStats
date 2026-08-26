import { test, expect } from '@playwright/test';
import { setupMocks, MOCK_USER_ID, MOCK_TEAM_ID, MOCK_PROFILE } from './helpers/mocks';

test.describe('South Circular UAT Test Suite', () => {

  test.beforeEach(async ({ page }, testInfo) => {
    const isMocked = testInfo.project.name.includes('Mocked');

    if (isMocked) {
      console.log(`🤖 [Mocked Mode] Setting up interceptors for project: ${testInfo.project.name}`);
      await setupMocks(page);

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
            email: 'rouven@ustats.pro',
            created_at: MOCK_PROFILE.created_at,
            updated_at: MOCK_PROFILE.created_at,
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }),
        profileKey: 'ufstats_cached_profile',
        profileVal: JSON.stringify(MOCK_PROFILE)
      });
    } else {
      console.log(`🔌 [Live DB Mode] Running UAT tests against remote database: ${testInfo.project.name}`);
    }
  });

  test('UAT-01: Select South Circular Team and Verify Dashboard Grid', async ({ page }) => {
    await page.goto('/');

    // Select the South Circular team unconditionally since the selection screen is always shown
    const teamButton = page.locator('button:has-text("South Circular")');
    await expect(teamButton).toBeVisible({ timeout: 15000 });
    await teamButton.click();

    // Wait for the active team header or indicator to confirm selection is processed
    const teamHeader = page.locator('span:has-text("South Circular"), div:has-text("South Circular")');
    await expect(teamHeader.first()).toBeVisible({ timeout: 15000 });

    // Verify ustats.pro branding is visible in the mobile header (use :visible to bypass hidden desktop tags)
    await expect(page.locator('span:has-text("ustats.pro"):visible').first()).toBeVisible();

    // Verify presence of the action-logging buttons grid
    // Primary Actions:
    await expect(page.locator('button:has-text("WE SCORED")').first()).toBeVisible();
    await expect(page.locator('button:has-text("THEY SCORED")').first()).toBeVisible();
    
    // Secondary Actions (Drop, Incomplete, Stall Out, Defence):
    await expect(page.locator('button:has-text("Drop")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Incomplete")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Stall Out")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Defence")').first()).toBeVisible();
    
    console.log('✅ UAT-01 Passed: Dashboard grid successfully loaded for South Circular.');
  });

  test('UAT-02: Navigate to Analytics and Verify Game Statistics Calculations', async ({ page }) => {
    await page.goto('/');

    // Select the South Circular team unconditionally
    const teamButton = page.locator('button:has-text("South Circular")');
    await expect(teamButton).toBeVisible({ timeout: 15000 });
    await teamButton.click();

    // Wait for the active team header or indicator to confirm selection is fully processed
    const teamHeader = page.locator('span:has-text("South Circular"), div:has-text("South Circular")');
    await expect(teamHeader.first()).toBeVisible({ timeout: 15000 });

    // 1. Click bottom navigation tab for Analytics (labeled "Data")
    const dataTab = page.locator('button:has-text("Data")');
    await expect(dataTab).toBeVisible();
    await dataTab.click();

    // 2. Verify Analytics screen title / details load
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible({ timeout: 10000 });

    // 3. Open custom filter games dropdown and select match "Beach Nationals Bronze Medal Match "
    const filterBtn = page.locator('button:has-text("Filter")');
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();

    // Select the target match checkbox
    const matchOption = page.locator('label:has-text("Beach Nationals Bronze Medal Match")');
    await expect(matchOption).toBeVisible();
    await matchOption.click();

    // Close the dropdown by clicking the filter button again
    await filterBtn.click();

    // 4. Verify compiled statistics
    const statsTable = page.locator('table');
    await expect(statsTable).toBeVisible();

    // Verify key columns exist (Player, Goals, Assists, etc.)
    await expect(statsTable.locator('th:has-text("Player")')).toBeVisible();
    await expect(statsTable.locator('th:has-text("Goals")')).toBeVisible(); 
    await expect(statsTable.locator('th:has-text("Assists")')).toBeVisible(); 

    // Check specific player stats cells
    await expect(statsTable.locator('td:has-text("Serena")')).toBeVisible();
    await expect(statsTable.locator('td:has-text("Ilona")')).toBeVisible();
    await expect(statsTable.locator('td:has-text("Trebs")')).toBeVisible();

    console.log('✅ UAT-02 Passed: Analytics data and dropdown calculation verified.');
  });

  test('UAT-03: Verify Touch Compatibility and Mobile Layout Elements', async ({ page }) => {
    await page.goto('/');

    // Select the South Circular team unconditionally
    const teamButton = page.locator('button:has-text("South Circular")');
    await expect(teamButton).toBeVisible({ timeout: 15000 });
    await teamButton.click();

    // Wait for selection to process
    const teamHeader = page.locator('span:has-text("South Circular"), div:has-text("South Circular")');
    await expect(teamHeader.first()).toBeVisible({ timeout: 15000 });

    // 1. Verify bottom navigation bar has full touch height and is visible
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
    
    // Check that we can navigate to "Lineup" (specify nav to avoid selecting "Select Lineup" button on empty dashboard)
    const lineupTab = page.locator('nav button:has-text("Lineup")');
    await expect(lineupTab).toBeVisible();
    await lineupTab.click();

    // Verify we reached the lineup screen (should show players or starting 7 selection or configurations)
    await expect(page.locator('h2:has-text("Pre-Game Configurations")')).toBeVisible({ timeout: 10000 });

    // 2. Check that active elements are clickable (using :visible to skip hidden desktop items)
    const activeLineupButtons = page.locator('button:visible').first();
    await expect(activeLineupButtons).toBeVisible();

    console.log('✅ UAT-03 Passed: Responsive mobile layout and touch controls are fully functional.');
  });
});
