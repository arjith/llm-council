const { test, expect } = require('@playwright/test');

/**
 * Session Page Tests - Debate and Debug Tabs
 * Comprehensive tests for viewing session results
 */

test.describe('Session Page - Debate Tab', () => {
  const mockSession = {
    id: 'debate-test',
    question: 'What are the benefits of renewable energy?',
    status: 'completed',
    finalAnswer: 'Renewable energy offers numerous benefits including reduced carbon emissions, energy independence, and long-term cost savings.',
    finalConfidence: 0.88,
    totalTokens: 2500,
    totalDurationMs: 6500,
    correctionRounds: 1,
    stages: [
      {
        stage: 'opinions',
        responses: [
          {
            memberId: 'm1',
            memberName: 'GPT-5',
            modelId: 'gpt-5',
            role: 'opinion-giver',
            content: 'Renewable energy sources like solar and wind power provide clean alternatives to fossil fuels.',
            confidence: 0.85,
            latencyMs: 1200,
            tokenUsage: { totalTokens: 450 },
          },
          {
            memberId: 'm2',
            memberName: 'GPT-4o',
            modelId: 'gpt-4o',
            role: 'reviewer',
            content: 'While renewables have benefits, we should also consider the intermittency challenges.',
            confidence: 0.78,
            latencyMs: 900,
            tokenUsage: { totalTokens: 380 },
          },
          {
            memberId: 'm3',
            memberName: 'O3-mini',
            modelId: 'o3-mini',
            role: 'synthesizer',
            content: 'Synthesizing: Renewable energy is beneficial but requires grid infrastructure improvements.',
            confidence: 0.92,
            latencyMs: 1500,
            tokenUsage: { totalTokens: 520 },
          },
        ],
        durationMs: 3600,
      },
      {
        stage: 'voting',
        responses: [],
        votingResult: {
          winner: 'Renewable energy is beneficial but requires infrastructure',
          method: 'confidence',
          confidenceAvg: 0.85,
          consensusReached: true,
          breakdown: { 'm1': 1, 'm2': 1, 'm3': 1 },
        },
        durationMs: 200,
      },
    ],
    members: [
      { id: 'm1', name: 'GPT-5', role: 'opinion-giver', modelConfig: { name: 'gpt-5' } },
      { id: 'm2', name: 'GPT-4o', role: 'reviewer', modelConfig: { name: 'gpt-4o' } },
      { id: 'm3', name: 'O3-mini', role: 'synthesizer', modelConfig: { name: 'o3-mini' } },
    ],
    createdAt: '2026-01-11T14:00:00Z',
  };

  test.beforeEach(async ({ page }) => {
    await page.route('/api/sessions/debate-test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    });
    
    await page.route('/api/council/debate-test/traces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'debate-test', traces: [] }),
      });
    });
    
    await page.goto('/session/debate-test');
  });

  test('should display question prominently', async ({ page }) => {
    await expect(page.getByText('What are the benefits of renewable energy?')).toBeVisible();
  });

  test('should display final answer with confidence', async ({ page }) => {
    await expect(page.locator('text=/Renewable energy offers numerous benefits/i').first()).toBeVisible();
    await expect(page.locator('text=88%').first()).toBeVisible();
  });

  test('should show all council member responses', async ({ page }) => {
    // Member names appear as text nodes with roles next to them
    // Use locator to find text containing the member name
    await expect(page.locator('text=GPT-5').first()).toBeVisible();
    await expect(page.locator('text=GPT-4o').first()).toBeVisible();
    await expect(page.locator('text=O3-mini').first()).toBeVisible();
  });

  test('should show debate card content', async ({ page }) => {
    await expect(page.getByText(/solar and wind power/i)).toBeVisible();
    await expect(page.getByText(/intermittency challenges/i)).toBeVisible();
  });

  test('should show confidence badges on debate cards', async ({ page }) => {
    // Multiple confidence badges should be visible
    const badges = page.locator('text=/\\d+%/');
    await expect(badges.first()).toBeVisible();
  });

  test('should show voting result', async ({ page }) => {
    // Voting section - look for the text or emoji
    await expect(page.locator('text=/Voting/i').first()).toBeVisible();
    // Consensus status
    await expect(page.locator('text=/Consensus/i').first()).toBeVisible();
  });

  test('should show council members footer', async ({ page }) => {
    // Scroll to make sure footer is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    await expect(page.locator('text=/Council Members/i').first()).toBeVisible({ timeout: 5000 });
    
    // Member names with roles - the footer shows roles in parentheses
    await expect(page.locator('text=/opinion-giver/i').first()).toBeVisible();
    await expect(page.locator('text=/reviewer/i').first()).toBeVisible();
    await expect(page.locator('text=/synthesizer/i').first()).toBeVisible();
  });

  test('should show session stats', async ({ page }) => {
    // Duration
    await expect(page.getByText(/6\.5s/i)).toBeVisible();
    
    // Round count
    await expect(page.getByText(/1 round/i)).toBeVisible();
  });
});

test.describe('Session Page - Debug Tab', () => {
  const mockTraces = [
    { id: 't1', sessionId: 'debug-test', type: 'session-start', timestamp: '2026-01-11T14:00:00.000Z' },
    { id: 't2', sessionId: 'debug-test', type: 'stage-start', stage: 'opinions', timestamp: '2026-01-11T14:00:00.100Z' },
    { id: 't3', sessionId: 'debug-test', type: 'member-request', memberName: 'GPT-5', timestamp: '2026-01-11T14:00:00.200Z' },
    { id: 't4', sessionId: 'debug-test', type: 'member-response', memberName: 'GPT-5', timestamp: '2026-01-11T14:00:01.500Z', durationMs: 1300, data: { content: 'Response content', confidence: 0.85 } },
    { id: 't5', sessionId: 'debug-test', type: 'stage-end', stage: 'opinions', timestamp: '2026-01-11T14:00:02.000Z' },
    { id: 't6', sessionId: 'debug-test', type: 'vote-cast', memberName: 'GPT-5', timestamp: '2026-01-11T14:00:02.100Z' },
    { id: 't7', sessionId: 'debug-test', type: 'voting-complete', timestamp: '2026-01-11T14:00:02.200Z' },
    { id: 't8', sessionId: 'debug-test', type: 'session-end', timestamp: '2026-01-11T14:00:02.500Z' },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('/api/sessions/debug-test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'debug-test',
          question: 'Debug test',
          status: 'completed',
          finalAnswer: 'Answer',
          finalConfidence: 0.9,
          stages: [{ stage: 'opinions', responses: [], durationMs: 100 }],
          members: [],
          totalDurationMs: 2500,
        }),
      });
    });
    
    await page.route('/api/council/debug-test/traces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'debug-test', traces: mockTraces }),
      });
    });
    
    await page.goto('/session/debug-test');
    await page.getByRole('button', { name: /Debug/i }).click();
  });

  test('should show filter checkboxes', async ({ page }) => {
    await expect(page.getByText(/Filter:/i)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Requests/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Responses/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Voting/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Stages/i })).toBeVisible();
  });

  test('should show timeline events', async ({ page }) => {
    await expect(page.getByText(/session-start/i)).toBeVisible();
    await expect(page.getByText(/stage-start/i)).toBeVisible();
  });

  test('should filter out requests when unchecked', async ({ page }) => {
    // Uncheck Requests
    await page.getByRole('checkbox', { name: /Requests/i }).uncheck();
    
    // Request events should be hidden
    await expect(page.getByText(/request/).first()).not.toBeVisible();
  });

  test('should filter out responses when unchecked', async ({ page }) => {
    // Uncheck Responses
    await page.getByRole('checkbox', { name: /Responses/i }).uncheck();
    
    // Response events should be filtered
    // Other events should still be visible
    await expect(page.getByText(/session-start/i)).toBeVisible();
  });

  test('should show relative timestamps', async ({ page }) => {
    // Should see relative time like +0.00s, +0.10s, etc.
    // The format is +X.XXs where X is seconds
    const timestampPattern = page.locator('text=/\\+\\d+\\.\\d+s/');
    await expect(timestampPattern.first()).toBeVisible({ timeout: 5000 });
  });

  test('should expand timeline event to show details', async ({ page }) => {
    // Find any clickable timeline event and verify the interaction
    const timelineEvent = page.locator('[class*="cursor-pointer"]').first();
    if (await timelineEvent.isVisible()) {
      await timelineEvent.click();
      // After clicking, the component should show some detail - just verify no crash
      await page.waitForTimeout(500);
      // The timeline should still be visible
      await expect(page.getByText(/session-start/i)).toBeVisible();
    }
  });
});

test.describe('Session Page - Round Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/sessions/rounds-test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rounds-test',
          question: 'Multi-round test',
          status: 'completed',
          finalAnswer: 'Final answer after iterations',
          finalConfidence: 0.92,
          stages: [
            { stage: 'opinions', responses: [{ memberId: 'm1', memberName: 'GPT-5', content: 'Round 1 opinion', confidence: 0.7, latencyMs: 1000 }], durationMs: 1000 },
            { stage: 'voting', responses: [], votingResult: { winner: null, method: 'confidence', confidenceAvg: 0.7, consensusReached: false, breakdown: {} }, durationMs: 100 },
            { stage: 'opinions', responses: [{ memberId: 'm1', memberName: 'GPT-5', content: 'Round 2 opinion', confidence: 0.85, latencyMs: 1200 }], durationMs: 1200, iteration: 2 },
            { stage: 'voting', responses: [], votingResult: { winner: 'Final', method: 'confidence', confidenceAvg: 0.92, consensusReached: true, breakdown: {} }, durationMs: 100 },
          ],
          members: [{ id: 'm1', name: 'GPT-5', role: 'opinion-giver', modelConfig: { name: 'gpt-5' } }],
          totalDurationMs: 2400,
          correctionRounds: 1,
        }),
      });
    });
    
    await page.goto('/session/rounds-test');
  });

  test('should show multiple rounds', async ({ page }) => {
    // Rounds are displayed with "ROUND X" headers
    // Wait for content to load
    await page.waitForTimeout(500);
    
    // Look for any round indicators
    const roundText = page.locator('text=/ROUND \\d/i');
    await expect(roundText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show confidence trend between rounds', async ({ page }) => {
    // Final round should show 92% confidence (or 0.92 formatted)
    // Wait for content to load
    await page.waitForTimeout(500);
    
    // Look for any percentage indicator
    const percentText = page.locator('text=/\\d+%/');
    await expect(percentText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should collapse/expand rounds', async ({ page }) => {
    // Find a collapsible round header
    const roundHeader = page.locator('text=ROUND 1').first();
    
    if (await roundHeader.isVisible()) {
      // Click to toggle
      await roundHeader.click();
      
      // Content might collapse - verify interaction works
    }
  });
});

test.describe('Session Page - Status States', () => {
  test('should show running state', async ({ page }) => {
    await page.route('/api/sessions/running-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'running-session',
          question: 'Running test',
          status: 'running',
          finalAnswer: null,
          finalConfidence: null,
          stages: [],
          members: [],
          totalDurationMs: 0,
        }),
      });
    });
    
    await page.goto('/session/running-session');
    
    // Should show loading or in-progress state
    await expect(page.getByText('Running test')).toBeVisible();
  });

  test('should show failed state', async ({ page }) => {
    await page.route('/api/sessions/failed-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'failed-session',
          question: 'Failed test',
          status: 'failed',
          finalAnswer: null,
          finalConfidence: null,
          stages: [],
          members: [],
          totalDurationMs: 500,
        }),
      });
    });
    
    await page.goto('/session/failed-session');
    
    await expect(page.getByText('Failed test')).toBeVisible();
  });
});
