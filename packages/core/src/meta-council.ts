import type {
  MetaCouncilConfig,
  MetaCouncilConfigInput,
  CouncilPlan,
  ComplexityLevel,
  DomainType,
  CouncilRole,
} from './types.js';
import type { ModelAdapter } from './adapters/base.js';
import { META_COUNCIL_SYSTEM_PROMPT, META_COUNCIL_USER_PROMPT_TEMPLATE } from './prompts.js';

// =============================================================================
// Output type for council configuration (all fields optional for flexibility)
// =============================================================================

export interface DynamicCouncilConfigOutput {
  meta?: {
    planningMode?: 'static' | 'llm' | 'hybrid';
    plannerModel?: string;
    complexity?: ComplexityLevel;
    domain?: DomainType;
    reasoning?: string;
  };
  council: {
    size: number;
    members: Array<{
      model: string;
      role: CouncilRole;
      persona?: string;
      systemPrompt?: string;
      temperature?: number;
      weight?: number;
    }>;
    voting?: {
      method?: 'majority' | 'super-majority' | 'unanimous' | 'ranked-choice' | 'weighted' | 'confidence' | 'consensus' | 'veto';
      threshold?: number;
    };
  };
  iteration?: {
    enabled?: boolean;
    maxIterations?: number;
    maxTotalTokens?: number;
    maxDurationMs?: number;
    maxDepth?: number;
    convergenceThreshold?: number;
    improvementThreshold?: number;
    strategy?: 'refine' | 'escalate' | 'specialize' | 'debate';
  };
  memory?: {
    enabled?: boolean;
    compressionEnabled?: boolean;
    maxContextTokens?: number;
    persistConsensus?: boolean;
    persistDisagreements?: boolean;
    persistKeyInsights?: boolean;
    longTermEnabled?: boolean;
  };
}

// =============================================================================
// Default Static Rules
// =============================================================================

interface StaticRule {
  pattern: RegExp;
  preset: string;
  complexity: ComplexityLevel;
  allowIterations: boolean;
}

const DEFAULT_STATIC_RULES: StaticRule[] = [
  // Technical/Programming
  { pattern: /code|program|function|algorithm|debug|implement|refactor/i, preset: 'reasoning', complexity: 'complex', allowIterations: true },
  { pattern: /api|database|server|deploy|architecture/i, preset: 'reasoning', complexity: 'moderate', allowIterations: true },

  // Math/Reasoning
  { pattern: /math|calculate|solve|equation|proof|derive/i, preset: 'reasoning', complexity: 'complex', allowIterations: true },
  { pattern: /logic|reason|analyze|deduce|infer/i, preset: 'reasoning', complexity: 'complex', allowIterations: true },

  // Simple queries
  { pattern: /what is|define|explain simply|basic|quick/i, preset: 'small', complexity: 'simple', allowIterations: false },
  { pattern: /list|enumerate|name|how many/i, preset: 'small', complexity: 'simple', allowIterations: false },

  // Comparison/Analysis
  { pattern: /compare|contrast|vs|versus|difference|better/i, preset: 'diverse', complexity: 'moderate', allowIterations: true },
  { pattern: /analyze|evaluate|assess|review/i, preset: 'diverse', complexity: 'moderate', allowIterations: true },

  // Debate/Opinion
  { pattern: /debate|argue|pros.?cons|should|opinion|controversial/i, preset: 'diverse', complexity: 'complex', allowIterations: true },
  { pattern: /ethical|moral|right.?wrong|fair/i, preset: 'diverse', complexity: 'complex', allowIterations: true },

  // Creative
  { pattern: /creative|write|story|poem|imagine|invent/i, preset: 'diverse', complexity: 'moderate', allowIterations: false },
  { pattern: /design|brainstorm|ideate|novel/i, preset: 'diverse', complexity: 'moderate', allowIterations: true },
];

// =============================================================================
// Preset Configurations
// =============================================================================

interface PresetConfig {
  size: number;
  roles: Array<{ role: CouncilRole; model: string; weight?: number }>;
  votingMethod: 'majority' | 'weighted' | 'confidence' | 'ranked-choice';
}

const PRESETS: Record<string, PresetConfig> = {
  small: {
    size: 3,
    roles: [
      { role: 'opinion-giver', model: 'gpt-5-mini' },
      { role: 'reviewer', model: 'gpt-5-mini' },
      { role: 'synthesizer', model: 'gpt-5' },
    ],
    votingMethod: 'majority',
  },
  standard: {
    size: 5,
    roles: [
      { role: 'opinion-giver', model: 'gpt-5' },
      { role: 'opinion-giver', model: 'gpt-5-mini' },
      { role: 'reviewer', model: 'gpt-4.1' },
      { role: 'devil-advocate', model: 'gpt-5' },
      { role: 'synthesizer', model: 'gpt-5' },
    ],
    votingMethod: 'majority',
  },
  reasoning: {
    size: 5,
    roles: [
      { role: 'opinion-giver', model: 'o3', weight: 1.3 },
      { role: 'opinion-giver', model: 'o4-mini', weight: 1.2 },
      { role: 'reviewer', model: 'gpt-5' },
      { role: 'fact-checker', model: 'gpt-5-mini' },
      { role: 'synthesizer', model: 'o3', weight: 1.3 },
    ],
    votingMethod: 'weighted',
  },
  diverse: {
    size: 7,
    roles: [
      { role: 'opinion-giver', model: 'gpt-5' },
      { role: 'opinion-giver', model: 'o3', weight: 1.2 },
      { role: 'devil-advocate', model: 'gpt-5' },
      { role: 'skeptic', model: 'gpt-5-mini' },
      { role: 'reviewer', model: 'gpt-4.1' },
      { role: 'creative', model: 'gpt-5' },
      { role: 'synthesizer', model: 'gpt-5' },
    ],
    votingMethod: 'confidence',
  },
};

// =============================================================================
// JSON Schema for LLM Planning
// =============================================================================

const COUNCIL_PLAN_JSON_SCHEMA = {
  name: 'council_plan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      complexity: {
        type: 'string',
        enum: ['simple', 'moderate', 'complex', 'expert'],
        description: 'Assessed complexity level of the question',
      },
      domain: {
        type: 'string',
        enum: ['general', 'technical', 'creative', 'ethical', 'factual', 'analytical', 'strategic'],
        description: 'Primary domain of the question',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of your analysis',
      },
      councilSize: {
        type: 'number',
        description: 'Recommended council size (3-9)',
      },
      roles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['opinion-giver', 'reviewer', 'synthesizer', 'devil-advocate', 'fact-checker', 'domain-expert', 'skeptic', 'creative', 'critic', 'moderator'],
            },
            model: {
              type: 'string',
              enum: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'o3', 'o3-mini', 'o4-mini'],
            },
            persona: {
              type: 'string',
              description: 'Optional persona for this role',
            },
            weight: {
              type: 'number',
              description: 'Optional voting weight (0.5-2.0)',
            },
          },
          required: ['role', 'model'],
          additionalProperties: false,
        },
        description: 'Council member configurations',
      },
      votingMethod: {
        type: 'string',
        enum: ['majority', 'weighted', 'confidence', 'ranked-choice'],
        description: 'Recommended voting method',
      },
      allowIterations: {
        type: 'boolean',
        description: 'Whether iterative refinement is recommended',
      },
      maxIterations: {
        type: 'number',
        description: 'Max iterations if allowed (1-5)',
      },
      iterationStrategy: {
        type: 'string',
        enum: ['refine', 'escalate', 'specialize', 'debate'],
        description: 'Strategy for iterations',
      },
    },
    required: ['complexity', 'domain', 'reasoning', 'councilSize', 'roles', 'votingMethod', 'allowIterations'],
    additionalProperties: false,
  },
};

// =============================================================================
// MetaCouncil Class
// =============================================================================

export class MetaCouncil {
  private config: {
    planningMode: 'static' | 'llm' | 'hybrid';
    plannerModel: string;
    lengthThresholds?: {
      short: number;
      medium: number;
      long: number;
    };
  };
  private adapter?: ModelAdapter;

  constructor(config: MetaCouncilConfigInput, adapter?: ModelAdapter) {
    this.config = {
      planningMode: config.planningMode ?? 'hybrid',
      plannerModel: config.plannerModel ?? 'gpt-5-mini',
      lengthThresholds: config.staticRules?.lengthThresholds 
        ? {
            short: config.staticRules.lengthThresholds.short ?? 100,
            medium: config.staticRules.lengthThresholds.medium ?? 500,
            long: config.staticRules.lengthThresholds.long ?? 1000,
          }
        : undefined,
    };
    this.adapter = adapter;
  }

  /**
   * Analyze a question and produce an optimal council configuration
   */
  async plan(question: string): Promise<DynamicCouncilConfigOutput> {
    switch (this.config.planningMode) {
      case 'static':
        return this.staticPlan(question);

      case 'llm':
        if (!this.adapter) {
          console.warn('No adapter provided for LLM planning, falling back to static');
          return this.staticPlan(question);
        }
        return this.llmPlan(question);

      case 'hybrid':
      default:
        // Start with static analysis
        const staticResult = this.staticPlan(question);
        
        // Escalate to LLM if complex
        if (
          this.adapter &&
          (staticResult.meta?.complexity === 'complex' || staticResult.meta?.complexity === 'expert')
        ) {
          try {
            return await this.llmPlan(question);
          } catch (error) {
            console.warn('LLM planning failed, using static result:', error);
            return staticResult;
          }
        }
        
        return staticResult;
    }
  }

  /**
   * Static rule-based planning
   */
  private staticPlan(question: string): DynamicCouncilConfigOutput {
    // Match against rules
    for (const rule of DEFAULT_STATIC_RULES) {
      if (rule.pattern.test(question)) {
        return this.buildConfigFromPreset(rule.preset, rule.complexity, rule.allowIterations, 'static');
      }
    }

    // Length-based fallback
    const length = question.length;
    const thresholds = this.config.lengthThresholds ?? { short: 100, medium: 500, long: 1000 };
    
    if (length < thresholds.short) {
      return this.buildConfigFromPreset('small', 'simple', false, 'static');
    } else if (length < thresholds.medium) {
      return this.buildConfigFromPreset('standard', 'moderate', false, 'static');
    } else if (length < thresholds.long) {
      return this.buildConfigFromPreset('standard', 'moderate', true, 'static');
    } else {
      return this.buildConfigFromPreset('diverse', 'complex', true, 'static');
    }
  }

  /**
   * LLM-based planning with structured JSON output
   */
  private async llmPlan(question: string): Promise<DynamicCouncilConfigOutput> {
    const userPrompt = META_COUNCIL_USER_PROMPT_TEMPLATE.replace('{question}', question);

    const response = await this.adapter!.complete(
      [
        { role: 'system', content: META_COUNCIL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      {
        responseFormat: {
          type: 'json_schema',
          json_schema: COUNCIL_PLAN_JSON_SCHEMA,
        },
        temperature: 0.3, // Low temperature for consistent planning
        maxTokens: 2000,
      }
    );

    const plan = JSON.parse(response.content) as CouncilPlan;
    return this.buildConfigFromPlan(plan);
  }

  /**
   * Build configuration from a preset
   */
  private buildConfigFromPreset(
    presetName: string,
    complexity: ComplexityLevel,
    allowIterations: boolean,
    mode: 'static' | 'llm'
  ): DynamicCouncilConfigOutput {
    const preset = PRESETS[presetName] ?? PRESETS['standard'];
    
    // Ensure preset is defined (TypeScript guard)
    if (!preset) {
      // Fallback to a default configuration
      return {
        meta: { planningMode: mode, complexity, reasoning: 'Fallback to default' },
        council: {
          size: 3,
          members: [
            { model: 'gpt-5', role: 'opinion-giver' },
            { model: 'gpt-5-mini', role: 'reviewer' },
            { model: 'gpt-5', role: 'synthesizer' },
          ],
          voting: { method: 'majority' },
        },
        iteration: { enabled: false },
        memory: { enabled: false },
      };
    }

    return {
      meta: {
        planningMode: mode,
        complexity,
        reasoning: `Matched preset '${presetName}' based on ${mode} rules`,
      },
      council: {
        size: preset.size,
        members: preset.roles.map((r) => ({
          model: r.model,
          role: r.role,
          weight: r.weight ?? 1,
        })),
        voting: {
          method: preset.votingMethod,
        },
      },
      iteration: {
        enabled: allowIterations,
        maxIterations: allowIterations ? 3 : 1,
        strategy: 'refine',
      },
      memory: {
        enabled: allowIterations,
        compressionEnabled: true,
        maxContextTokens: 8000,
      },
    };
  }

  /**
   * Build configuration from an LLM-generated plan
   */
  private buildConfigFromPlan(plan: CouncilPlan): DynamicCouncilConfigOutput {
    return {
      meta: {
        planningMode: 'llm',
        complexity: plan.complexity,
        domain: plan.domain,
        reasoning: plan.reasoning,
      },
      council: {
        size: plan.councilSize,
        members: plan.roles.map((r) => ({
          model: r.model,
          role: r.role,
          persona: r.persona,
          weight: r.weight ?? 1,
        })),
        voting: {
          method: plan.votingMethod,
        },
      },
      iteration: {
        enabled: plan.allowIterations,
        maxIterations: plan.maxIterations ?? 3,
        strategy: plan.iterationStrategy ?? 'refine',
      },
      memory: {
        enabled: plan.allowIterations,
        compressionEnabled: true,
        maxContextTokens: 8000,
      },
    };
  }

  /**
   * Get analysis without full plan (for debugging/preview)
   */
  analyzeQuestion(question: string): { complexity: ComplexityLevel; domain: DomainType; matchedRule?: string } {
    for (const rule of DEFAULT_STATIC_RULES) {
      if (rule.pattern.test(question)) {
        return {
          complexity: rule.complexity,
          domain: this.inferDomain(question, rule.pattern.source),
          matchedRule: rule.pattern.source,
        };
      }
    }

    return {
      complexity: 'moderate',
      domain: 'general',
    };
  }

  /**
   * Infer domain from matched pattern
   */
  private inferDomain(question: string, matchedPattern: string): DomainType {
    // Technical patterns
    if (/code|program|api|database|algorithm/.test(matchedPattern)) return 'technical';
    
    // Math/analytical
    if (/math|calculate|solve|logic|reason|analyze/.test(matchedPattern)) return 'analytical';
    
    // Creative
    if (/creative|write|story|design/.test(matchedPattern)) return 'creative';
    
    // Ethical
    if (/ethical|moral|debate|controversial/.test(matchedPattern)) return 'ethical';
    
    // Factual
    if (/what is|define|list|how many/.test(matchedPattern)) return 'factual';
    
    return 'general';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createMetaCouncil(
  config?: MetaCouncilConfigInput,
  adapter?: ModelAdapter
): MetaCouncil {
  return new MetaCouncil(config ?? {}, adapter);
}

export default MetaCouncil;
