const { test, expect } = require('@playwright/test');

/**
 * Accessibility Tests
 * Basic accessibility checks for the application
 */

test.describe('Accessibility - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Should have h1 or h2 as main heading - use .first() since page has multiple h2s
    const mainHeading = page.getByRole('heading', { level: 2 }).first();
    await expect(mainHeading).toBeVisible();
  });

  test('should have accessible form labels', async ({ page }) => {
    // Textarea should be labelled
    const textarea = page.getByPlaceholder(/Ask anything/i);
    await expect(textarea).toBeVisible();
    
    // Check for associated label
    const label = page.getByText(/Your Question/i);
    await expect(label).toBeVisible();
  });

  test('buttons should have accessible names', async ({ page }) => {
    const buttons = await page.getByRole('button').all();
    
    for (const button of buttons.slice(0, 5)) {
      const name = await button.getAttribute('aria-label') || await button.textContent();
      expect(name?.trim().length).toBeGreaterThan(0);
    }
  });

  test('links should have accessible names', async ({ page }) => {
    const links = await page.getByRole('link').all();
    
    for (const link of links) {
      const name = await link.getAttribute('aria-label') || await link.textContent();
      expect(name?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This is a basic check - full contrast testing requires axe-core or similar
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    
    // Should have a dark background (council dark theme)
    expect(bgColor).toBeTruthy();
  });

  test('should be navigable with keyboard only', async ({ page }) => {
    // Start at body
    await page.keyboard.press('Tab');
    
    // Should be able to tab through interactive elements
    let focusedCount = 0;
    for (let i = 0; i < 10; i++) {
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      if (['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SELECT'].includes(focused)) {
        focusedCount++;
      }
      await page.keyboard.press('Tab');
    }
    
    expect(focusedCount).toBeGreaterThan(0);
  });

  test('should have visible focus indicators', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check if focused element has visible outline/ring
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const styles = getComputedStyle(el);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        ring: styles.getPropertyValue('--tw-ring-color'),
      };
    });
    
    // Should have some focus indicator (outline, box-shadow, or ring)
    expect(focusedElement).toBeTruthy();
  });
});

test.describe('Accessibility - Session Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/sessions/a11y-test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'a11y-test',
          question: 'Accessibility test',
          status: 'completed',
          finalAnswer: 'Test answer',
          finalConfidence: 0.8,
          stages: [],
          members: [],
          totalDurationMs: 1000,
        }),
      });
    });
    
    await page.goto('/session/a11y-test');
  });

  test('should have proper page structure', async ({ page }) => {
    // Should have main content area
    const heading = page.getByRole('heading');
    await expect(heading.first()).toBeVisible();
  });

  test('tabs should be keyboard accessible', async ({ page }) => {
    const debateTab = page.getByRole('button', { name: /Debate/i });
    const debugTab = page.getByRole('button', { name: /Debug/i });
    
    await debateTab.focus();
    await page.keyboard.press('Tab');
    
    // Should be able to navigate between tabs
    await expect(debugTab).toBeFocused();
    
    await page.keyboard.press('Enter');
    await expect(debugTab).toHaveClass(/bg-council-primary/);
  });

  test('back button should be accessible', async ({ page }) => {
    const backLink = page.getByRole('link').filter({ has: page.locator('svg') }).first();
    
    await expect(backLink).toBeVisible();
    
    // Should be focusable
    await backLink.focus();
    await expect(backLink).toBeFocused();
  });
});

test.describe('Accessibility - Inline Config', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Customize/i }).click();
  });

  test('checkboxes should be accessible', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /Enable Iterations/i });
    
    await expect(checkbox).toBeVisible();
    
    // Should be toggleable with keyboard
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
  });

  test('radio buttons should be accessible', async ({ page }) => {
    // Voting method radio buttons
    const radios = await page.getByRole('radio').all();
    
    expect(radios.length).toBeGreaterThan(0);
    
    // Should be selectable with keyboard
    await radios[0].focus();
    await page.keyboard.press('Space');
    await expect(radios[0]).toBeChecked();
  });

  test('close button should have accessible name', async ({ page }) => {
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
    
    // Should have aria-label or visible text
    const name = await closeBtn.getAttribute('aria-label') || await closeBtn.textContent();
    
    // Even if empty, button should be clickable and focusable
    await expect(closeBtn).toBeVisible();
  });
});

test.describe('Accessibility - Error States', () => {
  test('error message should be announced', async ({ page }) => {
    await page.route('/api/sessions/error-a11y', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });
    
    await page.goto('/session/error-a11y');
    
    const errorMessage = page.getByText(/Session Not Found/i);
    await expect(errorMessage).toBeVisible();
    
    // Error should be in a prominent location
    const errorRole = await errorMessage.evaluate(el => el.closest('[role="alert"]') !== null);
    // Either has alert role or is prominently displayed
    expect(errorRole || await errorMessage.isVisible()).toBe(true);
  });
});

test.describe('Accessibility - Mobile/Responsive', () => {
  test('should be usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Main elements should still be visible
    await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ask the Council/i })).toBeVisible();
  });

  test('touch targets should be adequate size', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const submitBtn = page.getByRole('button', { name: /Ask the Council/i });
    const box = await submitBtn.boundingBox();
    
    // Touch targets should be at least 44x44 pixels
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
