const { defineConfig, devices } = require('@playwright/test');
 
// Allow baseURL to be overridden via environment variable for deployed testing
// Default to 3000, but check common dev ports
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const WEB_SERVER_PORT = process.env.WEB_SERVER_PORT || '3000';

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.cjs', // Only run .cjs files (ESM compatibility)
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 120000, // 120s per test (increased for production scenarios)
  expect: {
    timeout: 30000, // 30s for assertions (increased for slow API responses)
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000, // 30s for actions (increased)
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start webServer for local testing (not when testing deployed endpoint)
  ...(BASE_URL.includes('localhost') ? {
    webServer: {
      command: 'npm run dev -w @llm-council/web',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120000,
    },
  } : {}),
});
