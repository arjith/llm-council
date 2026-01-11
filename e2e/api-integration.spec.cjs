const { test, expect } = require('@playwright/test');

/**
 * API Integration Tests
 * Tests that API endpoints are properly called and responses handled
 */

test.describe('API - Presets', () => {
  test('should fetch presets on homepage load', async ({ page }) => {
    const apiCalls = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/council/presets')) {
        apiCalls.push(request.url());
      }
    });
    
    await page.goto('/');
    
    // Wait for presets to load
    await page.waitForResponse(resp => resp.url().includes('/api/council/presets'));
    
    // Should have called presets endpoint
    expect(apiCalls.some(url => url.includes('/api/council/presets'))).toBe(true);
  });

  test('should fetch preset details when customizing', async ({ page }) => {
    let presetDetailsCalled = false;
    
    page.on('request', request => {
      if (request.url().match(/\/api\/council\/presets\/\w+/)) {
        presetDetailsCalled = true;
      }
    });
    
    await page.goto('/');
    await page.getByRole('button', { name: /Customize/i }).click();
    
    // Wait a bit for the API call
    await page.waitForTimeout(1000);
    
    // Should have fetched preset details
    expect(presetDetailsCalled).toBe(true);
  });
});

test.describe('API - Sessions', () => {
  test('should fetch sessions list on homepage', async ({ page }) => {
    let sessionsCalled = false;
    
    page.on('request', request => {
      if (request.url().includes('/api/sessions')) {
        sessionsCalled = true;
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    expect(sessionsCalled).toBe(true);
  });

  test('should fetch session by ID on session page', async ({ page }) => {
    let sessionDetailCalled = false;
    
    // Mock the session
    await page.route('/api/sessions/test-id', async (route) => {
      sessionDetailCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          question: 'Test',
          status: 'completed',
          finalAnswer: 'Answer',
          finalConfidence: 0.8,
          stages: [],
          members: [],
          totalDurationMs: 1000,
        }),
      });
    });
    
    await page.goto('/session/test-id');
    await page.waitForTimeout(500);
    
    expect(sessionDetailCalled).toBe(true);
  });
});

test.describe('API - Council Run', () => {
  test('should POST to /api/council/run with correct payload', async ({ page }) => {
    let requestBody = null;
    
    await page.route('/api/council/run', async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'new-session' }),
      });
    });
    
    await page.goto('/');
    
    // Select a preset
    await page.getByRole('button', { name: /Reasoning/i }).click();
    
    // Type question
    await page.getByPlaceholder(/Ask anything/i).fill('What is 2+2?');
    
    // Submit
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Wait for navigation
    await expect(page).toHaveURL(/\/session\/new-session/);
    
    // Verify request payload
    expect(requestBody).toEqual({
      question: 'What is 2+2?',
      preset: 'reasoning',
    });
  });

  test('should handle 400 error gracefully', async ({ page }) => {
    await page.route('/api/council/run', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid request' }),
      });
    });
    
    await page.goto('/');
    await page.getByPlaceholder(/Ask anything/i).fill('Test');
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Should show error and stay on homepage - use heading selector to be specific
    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL('/');
  });

  test('should handle network error gracefully', async ({ page }) => {
    await page.route('/api/council/run', async (route) => {
      await route.abort('failed');
    });
    
    await page.goto('/');
    await page.getByPlaceholder(/Ask anything/i).fill('Test');
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Should show error - use heading selector to avoid matching multiple elements
    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('API - Traces', () => {
  test('should fetch traces when switching to Debug tab', async ({ page }) => {
    let tracesCalled = false;
    
    // Mock session
    await page.route('/api/sessions/test-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session',
          question: 'Test',
          status: 'completed',
          finalAnswer: 'Answer',
          finalConfidence: 0.8,
          stages: [],
          members: [],
          totalDurationMs: 1000,
        }),
      });
    });
    
    // Mock traces
    await page.route('/api/council/test-session/traces', async (route) => {
      tracesCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'test-session',
          traces: [],
        }),
      });
    });
    
    await page.goto('/session/test-session');
    
    // Traces should not be called on Debate tab
    await page.waitForTimeout(500);
    expect(tracesCalled).toBe(false);
    
    // Switch to Debug tab
    await page.getByRole('button', { name: /Debug/i }).click();
    
    // Now traces should be called
    await page.waitForTimeout(500);
    expect(tracesCalled).toBe(true);
  });
});

test.describe('API - Roles and Voting Methods', () => {
  test('should fetch roles when config panel opens', async ({ page }) => {
    let rolesCalled = false;
    
    page.on('request', request => {
      if (request.url().includes('/api/council/roles')) {
        rolesCalled = true;
      }
    });
    
    await page.goto('/');
    await page.getByRole('button', { name: /Customize/i }).click();
    
    await page.waitForTimeout(500);
    expect(rolesCalled).toBe(true);
  });

  test('should fetch voting methods when config panel opens', async ({ page }) => {
    let votingMethodsCalled = false;
    
    page.on('request', request => {
      if (request.url().includes('/api/council/voting-methods')) {
        votingMethodsCalled = true;
      }
    });
    
    await page.goto('/');
    await page.getByRole('button', { name: /Customize/i }).click();
    
    await page.waitForTimeout(500);
    expect(votingMethodsCalled).toBe(true);
  });
});

test.describe('API - Export', () => {
  test('export button should have correct href', async ({ page }) => {
    await page.route('/api/sessions/export-test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'export-test',
          question: 'Test',
          status: 'completed',
          finalAnswer: 'Answer',
          finalConfidence: 0.8,
          stages: [],
          members: [],
          totalDurationMs: 1000,
        }),
      });
    });
    
    await page.goto('/session/export-test');
    
    const exportLink = page.getByRole('link', { name: /Export/i });
    await expect(exportLink).toHaveAttribute('href', '/api/sessions/export-test/export?format=markdown');
  });
});
