const { test, expect } = require('@playwright/test');

/**
 * End-to-end tests for the full council flow:
 * Ask question → Submit → Navigate to session → View results
 * 
 * These tests require the API to be running with mock or real responses.
 * For CI, we mock API responses. For manual testing, real API is used.
 */

test.describe('Council Flow - Question Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should type a question and enable submit button', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    const askBtn = page.getByRole('button', { name: /Ask the Council/i });
    
    // Initially disabled
    await expect(askBtn).toBeDisabled();
    
    // Type a question
    await textarea.fill('What is quantum computing?');
    
    // Now enabled
    await expect(askBtn).toBeEnabled();
    await expect(textarea).toHaveValue('What is quantum computing?');
  });

  test('should clear question with keyboard', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    
    await textarea.fill('Test question');
    await expect(textarea).toHaveValue('Test question');
    
    // Clear with Ctrl+A and Delete
    await textarea.press('Control+a');
    await textarea.press('Backspace');
    
    await expect(textarea).toHaveValue('');
    await expect(page.getByRole('button', { name: /Ask the Council/i })).toBeDisabled();
  });

  test('should handle very long questions', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    const longQuestion = 'This is a test question. '.repeat(50);
    
    await textarea.fill(longQuestion);
    await expect(textarea).toHaveValue(longQuestion);
    await expect(page.getByRole('button', { name: /Ask the Council/i })).toBeEnabled();
  });

  test('should handle special characters in question', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    const specialQuestion = 'What about <script>alert("xss")</script> and "quotes" & ampersands?';
    
    await textarea.fill(specialQuestion);
    await expect(textarea).toHaveValue(specialQuestion);
  });

  test('should preserve question when toggling config', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask anything/i);
    const question = 'Explain neural networks';
    
    await textarea.fill(question);
    
    // Toggle config panel
    await page.getByRole('button', { name: /Customize/i }).click();
    await expect(page.getByText(/Advanced Configuration/i)).toBeVisible();
    
    // Question should still be there
    await expect(textarea).toHaveValue(question);
    
    // Close config
    await page.getByRole('button', { name: /Hide/i }).click();
    await expect(textarea).toHaveValue(question);
  });
});

test.describe('Council Flow - Preset Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should select different presets', async ({ page }) => {
    const presets = ['Small', 'Standard', 'Reasoning', 'Diverse'];
    
    for (const preset of presets) {
      const btn = page.getByRole('button', { name: new RegExp(preset, 'i') });
      await btn.click();
      
      // Selected preset should have primary border
      await expect(btn).toHaveClass(/border-council-primary/);
      
      // Other presets should not have primary border
      for (const other of presets.filter(p => p !== preset)) {
        const otherBtn = page.getByRole('button', { name: new RegExp(other, 'i') });
        await expect(otherBtn).not.toHaveClass(/border-council-primary/);
      }
    }
  });

  test('should update status text when preset changes', async ({ page }) => {
    // Standard preset (default) - the format is "{name} • {count} members"
    await expect(page.getByText(/Standard.*•.*5 members/)).toBeVisible();
    
    // Select Small preset
    await page.getByRole('button', { name: /Small/i }).click();
    await expect(page.getByText(/Small.*•.*3 members/)).toBeVisible();
    
    // Select Diverse preset
    await page.getByRole('button', { name: /Diverse/i }).click();
    await expect(page.getByText(/Diverse.*•.*6 members/)).toBeVisible();
  });

  test('should show tooltip for each preset on hover', async ({ page }) => {
    // Hover over Small - wait for tooltip to appear
    const smallBtn = page.getByRole('button', { name: /Small/i });
    await smallBtn.hover();
    
    // Wait a bit for tooltip animation
    await page.waitForTimeout(300);
    
    // Tooltip should appear with description - the actual text is "3 GPT-5 series models for quick consensus"
    await expect(page.locator('text=/quick consensus|GPT-5 series/i').first()).toBeVisible({ timeout: 5000 });
    
    // Move away by hovering elsewhere - use first() to avoid multi-element match
    await page.getByRole('heading', { name: /Multi-Model/i }).first().hover();
    await page.waitForTimeout(200);
    
    // Hover over Reasoning
    await page.getByRole('button', { name: /Reasoning/i }).hover();
    await page.waitForTimeout(300);
    
    // Should show tooltip for Reasoning preset
    await expect(page.locator('text=/o4-mini|o3-mini|reasoning/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Council Flow - Submit and Session Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show loading state when submitting', async ({ page }) => {
    // Type question
    await page.getByPlaceholder(/Ask anything/i).fill('What is AI?');
    
    // Mock the API to delay response
    await page.route('/api/council/run', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'test-session-123' }),
      });
    });
    
    // Click submit
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/Convening Council/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Convening Council/i })).toBeDisabled();
  });

  test('should navigate to session page after successful submission', async ({ page }) => {
    await page.getByPlaceholder(/Ask anything/i).fill('What is machine learning?');
    
    // Mock successful API response
    await page.route('/api/council/run', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'test-session-456' }),
      });
    });
    
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Should navigate to session page
    await expect(page).toHaveURL(/\/session\/test-session-456/);
  });

  test('should show error message on API failure', async ({ page }) => {
    await page.getByPlaceholder(/Ask anything/i).fill('Test question');
    
    // Mock failed API response
    await page.route('/api/council/run', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Wait for error to appear - use heading selector to be specific
    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible({ timeout: 10000 });
    
    // Should stay on homepage
    await expect(page).toHaveURL('/');
  });
});

test.describe('Council Flow - Recent Sessions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock sessions list
    await page.route('/api/sessions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'session-1',
              question: 'What is the meaning of life?',
              status: 'completed',
              finalConfidence: 0.87,
              totalDurationMs: 5420,
              createdAt: '2026-01-10T10:00:00Z',
            },
            {
              id: 'session-2',
              question: 'Explain quantum entanglement',
              status: 'completed',
              finalConfidence: 0.72,
              totalDurationMs: 8100,
              createdAt: '2026-01-10T09:00:00Z',
            },
          ],
          total: 2,
        }),
      });
    });
    
    await page.goto('/');
  });

  test('should display recent sessions', async ({ page }) => {
    await expect(page.getByText(/Recent Sessions/i)).toBeVisible();
    await expect(page.getByText(/What is the meaning of life/i)).toBeVisible();
    await expect(page.getByText(/Explain quantum entanglement/i)).toBeVisible();
  });

  test('should show confidence badges for sessions', async ({ page }) => {
    // 87% confidence should show
    await expect(page.getByText('87%').first()).toBeVisible();
    // 72% confidence should show
    await expect(page.getByText('72%').first()).toBeVisible();
  });

  test('should navigate to session when clicked', async ({ page }) => {
    // Mock session detail
    await page.route('/api/sessions/session-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-1',
          question: 'What is the meaning of life?',
          status: 'completed',
          finalAnswer: 'The meaning of life is subjective...',
          finalConfidence: 0.87,
          totalDurationMs: 5420,
          stages: [],
          members: [],
        }),
      });
    });
    
    await page.getByText(/What is the meaning of life/i).click();
    await expect(page).toHaveURL(/\/session\/session-1/);
  });

  test('should show status indicators for sessions', async ({ page }) => {
    // Mock with different statuses
    await page.route('/api/sessions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            { id: 's1', question: 'Completed', status: 'completed', finalConfidence: 0.9, totalDurationMs: 1000, createdAt: '2026-01-10T10:00:00Z' },
            { id: 's2', question: 'Running', status: 'running', finalConfidence: null, totalDurationMs: 500, createdAt: '2026-01-10T10:00:00Z' },
            { id: 's3', question: 'Failed', status: 'failed', finalConfidence: null, totalDurationMs: 200, createdAt: '2026-01-10T10:00:00Z' },
          ],
          total: 3,
        }),
      });
    });
    
    await page.goto('/');
    
    // Should show status indicators (colored dots)
    const sessionItems = page.locator('a[href^="/session/"]');
    await expect(sessionItems).toHaveCount(3);
  });
});

test.describe('Council Flow - Full E2E with Mocked Session', () => {
  test('complete flow: ask → submit → view session → view debug', async ({ page }) => {
    // Mock APIs
    await page.route('/api/council/run', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'e2e-test-session' }),
      });
    });
    
    await page.route('/api/sessions/e2e-test-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-test-session',
          question: 'What is the capital of France?',
          status: 'completed',
          finalAnswer: 'The capital of France is Paris.',
          finalConfidence: 0.95,
          totalTokens: 1500,
          totalDurationMs: 3200,
          correctionRounds: 0,
          stages: [
            {
              stage: 'opinions',
              responses: [
                { memberId: 'm1', memberName: 'GPT-5', modelId: 'gpt-5', content: 'Paris is the capital.', confidence: 0.95, latencyMs: 800 },
                { memberId: 'm2', memberName: 'GPT-4o', modelId: 'gpt-4o', content: 'The capital is Paris.', confidence: 0.92, latencyMs: 600 },
              ],
              durationMs: 1400,
            },
            {
              stage: 'voting',
              responses: [],
              votingResult: {
                winner: 'Paris is the capital.',
                method: 'confidence',
                confidenceAvg: 0.935,
                consensusReached: true,
                breakdown: { 'm1': 1, 'm2': 1 },
              },
              durationMs: 100,
            },
          ],
          members: [
            { id: 'm1', name: 'GPT-5', role: 'opinion-giver', modelConfig: { name: 'gpt-5' } },
            { id: 'm2', name: 'GPT-4o', role: 'reviewer', modelConfig: { name: 'gpt-4o' } },
          ],
          createdAt: '2026-01-11T12:00:00Z',
        }),
      });
    });
    
    await page.route('/api/council/e2e-test-session/traces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'e2e-test-session',
          traces: [
            { id: 't1', sessionId: 'e2e-test-session', type: 'session-start', timestamp: '2026-01-11T12:00:00Z' },
            { id: 't2', sessionId: 'e2e-test-session', type: 'stage-start', stage: 'opinions', timestamp: '2026-01-11T12:00:01Z' },
            { id: 't3', sessionId: 'e2e-test-session', type: 'member-response', memberName: 'GPT-5', timestamp: '2026-01-11T12:00:02Z', durationMs: 800 },
            { id: 't4', sessionId: 'e2e-test-session', type: 'stage-end', stage: 'opinions', timestamp: '2026-01-11T12:00:03Z' },
            { id: 't5', sessionId: 'e2e-test-session', type: 'voting-complete', timestamp: '2026-01-11T12:00:04Z' },
            { id: 't6', sessionId: 'e2e-test-session', type: 'session-end', timestamp: '2026-01-11T12:00:05Z' },
          ],
        }),
      });
    });
    
    await page.goto('/');
    
    // Step 1: Type question
    await page.getByPlaceholder(/Ask anything/i).fill('What is the capital of France?');
    
    // Step 2: Submit
    await page.getByRole('button', { name: /Ask the Council/i }).click();
    
    // Step 3: Should be on session page
    await expect(page).toHaveURL(/\/session\/e2e-test-session/);
    
    // Step 4: Should see question
    await expect(page.getByText('What is the capital of France?')).toBeVisible();
    
    // Step 5: Should see final answer
    await expect(page.getByText(/The capital of France is Paris/i)).toBeVisible();
    
    // Step 6: Should see confidence badge
    await expect(page.locator('text=95%').first()).toBeVisible();
    
    // Step 7: Should see debate cards - use locator for more reliable matching
    await expect(page.locator('text=GPT-5').first()).toBeVisible();
    await expect(page.locator('text=GPT-4o').first()).toBeVisible();
    
    // Step 8: Switch to Debug tab
    await page.getByRole('button', { name: /Debug/i }).click();
    
    // Step 9: Should see filters
    await expect(page.locator('text=/Filter/i').first()).toBeVisible();
    
    // Step 10: Should see timeline events
    await expect(page.locator('text=/session-start/i').first()).toBeVisible();
  });
});
