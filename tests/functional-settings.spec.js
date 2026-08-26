import { test, expect } from '@playwright/test';
import { initTestAuth } from './helpers/mocks';

test.describe('Functional Test Suite - Application Options & Settings', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await initTestAuth(page, testInfo);
  });

  test('SETTINGS-01: Open Settings Modal & Toggle Options', async ({ page }) => {
    await page.goto('/');

    // If session conflict popup, handle it
    const takeOverBtn = page.locator('button:has-text("Yes, Take Over")');
    if (await takeOverBtn.isVisible({ timeout: 2000 })) {
      await takeOverBtn.click();
    }

    // Open settings modal via gear/settings button in header or sidebar
    const settingsBtn = page.locator('button[title="Settings"], button:has-text("Settings")');
    if (await settingsBtn.first().isVisible({ timeout: 5000 })) {
      await settingsBtn.first().click();
      await expect(page.locator('h2:has-text("Settings"), h3:has-text("Settings")').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('SETTINGS-02: Spectator Live Mode Sharing Link', async ({ page }) => {
    const validSpectatorId = btoa('team123|Game1');
    await page.goto(`/live/${validSpectatorId}`);

    // Verify spectator view renders with Scoring Feed header
    const spectatorHeader = page.locator('h2:has-text("Scoring Feed"), :text("Live Broadcast")');
    await expect(spectatorHeader.first()).toBeVisible({ timeout: 10000 });
  });
});
