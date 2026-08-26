import { test as setup, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env.local to resolve VITE_TEST_USER_PASSWORD
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

setup('authenticate as rouven@ustats.pro', async ({ page }) => {
  const password = process.env.VITE_TEST_USER_PASSWORD;
  
  if (!password) {
    console.warn('⚠️ WARNING: VITE_TEST_USER_PASSWORD is not set in .env.local. Skipping live authentication setup.');
    setup.skip();
    return;
  }

  console.log('🔑 Authenticating as rouven@ustats.pro against live Supabase...');
  
  // 1. Navigate to landing page and click login, or go direct to login URL
  await page.goto('/login?mode=login');

  // 2. Fill email and password
  const emailInput = page.locator('input[placeholder="coach@team.com"]');
  const passwordInput = page.locator('input[placeholder="••••••••"]');
  
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill('rouven@ustats.pro');
  await passwordInput.fill(password);

  // 3. Click sign in button
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // 4. Wait for dashboard, team selection, OR session takeover modal
  console.log('⏳ Waiting for post-login view...');
  
  const successIndicator = page.locator('.lucide-crown, button:has-text("Log Out"), h2:has-text("Select Team"), h1:has-text("Select Your Team")');
  const takeoverBtn = page.locator('button:has-text("Yes, Take Over")');
  
  // Race success state vs session takeover state
  await Promise.race([
    successIndicator.first().waitFor({ state: 'visible', timeout: 15000 }),
    takeoverBtn.waitFor({ state: 'visible', timeout: 15000 })
  ]).catch(err => {
    console.log('Info: Wait finished or timed out. Proceeding to inspect screen state.');
  });

  // If takeover button is visible, click it to clear the session conflict
  if (await takeoverBtn.isVisible()) {
    console.log('🔄 Session conflict detected. Clicking "Yes, Take Over"...');
    await takeoverBtn.click();
    
    // Wait for the success state after takeover click
    await successIndicator.first().waitFor({ state: 'visible', timeout: 10000 });
  }

  // 5. Store session state
  await page.context().storageState({ path: authFile });
  console.log('✅ Authentication complete. Session state saved to:', authFile);
});
