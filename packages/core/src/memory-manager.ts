import type { CouncilMemory, MemoryConfig, StageResult } from './types.js';
import type { ModelAdapter } from './adapters/base.js';
import { MEMORY_COMPRESSION_PROMPT } from './prompts.js';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  compressionEnabled: true,
  maxContextTokens: 8000,
  persistConsensus: true,
  persistDisagreements: true,
  persistKeyInsights: true,
  longTermEnabled: false,
};

// =============================================================================
// Memory Manager
// =============================================================================

export class MemoryManager {
  private config: MemoryConfig;
  private adapter?: ModelAdapter;
  private memory: CouncilMemory;

  constructor(config?: Partial<MemoryConfig>, adapter?: ModelAdapter) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.adapter = adapter;
    this.memory = this.initializeMemory();
  }

  /**
   * Initialize empty memory
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
   * Update memory with stage results
   */
  updateFromStageResult(result: StageResult, iteration: number): void {
    this.memory.shortTerm.currentIteration = iteration;

    // Update confidence
    if (result.votingResult) {
      this.memory.shortTerm.currentConfidence = result.votingResult.confidenceAvg;

      // Store consensus
      if (this.config.persistConsensus && result.votingResult.winner) {
        this.memory.working.consensusPoints.push(result.votingResult.winner);
      }
    }

    // Store responses (truncated)
    for (const response of result.responses) {
      this.memory.shortTerm.previousResponses.push({
        iteration,
        memberId: response.memberId,
        content: this.truncateContent(response.content, 500),
        confidence: response.confidence,
      });
    }

    // Track refinements
    this.memory.working.refinements.push({
      iteration,
      what: result.votingResult?.winner ?? 'No consensus reached',
      why: `Stage: ${result.stage}, Confidence: ${result.votingResult?.confidenceAvg?.toFixed(2) ?? 'N/A'}`,
    });
  }

  /**
   * Add a key insight
   */
  addInsight(insight: string): void {
    if (this.config.persistKeyInsights && !this.memory.shortTerm.keyInsights.includes(insight)) {
      this.memory.shortTerm.keyInsights.push(insight);
    }
  }

  /**
   * Add an open question
   */
  addOpenQuestion(question: string): void {
    if (!this.memory.working.openQuestions.includes(question)) {
      this.memory.working.openQuestions.push(question);
    }
  }

  /**
   * Mark a question as resolved
   */
  resolveQuestion(question: string): void {
    const index = this.memory.working.openQuestions.indexOf(question);
    if (index > -1) {
      this.memory.working.openQuestions.splice(index, 1);
    }
  }

  /**
   * Add a disagreement
   */
  addDisagreement(disagreement: string): void {
    if (this.config.persistDisagreements && !this.memory.working.disagreements.includes(disagreement)) {
      this.memory.working.disagreements.push(disagreement);
    }
  }

  /**
   * Compress memory using LLM
   */
  async compress(): Promise<void> {
    if (!this.config.compressionEnabled || !this.adapter) {
      // Use simple compression
      this.simpleCompress();
      return;
    }

    try {
      const deliberation = this.buildDeliberationText();
      const prompt = MEMORY_COMPRESSION_PROMPT
        .replace('{maxTokens}', String(Math.floor(this.config.maxContextTokens / 2)))
        .replace('{deliberation}', deliberation);

      const response = await this.adapter.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: Math.floor(this.config.maxContextTokens / 2), temperature: 0.3 }
      );

      this.memory.compressed = {
        summary: response.content,
        tokenCount: response.tokenUsage?.completionTokens ?? this.estimateTokens(response.content),
        lastUpdated: new Date().toISOString(),
      };

      // Clear detailed data after compression
      this.pruneDetailedData();
    } catch (error) {
      console.warn('LLM compression failed, using simple compression:', error);
      this.simpleCompress();
    }
  }

  /**
   * Simple compression without LLM
   */
  private simpleCompress(): void {
    const summary = this.buildSimpleSummary();
    this.memory.compressed = {
      summary,
      tokenCount: this.estimateTokens(summary),
      lastUpdated: new Date().toISOString(),
    };
    this.pruneDetailedData();
  }

  /**
   * Build text representation of deliberation for compression
   */
  private buildDeliberationText(): string {
    const parts: string[] = [];

    parts.push(`Question: ${this.memory.shortTerm.question}`);
    parts.push(`Current Iteration: ${this.memory.shortTerm.currentIteration}`);
    parts.push(`Confidence: ${this.memory.shortTerm.currentConfidence.toFixed(2)}`);

    if (this.memory.working.consensusPoints.length > 0) {
      parts.push(`\nConsensus Points:\n${this.memory.working.consensusPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    }

    if (this.memory.working.disagreements.length > 0) {
      parts.push(`\nDisagreements:\n${this.memory.working.disagreements.map(d => `- ${d}`).join('\n')}`);
    }

    if (this.memory.shortTerm.keyInsights.length > 0) {
      parts.push(`\nKey Insights:\n${this.memory.shortTerm.keyInsights.map(i => `- ${i}`).join('\n')}`);
    }

    if (this.memory.working.refinements.length > 0) {
      parts.push(`\nRefinements:\n${this.memory.working.refinements.map(r => `- Iteration ${r.iteration}: ${r.what}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build simple summary without LLM
   */
  private buildSimpleSummary(): string {
    const parts: string[] = [];

    // Last consensus
    const lastConsensus = this.memory.working.consensusPoints.at(-1);
    if (lastConsensus) {
      parts.push(`Latest consensus: ${this.truncateContent(lastConsensus, 200)}`);
    }

    // Key insights (last 3)
    if (this.memory.shortTerm.keyInsights.length > 0) {
      const recent = this.memory.shortTerm.keyInsights.slice(-3);
      parts.push(`Key insights: ${recent.join('; ')}`);
    }

    // Open questions (last 2)
    if (this.memory.working.openQuestions.length > 0) {
      const open = this.memory.working.openQuestions.slice(-2);
      parts.push(`Open questions: ${open.join('; ')}`);
    }

    // Confidence
    parts.push(`Current confidence: ${this.memory.shortTerm.currentConfidence.toFixed(2)}`);

    return parts.join('\n\n');
  }

  /**
   * Prune detailed data to save memory
   */
  private pruneDetailedData(): void {
    // Keep only last 5 responses
    if (this.memory.shortTerm.previousResponses.length > 5) {
      this.memory.shortTerm.previousResponses = this.memory.shortTerm.previousResponses.slice(-5);
    }

    // Keep only last 5 consensus points
    if (this.memory.working.consensusPoints.length > 5) {
      this.memory.working.consensusPoints = this.memory.working.consensusPoints.slice(-5);
    }

    // Keep only last 3 refinements
    if (this.memory.working.refinements.length > 3) {
      this.memory.working.refinements = this.memory.working.refinements.slice(-3);
    }
  }

  /**
   * Get context string for injection into prompts
   */
  getContextString(): string {
    if (this.memory.compressed?.summary) {
      return `## Previous Context\n\n${this.memory.compressed.summary}`;
    }

    return this.buildSimpleSummary();
  }

  /**
   * Get full memory
   */
  getMemory(): CouncilMemory {
    return { ...this.memory };
  }

  /**
   * Reset memory for new question
   */
  reset(): void {
    this.memory = this.initializeMemory();
  }

  /**
   * Truncate content to max length
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if memory exceeds limits
   */
  isOverLimit(): boolean {
    const totalTokens = this.estimateTokens(JSON.stringify(this.memory));
    return totalTokens > this.config.maxContextTokens;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalResponses: number;
    consensusPoints: number;
    insights: number;
    openQuestions: number;
    estimatedTokens: number;
    isCompressed: boolean;
  } {
    return {
      totalResponses: this.memory.shortTerm.previousResponses.length,
      consensusPoints: this.memory.working.consensusPoints.length,
      insights: this.memory.shortTerm.keyInsights.length,
      openQuestions: this.memory.working.openQuestions.length,
      estimatedTokens: this.estimateTokens(JSON.stringify(this.memory)),
      isCompressed: !!this.memory.compressed,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createMemoryManager(
  config?: Partial<MemoryConfig>,
  adapter?: ModelAdapter
): MemoryManager {
  return new MemoryManager(config, adapter);
}

export default MemoryManager;
