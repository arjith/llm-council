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
  'arbiter'           // Tie-breaker when voting is deadlocked
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
