import { z } from 'zod';

// =============================================================================
// Model Configuration
// =============================================================================

export const ModelProviderSchema = z.enum([
  'azure-openai',
  'azure-ai-foundry',
  'openai',
  'anthropic',
  'google',
  'custom'
]);

export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const ModelCapabilitySchema = z.enum([
  'chat',
  'reasoning',
  'vision',
  'code',
  'function-calling',
  'agents',
  'long-context'
]);

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ModelProviderSchema,
  deploymentName: z.string(),
  endpoint: z.string().url().optional(),
  apiKey: z.string().optional(),
  apiVersion: z.string().optional(),
  capabilities: z.array(ModelCapabilitySchema).default(['chat']),
  maxTokens: z.number().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).optional(),
  costPerInputToken: z.number().optional(),
  costPerOutputToken: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// =============================================================================
// Messages
// =============================================================================

export const MessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  toolCallId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// =============================================================================
// Council Members & Roles
// =============================================================================

export const CouncilRoleSchema = z.enum([
  'opinion-giver',    // First stage: provide initial opinion
  'reviewer',         // Second stage: review and critique
  'synthesizer',      // Third stage: synthesize final answer
  'backup',           // Self-correction: backup member
  'arbiter',          // Tie-breaker when voting is deadlocked
  // Extended roles for dynamic councils
  'devil-advocate',   // Challenges consensus, prevents groupthink
  'fact-checker',     // Verifies claims and flags misinformation
  'domain-expert',    // Specialized knowledge in specific areas
  'moderator',        // Guides discussion flow
  'skeptic',          // Questions assumptions
  'creative',         // Generates novel/unconventional ideas
  'critic'            // Provides constructive criticism
]);

export type CouncilRole = z.infer<typeof CouncilRoleSchema>;

export const CouncilMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  modelConfig: ModelConfigSchema,
  role: CouncilRoleSchema,
  systemPrompt: z.string().optional(),
  weight: z.number().min(0).max(1).default(1),  // For weighted voting
  priority: z.number().int().default(0),         // Order of invocation
  isActive: z.boolean().default(true),
  // New fields for dynamic councils
  persona: z.string().optional(),                // Custom persona description
  temperature: z.number().min(0).max(2).optional(), // Override per-member temperature
  metadata: z.record(z.unknown()).optional(),
});

export type CouncilMember = z.infer<typeof CouncilMemberSchema>;

// =============================================================================
// Voting
// =============================================================================

export const VotingMethodSchema = z.enum([
  'majority',        // Simple majority
  'super-majority',  // 2/3 or 3/4 majority
  'unanimous',       // All must agree
  'ranked-choice',   // Ranked preferences
  'weighted',        // Weighted by member weight
  'confidence',      // Based on confidence scores
  'consensus',       // Iterative consensus building
  'veto'             // Any member can veto
]);

export type VotingMethod = z.infer<typeof VotingMethodSchema>;

export const VoteSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  position: z.string(),                    // The stance/answer they voted for
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  rank: z.array(z.string()).optional(),    // For ranked-choice
  veto: z.boolean().optional(),
  timestamp: z.string().datetime(),
});

export type Vote = z.infer<typeof VoteSchema>;

export const VotingResultSchema = z.object({
  method: VotingMethodSchema,
  winner: z.string().nullable(),
  votes: z.array(VoteSchema),
  breakdown: z.record(z.number()),          // position -> count
  confidenceAvg: z.number(),
  consensusReached: z.boolean(),
  roundsNeeded: z.number().default(1),
  metadata: z.record(z.unknown()).optional(),
});

export type VotingResult = z.infer<typeof VotingResultSchema>;

// =============================================================================
// Council Pipeline
// =============================================================================

export const PipelineStageSchema = z.enum([
  'opinions',    // Stage 1: Gather opinions
  'review',      // Stage 2: Review and critique
  'voting',      // Stage 3: Vote on positions
  'synthesis',   // Stage 4: Synthesize final answer
  'correction'   // Stage 5: Self-correction if needed
]);

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const StageResultSchema = z.object({
  stage: PipelineStageSchema,
  responses: z.array(z.object({
    memberId: z.string(),
    memberName: z.string(),
    modelId: z.string(),
    content: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    tokenUsage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
    latencyMs: z.number(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.unknown()).optional(),
  })),
  votingResult: VotingResultSchema.optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMs: z.number(),
});

export type StageResult = z.infer<typeof StageResultSchema>;

// =============================================================================
// Session
// =============================================================================

export const SessionConfigSchema = z.object({
  councilSize: z.number().int().min(3).max(15).default(5),
  votingMethod: VotingMethodSchema.default('majority'),
  selfCorrectionEnabled: z.boolean().default(true),
  selfCorrectionThreshold: z.number().min(0).max(1).default(0.6), // Trigger if confidence < this
  maxCorrectionRounds: z.number().int().min(0).max(5).default(2),
  backupMembersCount: z.number().int().min(0).max(5).default(2),
  parallelExecution: z.boolean().default(true),
  timeoutMs: z.number().positive().default(60000),
  debugMode: z.boolean().default(false),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export const SessionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  question: z.string(),
  config: SessionConfigSchema,
  members: z.array(CouncilMemberSchema),
  stages: z.array(StageResultSchema),
  finalAnswer: z.string().nullable(),
  finalConfidence: z.number().min(0).max(1).nullable(),
  status: SessionStatusSchema,
  correctionRounds: z.number().int().default(0),
  totalTokens: z.number().default(0),
  totalCost: z.number().default(0),
  totalDurationMs: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Session = z.infer<typeof SessionSchema>;

// =============================================================================
// Tracing / Debug
// =============================================================================

export const TraceEventTypeSchema = z.enum([
  'session-start',
  'session-end',
  'stage-start',
  'stage-end',
  'member-request',
  'member-response',
  'vote-cast',
  'voting-complete',
  'correction-triggered',
  'backup-activated',
  'error'
]);

export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;

export const TraceEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: TraceEventTypeSchema,
  stage: PipelineStageSchema.optional(),
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
  durationMs: z.number().optional(),
  parentId: z.string().optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;

// =============================================================================
// Export/Import
// =============================================================================

export const ExportFormatSchema = z.enum([
  'json',
  'yaml', 
  'markdown',
  'html'
]);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportOptionsSchema = z.object({
  format: ExportFormatSchema.default('json'),
  includeTraces: z.boolean().default(true),
  includeRawResponses: z.boolean().default(false),
  includeTokenUsage: z.boolean().default(true),
  includeCosts: z.boolean().default(true),
  prettyPrint: z.boolean().default(true),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

// =============================================================================
// Dynamic Council - Meta Council Configuration
// =============================================================================

export const ComplexityLevelSchema = z.enum([
  'simple',      // Basic factual questions, quick answers
  'moderate',    // Requires some reasoning
  'complex',     // Multi-faceted, requires deep analysis
  'expert'       // Specialized domain knowledge required
]);

export type ComplexityLevel = z.infer<typeof ComplexityLevelSchema>;

export const DomainTypeSchema = z.enum([
  'general',     // General knowledge
  'technical',   // Programming, engineering, science
  'creative',    // Writing, art, design
  'ethical',     // Moral/ethical dilemmas
  'factual',     // Pure fact retrieval
  'analytical',  // Data analysis, logical reasoning
  'strategic'    // Planning, decision-making
]);

export type DomainType = z.infer<typeof DomainTypeSchema>;

export const PlanningModeSchema = z.enum([
  'static',      // Use keyword/rule-based selection
  'llm',         // Use LLM to decide council configuration
  'hybrid'       // Start with rules, escalate to LLM for complex
]);

export type PlanningMode = z.infer<typeof PlanningModeSchema>;

export const MetaCouncilConfigSchema = z.object({
  planningMode: PlanningModeSchema.optional().default('hybrid'),
  plannerModel: z.string().optional().default('gpt-5-mini'),  // Fast model for planning
  complexity: ComplexityLevelSchema.optional(),
  domain: DomainTypeSchema.optional(),
  reasoning: z.string().optional(),  // LLM's reasoning for config choice
  
  // Static rules configuration
  staticRules: z.object({
    // Keywords that trigger specific presets
    keywords: z.array(z.object({
      pattern: z.string(),  // Regex pattern as string
      preset: z.string(),
      allowIterations: z.boolean().default(false),
    })).optional(),
    
    // Length thresholds for complexity inference
    lengthThresholds: z.object({
      short: z.number().default(100),
      medium: z.number().default(500),
      long: z.number().default(1000),
    }).optional(),
    
    // Default fallback
    defaultPreset: z.string().default('standard'),
  }).optional(),
});

export type MetaCouncilConfig = z.infer<typeof MetaCouncilConfigSchema>;
// Input type for partial configuration
export type MetaCouncilConfigInput = z.input<typeof MetaCouncilConfigSchema>;

// =============================================================================
// Dynamic Council - Iteration Control
// =============================================================================

export const IterationStrategySchema = z.enum([
  'refine',      // Same council refines answer each iteration
  'escalate',    // Add more members each iteration
  'specialize',  // Route to specialist sub-councils
  'debate'       // Structured back-and-forth between positions
]);

export type IterationStrategy = z.infer<typeof IterationStrategySchema>;

export const IterationConfigSchema = z.object({
  // Enable/disable iteration
  enabled: z.boolean().optional().default(false),
  
  // Hard limits (snowball prevention)
  maxIterations: z.number().int().min(1).max(10).optional().default(3),
  maxTotalTokens: z.number().positive().optional().default(100000),
  maxDurationMs: z.number().positive().optional().default(120000),  // 2 minutes
  maxDepth: z.number().int().min(1).max(5).optional().default(2),   // For hierarchical
  
  // Termination conditions
  convergenceThreshold: z.number().min(0).max(1).optional().default(0.85),
  improvementThreshold: z.number().min(0).max(1).optional().default(0.05),
  
  // Strategy
  strategy: IterationStrategySchema.optional().default('refine'),
  
  // Per-iteration member adjustments
  escalationConfig: z.object({
    addMembersPerIteration: z.number().int().min(0).max(3).default(1),
    maxTotalMembers: z.number().int().min(3).max(15).default(9),
    preferReasoning: z.boolean().default(true),  // Prefer reasoning models
  }).optional(),
});

export type IterationConfig = z.infer<typeof IterationConfigSchema>;
export type IterationConfigInput = z.input<typeof IterationConfigSchema>;

export const IterationDecisionSchema = z.object({
  iteration: z.number().int(),
  action: z.enum(['continue', 'stop', 'escalate']),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  tokensUsed: z.number().int(),
  durationMs: z.number(),
});

export type IterationDecision = z.infer<typeof IterationDecisionSchema>;

export const IterationStateSchema = z.object({
  currentIteration: z.number().int().default(0),
  totalIterations: z.number().int().default(0),
  tokensSoFar: z.number().int().default(0),
  elapsedMs: z.number().default(0),
  startTime: z.string().datetime().optional(),
  confidenceHistory: z.array(z.number()).default([]),
  improvements: z.array(z.number()).default([]),
  decisions: z.array(IterationDecisionSchema).default([]),
});

export type IterationState = z.infer<typeof IterationStateSchema>;

// =============================================================================
// Dynamic Council - Memory & Context
// =============================================================================

export const MemoryConfigSchema = z.object({
  // Enable memory/context sharing
  enabled: z.boolean().optional().default(true),
  
  // Memory compression
  compressionEnabled: z.boolean().optional().default(true),
  maxContextTokens: z.number().positive().optional().default(8000),
  
  // What to persist
  persistConsensus: z.boolean().optional().default(true),
  persistDisagreements: z.boolean().optional().default(true),
  persistKeyInsights: z.boolean().optional().default(true),
  
  // Long-term memory (optional, for future sessions)
  longTermEnabled: z.boolean().optional().default(false),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type MemoryConfigInput = z.input<typeof MemoryConfigSchema>;

export const CouncilMemorySchema = z.object({
  // Short-term: Current iteration context
  shortTerm: z.object({
    question: z.string(),
    currentIteration: z.number().int(),
    previousResponses: z.array(z.object({
      iteration: z.number().int(),
      memberId: z.string(),
      content: z.string(),
      confidence: z.number().optional(),
    })).default([]),
    currentConfidence: z.number().default(0),
    keyInsights: z.array(z.string()).default([]),
  }),
  
  // Working: Cross-iteration context
  working: z.object({
    consensusPoints: z.array(z.string()).default([]),
    disagreements: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    refinements: z.array(z.object({
      iteration: z.number().int(),
      what: z.string(),
      why: z.string(),
    })).default([]),
  }),
  
  // Compressed summaries for context injection
  compressed: z.object({
    summary: z.string().default(''),
    tokenCount: z.number().int().default(0),
    lastUpdated: z.string().datetime().optional(),
  }).optional(),
});

export type CouncilMemory = z.infer<typeof CouncilMemorySchema>;

export const IterationContextSchema = z.object({
  iteration: z.number().int(),
  previousSummary: z.string(),
  keyDecisions: z.array(z.string()),
  openIssues: z.array(z.string()),
  confidenceTrend: z.array(z.number()),
  instructions: z.string(),
});

export type IterationContext = z.infer<typeof IterationContextSchema>;

// =============================================================================
// Dynamic Council - Complete Configuration
// =============================================================================

export const DynamicCouncilConfigSchema = z.object({
  // Meta configuration
  meta: MetaCouncilConfigSchema.optional(),
  
  // Council composition
  council: z.object({
    size: z.number().int().min(3).max(15).default(5),
    members: z.array(z.object({
      model: z.string(),
      role: CouncilRoleSchema,
      persona: z.string().optional(),
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      weight: z.number().min(0).max(2).default(1),
    })),
    voting: z.object({
      method: VotingMethodSchema.default('majority'),
      threshold: z.number().min(0).max(1).optional(),
    }).optional(),
  }),
  
  // Iteration settings
  iteration: IterationConfigSchema.optional(),
  
  // Memory settings
  memory: MemoryConfigSchema.optional(),
});

export type DynamicCouncilConfig = z.infer<typeof DynamicCouncilConfigSchema>;

// =============================================================================
// Dynamic Council - Planning Output (JSON Schema for LLM)
// =============================================================================

export const CouncilPlanSchema = z.object({
  // Analysis
  complexity: ComplexityLevelSchema,
  domain: DomainTypeSchema,
  reasoning: z.string(),
  
  // Recommended configuration
  councilSize: z.number().int().min(3).max(9),
  roles: z.array(z.object({
    role: CouncilRoleSchema,
    model: z.string(),
    persona: z.string().optional(),
    weight: z.number().optional(),
  })),
  votingMethod: VotingMethodSchema,
  
  // Iteration recommendation
  allowIterations: z.boolean(),
  maxIterations: z.number().int().min(1).max(5).optional(),
  iterationStrategy: IterationStrategySchema.optional(),
});

export type CouncilPlan = z.infer<typeof CouncilPlanSchema>;
