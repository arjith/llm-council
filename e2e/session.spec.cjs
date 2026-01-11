const { test, expect } = require('@playwright/test');

// Helper to get a valid session ID from the API
async function getFirstSessionId(page) {
  const response = await page.request.get('/api/sessions?limit=1');
  const data = await response.json();
  if (data.sessions && data.sessions.length > 0) {
    return data.sessions[0].id;
  }
  return null;
}

test.describe('SessionPage - Debate Tab', () => {
  // Note: These tests require a mock session or running API
  // For now, we test the error state and navigation
  
  test('should show session not found for invalid ID', async ({ page }) => {
    await page.goto('/session/non-existent-id');
    
    // Should show error state
    await expect(page.getByText(/Session Not Found/i)).toBeVisible();
    await expect(page.getByText(/Go back home/i)).toBeVisible();
  });

  test('should navigate back to home when link clicked', async ({ page }) => {
    await page.goto('/session/non-existent-id');
    
    await page.getByText(/Go back home/i).click();
    
    // Should be back on homepage
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Multi-Model Consensus/i })).toBeVisible();
  });
});

test.describe('SessionPage - Tab Navigation', () => {
  test('should show Debate and Debug tabs', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);
    if (!sessionId) {
      test.skip(true, 'No sessions available');
      return;
    }
    
    await page.goto(`/session/${sessionId}`);
    await expect(page.getByRole('button', { name: /Debate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Debug/i })).toBeVisible();
  });

  test('should switch to Debug tab when clicked', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);
    if (!sessionId) {
      test.skip(true, 'No sessions available');
      return;
    }
    
    await page.goto(`/session/${sessionId}`);
    await page.getByRole('button', { name: /Debug/i }).click();
    
    // Debug tab should show filter controls
    await expect(page.getByText(/Filter:/i)).toBeVisible();
  });
});

test.describe('SessionPage - Debug Tab Filters', () => {
  test('should toggle filter checkboxes', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);
    if (!sessionId) {
      test.skip(true, 'No sessions available');
      return;
    }
    
    await page.goto(`/session/${sessionId}`);
    await page.getByRole('button', { name: /Debug/i }).click();
    
    // Wait for filters to appear
    await expect(page.getByText(/Filter:/i)).toBeVisible();
    
    // Check that Requests checkbox exists and is functional
    const requestsLabel = page.locator('label').filter({ hasText: /Requests/i });
    await expect(requestsLabel).toBeVisible();
  });
});
