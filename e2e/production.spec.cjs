const { test, expect } = require('@playwright/test');

/**
 * Production E2E Tests
 * These tests run against the deployed production endpoint (not mocked).
 * They use longer timeouts to account for:
 * - Network latency
 * - Cold starts
 * - Real Azure OpenAI API calls (30-120+ seconds per council session)
 * 
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://your-deployed-app.com npx playwright test e2e/production.spec.cjs
 */

// Production-specific timeout configurations (10x increased for E2E validation)
const PROD_TIMEOUTS = {
  pageLoad: 60000,         // 60s for page load
  apiResponse: 600000,     // 600s (10 min) for API responses
  elementVisible: 60000,   // 60s for element visibility
  navigation: 60000,       // 60s for navigation
  councilSession: 900000,  // 900s (15 min) for full council session completion
};

test.describe('Production - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
  });

  test('should load homepage with all key elements', async ({ page }) => {
    // Hero section
    await expect(page.getByRole('heading', { name: /Multi-Model Consensus/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Question input
    await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Preset buttons
    await expect(page.getByRole('button', { name: /Small/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    await expect(page.getByRole('button', { name: /Standard/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    await expect(page.getByRole('button', { name: /Reasoning/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    await expect(page.getByRole('button', { name: /Diverse/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Ask button (should be disabled without question)
    await expect(page.getByRole('button', { name: /Ask the Council/i })).toBeDisabled();
    
    // Recent Sessions section
    await expect(page.getByRole('heading', { name: /Recent Sessions/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
  });

  test('should enable Ask button when question is entered', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    
    await expect(askBtn).toBeDisabled();
    await textarea.fill('What is the capital of France?');
    await expect(askBtn).toBeEnabled();
  });

  test('should open and close configuration panel', async ({ page }) => {
    const customizeBtn = page.getByRole('button', { name: /Customize/i });
    await customizeBtn.click();
    
    // Config panel should be visible
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    await expect(page.getByRole('heading', { name: /Members/i })).toBeVisible();
    // Use specific emoji heading to avoid matching "Democratic Voting" too
    await expect(page.getByRole('heading', { name: '🗳️ Voting' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Iterations/i })).toBeVisible();
    
    // Close with Hide button (the Customize button toggles to Hide when open)
    const hideBtn = page.getByRole('button', { name: /Hide/i });
    await hideBtn.click();
    
    // Config should be hidden
    await expect(page.getByText(/Advanced Configuration/i)).not.toBeVisible();
  });

  test('should select different presets', async ({ page }) => {
    const smallBtn = page.getByRole('button', { name: /Small/i });
    const standardBtn = page.getByRole('button', { name: /Standard/i });
    const reasoningBtn = page.getByRole('button', { name: /Reasoning/i });
    
    // Select Small
    await smallBtn.click();
    await expect(smallBtn).toHaveClass(/border-council-primary/);
    await expect(page.getByText(/Small.*•.*3 members/)).toBeVisible();
    
    // Select Reasoning
    await reasoningBtn.click();
    await expect(reasoningBtn).toHaveClass(/border-council-primary/);
    await expect(page.getByText(/Reasoning.*•.*5 members/)).toBeVisible();
  });
});

test.describe('Production - Session View', () => {
  test('should load an existing session from Recent Sessions', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Wait for sessions to load
    await page.waitForTimeout(2000);
    
    // Click on the first session link
    const sessionLinks = page.locator('a[href^="/session/"]');
    const sessionCount = await sessionLinks.count();
    
    if (sessionCount > 0) {
      await sessionLinks.first().click();
      
      // Wait for session page to load
      await expect(page).toHaveURL(/\/session\//, { timeout: PROD_TIMEOUTS.navigation });
      
      // Session page should show key elements
      await expect(page.getByRole('heading', { name: /Council Session/i })).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
      await expect(page.getByRole('button', { name: /Debate/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Debug/i })).toBeVisible();
    } else {
      // No sessions yet - this is okay for a fresh deployment
      test.skip();
    }
  });

  test('should switch between Debate and Debug tabs', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Wait for sessions to load
    await page.waitForTimeout(2000);
    
    const sessionLinks = page.locator('a[href^="/session/"]');
    const sessionCount = await sessionLinks.count();
    
    if (sessionCount > 0) {
      await sessionLinks.first().click();
      await expect(page).toHaveURL(/\/session\//, { timeout: PROD_TIMEOUTS.navigation });
      
      // Click Debug tab
      await page.getByRole('button', { name: /Debug/i }).click();
      
      // Should show Debug tab content
      await expect(page.getByText(/Filter:/i)).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
      
      // Click Debate tab
      await page.getByRole('button', { name: /Debate/i }).click();
      
      // Should show Debate tab content (Final Answer heading or similar)
      await page.waitForTimeout(1000);
    } else {
      test.skip();
    }
  });

  test('should navigate back to homepage', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    await page.waitForTimeout(2000);
    
    const sessionLinks = page.locator('a[href^="/session/"]');
    const sessionCount = await sessionLinks.count();
    
    if (sessionCount > 0) {
      await sessionLinks.first().click();
      await expect(page).toHaveURL(/\/session\//, { timeout: PROD_TIMEOUTS.navigation });
      
      // Click Dashboard link
      await page.getByRole('link', { name: /Dashboard/i }).click();
      await expect(page).toHaveURL('/', { timeout: PROD_TIMEOUTS.navigation });
    } else {
      test.skip();
    }
  });
});

test.describe('Production - Full Council Flow (Long Running)', () => {
  // This test submits a real question and waits for the council to complete
  // It can take 60-180+ seconds depending on the number of models and iterations
  // SKIP by default - requires backend API with Azure OpenAI configured and running
  // To run: Set ENABLE_FULL_COUNCIL_TEST=true environment variable
  
  const skipReason = 'Requires backend API with Azure OpenAI. Set ENABLE_FULL_COUNCIL_TEST=true to run.';
  test.skip(!process.env.ENABLE_FULL_COUNCIL_TEST, skipReason);
  
  test.setTimeout(PROD_TIMEOUTS.councilSession + 120000); // 17 minutes total

  test('should submit a question and complete council session', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Select Small preset (fastest - 3 models)
    await page.getByRole('button', { name: /Small/i }).click();
    
    // Type a simple question
    const textarea = page.getByPlaceholder(/Ask anything/i);
    await textarea.fill('What is 2 + 2?');
    
    // Submit
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    await expect(askBtn).toBeEnabled();
    await askBtn.click();
    
    // Should show loading state
    await expect(page.getByText(/Convening Council/i)).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Wait for navigation to session page (this is the long wait)
    await expect(page).toHaveURL(/\/session\//, { timeout: PROD_TIMEOUTS.councilSession });
    
    // Session page should eventually show results
    // Wait for either completion indicators or timeout
    const successIndicators = page.locator('text=/Final Answer|Consensus|90%|85%|80%|\\d+%/i');
    await expect(successIndicators.first()).toBeVisible({ timeout: PROD_TIMEOUTS.apiResponse });
  });
});

test.describe('Production - API Health', () => {
  test('should have accessible API endpoints', async ({ page }) => {
    // Check presets endpoint
    const presetsResponse = await page.request.get('/api/council/presets');
    expect(presetsResponse.ok()).toBe(true);
    
    // Check sessions endpoint
    const sessionsResponse = await page.request.get('/api/sessions');
    expect(sessionsResponse.ok()).toBe(true);
    
    // Check roles endpoint
    const rolesResponse = await page.request.get('/api/council/roles');
    expect(rolesResponse.ok()).toBe(true);
    
    // Check voting methods endpoint
    const votingResponse = await page.request.get('/api/council/voting-methods');
    expect(votingResponse.ok()).toBe(true);
  });
});

test.describe('Production - Error Handling', () => {
  test('should show 404 for invalid session', async ({ page }) => {
    await page.goto('/session/nonexistent-session-id-12345', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Should show error state
    await expect(page.getByText(/Session Not Found/i)).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Should have link back to home
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
  });
});

test.describe('Production - Accessibility Basics', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Should have h1
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: PROD_TIMEOUTS.elementVisible });
    
    // Should have h2
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  });

  test('should be navigable with keyboard', async ({ page }) => {
    await page.goto('/', { timeout: PROD_TIMEOUTS.pageLoad });
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should have focus on an interactive element
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SELECT']).toContain(focused);
  });
});
