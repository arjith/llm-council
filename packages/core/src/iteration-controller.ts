import type {
  IterationConfig,
  IterationState,
  IterationDecision,
  IterationContext,
  CouncilMemory,
  StageResult,
} from './types.js';
import { buildIterationContextPrompt } from './prompts.js';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_ITERATION_CONFIG: IterationConfig = {
  enabled: false,
  maxIterations: 3,
  maxTotalTokens: 100000,
  maxDurationMs: 120000,  // 2 minutes
  maxDepth: 2,
  convergenceThreshold: 0.85,
  improvementThreshold: 0.05,
  strategy: 'refine',
};

// =============================================================================
// Iteration Controller
// =============================================================================

export class IterationController {
  private config: IterationConfig;
  private state: IterationState;
  private memory: CouncilMemory;
  private startTime: number;

  constructor(config?: Partial<IterationConfig>) {
    this.config = { ...DEFAULT_ITERATION_CONFIG, ...config };
    this.state = this.initializeState();
    this.memory = this.initializeMemory();
    this.startTime = Date.now();
  }

  /**
   * Initialize iteration state
   */
  private initializeState(): IterationState {
    return {
      currentIteration: 0,
      totalIterations: 0,
      tokensSoFar: 0,
      elapsedMs: 0,
      confidenceHistory: [],
      improvements: [],
      decisions: [],
    };
  }

  /**
   * Initialize memory structure
   */
  private initializeMemory(): CouncilMemory {
    return {
      shortTerm: {
        question: '',
        currentIteration: 0,
        previousResponses: [],
        currentConfidence: 0,
        keyInsights: [],
      },
      working: {
        consensusPoints: [],
        disagreements: [],
        openQuestions: [],
        refinements: [],
      },
    };
  }

  /**
   * Set the question being processed
   */
  setQuestion(question: string): void {
    this.memory.shortTerm.question = question;
  }

  /**
   * Check if iteration should continue
   */
  shouldContinue(): { continue: boolean; reason: string; decision: IterationDecision } {
    this.state.elapsedMs = Date.now() - this.startTime;

    // Not enabled
    if (!this.config.enabled) {
      return this.createDecision(false, 'Iteration not enabled');
    }

    // Check hard limits
    if (this.state.currentIteration >= this.config.maxIterations) {
      return this.createDecision(false, `Max iterations reached (${this.config.maxIterations})`);
    }

    if (this.state.tokensSoFar >= this.config.maxTotalTokens) {
      return this.createDecision(false, `Token limit reached (${this.config.maxTotalTokens})`);
    }

    if (this.state.elapsedMs >= this.config.maxDurationMs) {
      return this.createDecision(false, `Time limit reached (${this.config.maxDurationMs}ms)`);
    }

    // Check convergence
    const lastConfidence = this.state.confidenceHistory.at(-1) ?? 0;
    if (lastConfidence >= this.config.convergenceThreshold) {
      return this.createDecision(false, `Convergence reached (confidence: ${lastConfidence.toFixed(2)} >= ${this.config.convergenceThreshold})`);
    }

    // Check improvement (after first iteration)
    if (this.state.improvements.length > 0) {
      const lastImprovement = this.state.improvements.at(-1) ?? 0;
      if (lastImprovement < this.config.improvementThreshold && this.state.currentIteration > 1) {
        return this.createDecision(false, `Insufficient improvement (${lastImprovement.toFixed(3)} < ${this.config.improvementThreshold})`);
      }
    }

    // Continue with appropriate action
    const action = this.determineAction();
    return this.createDecision(true, `Continue: ${action}`, action);
  }

  /**
   * Determine next action based on strategy
   */
  private determineAction(): 'continue' | 'escalate' {
    switch (this.config.strategy) {
      case 'escalate':
        // Escalate if confidence is stagnant
        const recentConfidences = this.state.confidenceHistory.slice(-2);
        if (recentConfidences.length >= 2) {
          const first = recentConfidences[0];
          const second = recentConfidences[1];
          if (first !== undefined && second !== undefined) {
            const diff = Math.abs(second - first);
            if (diff < 0.02) {
              return 'escalate';
            }
          }
        }
        return 'continue';

      case 'refine':
      case 'specialize':
      case 'debate':
      default:
        return 'continue';
    }
  }

  /**
   * Create a decision record
   */
  private createDecision(
    shouldContinue: boolean,
    reason: string,
    action: 'continue' | 'stop' | 'escalate' = shouldContinue ? 'continue' : 'stop'
  ): { continue: boolean; reason: string; decision: IterationDecision } {
    const decision: IterationDecision = {
      iteration: this.state.currentIteration,
      action,
      reason,
      confidence: this.state.confidenceHistory.at(-1) ?? 0,
      tokensUsed: this.state.tokensSoFar,
      durationMs: this.state.elapsedMs,
    };

    this.state.decisions.push(decision);

    return { continue: shouldContinue, reason, decision };
  }

  /**
   * Record results from an iteration
   */
  recordIteration(result: StageResult, tokensUsed: number): void {
    const confidence = result.votingResult?.confidenceAvg ?? this.extractConfidence(result);
    const prevConfidence = this.state.confidenceHistory.at(-1) ?? 0;
    const improvement = confidence - prevConfidence;

    // Update state
    this.state.currentIteration++;
    this.state.totalIterations++;
    this.state.tokensSoFar += tokensUsed;
    this.state.elapsedMs = Date.now() - this.startTime;
    this.state.confidenceHistory.push(confidence);
    this.state.improvements.push(improvement);

    // Update memory
    this.memory.shortTerm.currentIteration = this.state.currentIteration;
    this.memory.shortTerm.currentConfidence = confidence;

    // Extract and store key information
    this.updateWorkingMemory(result);
  }

  /**
   * Extract confidence from result if not in voting
   */
  private extractConfidence(result: StageResult): number {
    const confidences = result.responses
      .map(r => r.confidence)
      .filter((c): c is number => c !== undefined);
    
    if (confidences.length === 0) return 0.5;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  /**
   * Update working memory with iteration results
   */
  private updateWorkingMemory(result: StageResult): void {
    // Store consensus if voting occurred
    if (result.votingResult?.winner) {
      this.memory.working.consensusPoints.push(result.votingResult.winner);
    }

    // Store responses for context
    for (const response of result.responses) {
      this.memory.shortTerm.previousResponses.push({
        iteration: this.state.currentIteration,
        memberId: response.memberId,
        content: response.content.substring(0, 1000), // Truncate for memory
        confidence: response.confidence,
      });
    }

    // Track refinement
    this.memory.working.refinements.push({
      iteration: this.state.currentIteration,
      what: result.votingResult?.winner ?? 'No consensus',
      why: `Confidence: ${(this.state.confidenceHistory.at(-1) ?? 0).toFixed(2)}`,
    });
  }

  /**
   * Add an open question to track
   */
  addOpenQuestion(question: string): void {
    if (!this.memory.working.openQuestions.includes(question)) {
      this.memory.working.openQuestions.push(question);
    }
  }

  /**
   * Add a key insight
   */
  addInsight(insight: string): void {
    if (!this.memory.shortTerm.keyInsights.includes(insight)) {
      this.memory.shortTerm.keyInsights.push(insight);
    }
  }

  /**
   * Record a disagreement
   */
  addDisagreement(disagreement: string): void {
    if (!this.memory.working.disagreements.includes(disagreement)) {
      this.memory.working.disagreements.push(disagreement);
    }
  }

  /**
   * Get context for the next iteration
   */
  getContext(): IterationContext {
    return {
      iteration: this.state.currentIteration + 1,
      previousSummary: this.buildPreviousSummary(),
      keyDecisions: this.memory.working.consensusPoints.slice(-5),
      openIssues: this.memory.working.openQuestions.slice(-5),
      confidenceTrend: this.state.confidenceHistory,
      instructions: this.generateInstructions(),
    };
  }

  /**
   * Get context prompt for injection into member prompts
   */
  getContextPrompt(): string {
    return buildIterationContextPrompt(this.getContext());
  }

  /**
   * Build summary of previous work
   */
  private buildPreviousSummary(): string {
    if (this.state.currentIteration === 0) {
      return 'This is the first iteration. No previous work.';
    }

    const parts: string[] = [];

    // Add consensus points
    if (this.memory.working.consensusPoints.length > 0) {
      const recent = this.memory.working.consensusPoints.slice(-3);
      parts.push(`Previous consensus: ${recent.join('; ')}`);
    }

    // Add confidence trajectory
    if (this.state.confidenceHistory.length > 0) {
      const trend = this.state.confidenceHistory.slice(-3).map(c => c.toFixed(2)).join(' → ');
      parts.push(`Confidence trend: ${trend}`);
    }

    // Add key insights
    if (this.memory.shortTerm.keyInsights.length > 0) {
      parts.push(`Key insights: ${this.memory.shortTerm.keyInsights.slice(-3).join('; ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Generate instructions for the next iteration
   */
  private generateInstructions(): string {
    const lastConfidence = this.state.confidenceHistory.at(-1) ?? 0;
    const lastImprovement = this.state.improvements.at(-1) ?? 0;

    const instructions: string[] = [];

    // Low confidence
    if (lastConfidence < 0.5) {
      instructions.push('Focus on building stronger arguments and gathering more evidence.');
    } else if (lastConfidence < 0.7) {
      instructions.push('Confidence is moderate. Look for additional supporting points.');
    } else {
      instructions.push('Confidence is good. Focus on refining and strengthening the answer.');
    }

    // Stagnant improvement
    if (lastImprovement < 0.02 && this.state.currentIteration > 1) {
      instructions.push('Progress has slowed. Consider alternative approaches or perspectives.');
    }

    // Open questions
    if (this.memory.working.openQuestions.length > 0) {
      instructions.push(`Address these open questions: ${this.memory.working.openQuestions.slice(-2).join(', ')}`);
    }

    // Disagreements
    if (this.memory.working.disagreements.length > 0) {
      instructions.push(`Resolve or acknowledge these disagreements: ${this.memory.working.disagreements.slice(-2).join(', ')}`);
    }

    return instructions.join('\n');
  }

  /**
   * Get current state
   */
  getState(): IterationState {
    return { ...this.state };
  }

  /**
   * Get memory
   */
  getMemory(): CouncilMemory {
    return { ...this.memory };
  }

  /**
   * Get all decisions made
   */
  getDecisions(): IterationDecision[] {
    return [...this.state.decisions];
  }

  /**
   * Check if any iterations have occurred
   */
  hasIterated(): boolean {
    return this.state.currentIteration > 0;
  }

  /**
   * Get remaining iterations
   */
  getRemainingIterations(): number {
    return Math.max(0, this.config.maxIterations - this.state.currentIteration);
  }

  /**
   * Get remaining tokens
   */
  getRemainingTokens(): number {
    return Math.max(0, this.config.maxTotalTokens - this.state.tokensSoFar);
  }

  /**
   * Get remaining time in ms
   */
  getRemainingTimeMs(): number {
    return Math.max(0, this.config.maxDurationMs - this.state.elapsedMs);
  }

  /**
   * Reset controller for new question
   */
  reset(): void {
    this.state = this.initializeState();
    this.memory = this.initializeMemory();
    this.startTime = Date.now();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createIterationController(
  config?: Partial<IterationConfig>
): IterationController {
  return new IterationController(config);
}

export default IterationController;
