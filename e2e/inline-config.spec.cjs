const { test, expect } = require('@playwright/test');

test.describe('InlineConfig Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open inline config panel when Customize is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Customize/i }).click();
    
    // Panel should appear with header
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible();
  });

  test('should show Members, Voting, and Iterations sections', async ({ page }) => {
    await page.getByRole('button', { name: /Customize/i }).click();
    
    // Three sections should be visible
    await expect(page.getByText('👥 Members')).toBeVisible();
    await expect(page.getByText('🗳️ Voting')).toBeVisible();
    await expect(page.getByText('🔄 Iterations')).toBeVisible();
  });

  test('should have Add Member button', async ({ page }) => {
    await page.getByRole('button', { name: /Customize/i }).click();
    
    const addMemberBtn = page.getByRole('button', { name: /Add Member/i });
    await expect(addMemberBtn).toBeVisible();
  });

  test('should toggle Enable Iterations checkbox', async ({ page }) => {
    await page.getByRole('button', { name: /Customize/i }).click();
    
    const iterationsCheckbox = page.getByRole('checkbox', { name: /Enable Iterations/i });
    
    // Should be unchecked by default
    await expect(iterationsCheckbox).not.toBeChecked();
    
    // Check it
    await iterationsCheckbox.check();
    await expect(iterationsCheckbox).toBeChecked();
    
    // Should show additional options when checked
    await expect(page.getByText(/Max Iterations/i)).toBeVisible();
    await expect(page.getByText(/Strategy/i)).toBeVisible();
    await expect(page.getByText(/Confidence Threshold/i)).toBeVisible();
  });

  test('should close panel when X button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Customize/i }).click();
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible();
    
    // Click X button
    await page.locator('.glass button').filter({ has: page.locator('svg.lucide-x') }).click();
    
    // Panel should be hidden
    await expect(page.getByText(/Advanced Configuration/i)).not.toBeVisible();
  });

  test('should update Customize button state when config is open', async ({ page }) => {
    const customizeBtn = page.getByRole('button', { name: /Customize/i });
    
    // Before click - should contain "Customize" text
    await expect(customizeBtn).toBeVisible();
    
    await customizeBtn.click();
    
    // After click - button should now contain "Hide" text
    // Wait a moment for state update
    await page.waitForTimeout(200);
    
    // The button should now show "Hide"
    await expect(page.getByRole('button', { name: /Hide/i })).toBeVisible({ timeout: 5000 });
  });
});
