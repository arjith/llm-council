const { test, expect } = require('@playwright/test');

test.describe('HomePage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show the hero section with title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Multi-Model Consensus/i })).toBeVisible();
    await expect(page.getByText(/Ask a question and watch multiple AI models/i)).toBeVisible();
  });

  test('should show the question input textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
  });

  test('should show preset selection buttons', async ({ page }) => {
    // Check that preset buttons are visible
    await expect(page.getByRole('button', { name: /Small/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Standard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reasoning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Diverse/i })).toBeVisible();
  });

  test('should select a preset when clicked', async ({ page }) => {
    const standardBtn = page.getByRole('button', { name: /Standard/i });
    await standardBtn.click();
    
    // Check the button has selected styling (border-council-primary)
    await expect(standardBtn).toHaveClass(/border-council-primary/);
  });

  test('should show preset tooltip on hover', async ({ page }) => {
    const reasoningBtn = page.getByRole('button', { name: /Reasoning/i });
    await reasoningBtn.hover();
    
    // Wait for tooltip to appear
    await expect(page.getByText(/o4-mini \+ o3-mini for complex logical problems/i)).toBeVisible();
  });

  test('should toggle Customize button to show inline config', async ({ page }) => {
    const customizeBtn = page.getByRole('button', { name: /Customize/i });
    await expect(customizeBtn).toBeVisible();
    
    await customizeBtn.click();
    
    // Check that InlineConfig panel appears
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible();
    await expect(page.getByText(/Members/i)).toBeVisible();
    await expect(page.getByText(/Voting/i)).toBeVisible();
    await expect(page.getByText(/Iterations/i)).toBeVisible();
  });

  test('should close inline config when X is clicked', async ({ page }) => {
    // Open config
    await page.getByRole('button', { name: /Customize/i }).click();
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible();
    
    // Close it
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
    await closeBtn.click();
    
    // Config should be hidden
    await expect(page.getByText(/Advanced Configuration/i)).not.toBeVisible();
  });

  test('should disable Ask button when question is empty', async ({ page }) => {
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    await expect(askBtn).toBeDisabled();
  });

  test('should enable Ask button when question is entered', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    await textarea.fill('What is the meaning of life?');
    
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    await expect(askBtn).toBeEnabled();
  });

  test('should show feature cards at the bottom', async ({ page }) => {
    await expect(page.getByText(/Multi-Model Debate/i)).toBeVisible();
    await expect(page.getByText(/Democratic Voting/i)).toBeVisible();
    await expect(page.getByText(/Self-Correction/i)).toBeVisible();
  });
});
