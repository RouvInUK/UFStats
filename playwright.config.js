import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers and device profiles */
  projects: [
    // One-time Setup project to handle login and storageState save
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },

    // 1. Live DB Projects (Depend on setup login)
    {
      name: 'Mobile Safari (iPhone 15 Pro Max)',
      use: { 
        ...devices['iPhone 15 Pro Max'],
        // Use the authenticated storage state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome (Pixel 8 Pro)',
      use: { 
        ...devices['Pixel 8 Pro'],
        // Use the authenticated storage state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // 2. Hermetic Mocked Projects (Independent of setup login and database connection)
    {
      name: 'Mocked Mobile Safari (iPhone 15 Pro Max)',
      use: { 
        ...devices['iPhone 15 Pro Max'],
      },
    },
    {
      name: 'Mocked Mobile Chrome (Pixel 8 Pro)',
      use: { 
        ...devices['Pixel 8 Pro'],
      },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
