const { test, expect } = require('@playwright/test');

/**
 * End-to-end test for council progress flow
 * Tests the complete flow: submit question → progress updates → session result
 * 
 * Run with: 
 *   PLAYWRIGHT_BASE_URL=https://azca-webyslfuxsmb344w.victoriousstone-7174d72d.eastus.azurecontainerapps.io npx playwright test e2e/council-progress-e2e.spec.cjs --headed
 */

const TIMEOUTS = {
  pageLoad: 30000,
  councilSession: 600000,  // 10 minutes max for council to complete
  elementVisible: 30000,
};

test.describe('Council Progress E2E', () => {
  test.setTimeout(TIMEOUTS.councilSession + 60000); // 11 minutes total

  test('should submit question, show progress, and navigate to completed session', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/', { timeout: TIMEOUTS.pageLoad });
    console.log('✓ Page loaded');

    // Wait for presets to load
    await expect(page.getByRole('button', { name: /Small/i })).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    console.log('✓ Presets loaded');

    // Select Small preset (3 models - fastest)
    await page.getByRole('button', { name: /Small/i }).click();
    console.log('✓ Selected Small preset');

    // Type a simple question
    const textarea = page.getByPlaceholder(/Ask anything/i);
    await textarea.fill('What are the key differences between functional and object-oriented programming paradigms? Provide examples.');
    console.log('✓ Question entered');

    // Submit
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    await expect(askBtn).toBeEnabled();
    await askBtn.click();
    console.log('✓ Question submitted');

    // Should show progress UI (not the form)
    await expect(page.getByText(/Your Question/i)).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    console.log('✓ Progress UI visible');

    // Track progress updates
    let lastProgress = 0;
    let progressUpdates = [];
    
    // Poll for progress changes
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUTS.councilSession) {
      // Check if we've navigated to session page (completion)
      const currentUrl = page.url();
      if (currentUrl.includes('/session/')) {
        console.log(`✓ Navigated to session page: ${currentUrl}`);
        break;
      }

      // Check for errors
      const errorElement = page.locator('text=/error|failed/i');
      if (await errorElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        const errorText = await errorElement.textContent();
        throw new Error(`Council error: ${errorText}`);
      }

      // Try to read progress percentage from the UI
      const progressBar = page.locator('[role="progressbar"], .progress-bar, [class*="progress"]');
      const progressText = page.locator('text=/\\d+%/');
      
      if (await progressText.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await progressText.first().textContent();
        const match = text?.match(/(\d+)%/);
        if (match) {
          const currentProgress = parseInt(match[1], 10);
          if (currentProgress !== lastProgress) {
            progressUpdates.push({ time: Date.now() - startTime, progress: currentProgress });
            console.log(`  Progress: ${currentProgress}% (at ${Math.round((Date.now() - startTime) / 1000)}s)`);
            lastProgress = currentProgress;
          }
        }
      }

      // Check for stage/narrative updates
      const narrativeElement = page.locator('[class*="narrative"], [class*="status"]');
      if (await narrativeElement.isVisible({ timeout: 500 }).catch(() => false)) {
        // Just log that we see updates happening
      }

      await page.waitForTimeout(2000); // Poll every 2 seconds
    }

    // Verify we ended up on session page
    await expect(page).toHaveURL(/\/session\//, { timeout: 30000 });
    console.log('✓ On session page');

    // Wait for session page to fully load
    await page.waitForTimeout(2000);

    // Verify session page shows results (not "Session Not Found")
    const sessionNotFound = page.locator('text=/Session Not Found/i');
    const isNotFound = await sessionNotFound.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isNotFound) {
      throw new Error('Session Not Found error - session was not saved to repository');
    }
    console.log('✓ Session found in repository');

    // Should show Council Session heading
    await expect(page.getByRole('heading', { name: /Council Session/i })).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    console.log('✓ Session page header visible');

    // Should have Final Answer or some result content
    const resultContent = page.locator('text=/Final Answer|Consensus|answer|result/i');
    await expect(resultContent.first()).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    console.log('✓ Results visible');

    // Summary
    console.log('\n=== TEST PASSED ===');
    console.log(`Progress updates recorded: ${progressUpdates.length}`);
    progressUpdates.forEach(u => console.log(`  ${u.progress}% at ${Math.round(u.time / 1000)}s`));
  });
});
