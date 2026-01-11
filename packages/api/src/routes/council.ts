import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CouncilPipeline,
  DynamicCouncilPipeline,
  createDynamicCouncilPipeline,
  getPreset,
  COUNCIL_PRESETS,
  createMember,
  AZURE_MODELS,
  type CouncilMember,
  type SessionConfig,
  type DynamicCouncilConfigOutput,
  type MetaCouncilConfigInput,
  type IterationConfig,
  type MemoryConfig,
} from '@llm-council/core';
import { sessionRepository } from '../services/repository.js';

// Pipeline instances
const pipeline = new CouncilPipeline();
const dynamicPipeline = createDynamicCouncilPipeline();

// Request schemas
const RunCouncilSchema = z.object({
  question: z.string().min(1).max(10000),
  preset: z.enum(['small', 'standard', 'reasoning', 'diverse']).optional(),
  /** Enable dynamic role assignment via meta-council (default: true) */
  useDynamic: z.boolean().optional().default(true),
  /** Planning mode when using dynamic (default: hybrid) */
  planningMode: z.enum(['static', 'llm', 'hybrid']).optional(),
  members: z.array(z.object({
    modelKey: z.enum(['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4.1', 'o3', 'o3-mini', 'o4-mini']),
    role: z.enum(['opinion-giver', 'reviewer', 'synthesizer', 'backup', 'arbiter']).optional(),
    name: z.string().optional(),
    weight: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().optional(),
  })).optional(),
  config: z.object({
    councilSize: z.number().int().min(3).max(15).optional(),
    votingMethod: z.enum(['majority', 'super-majority', 'unanimous', 'ranked-choice', 'weighted', 'confidence', 'consensus', 'veto']).optional(),
    selfCorrectionEnabled: z.boolean().optional(),
    selfCorrectionThreshold: z.number().min(0).max(1).optional(),
    maxCorrectionRounds: z.number().int().min(0).max(5).optional(),
    backupMembersCount: z.number().int().min(0).max(5).optional(),
    parallelExecution: z.boolean().optional(),
    timeoutMs: z.number().positive().optional(),
    debugMode: z.boolean().optional(),
  }).optional(),
});

// Dynamic council schemas
const AnalyzeQuestionSchema = z.object({
  question: z.string().min(1).max(10000),
  planningMode: z.enum(['static', 'llm', 'hybrid']).optional(),
});

const DynamicCouncilMemberSchema = z.object({
  model: z.string(),
  role: z.enum([
    'opinion-giver', 'reviewer', 'synthesizer', 'backup', 'arbiter',
    'devil-advocate', 'fact-checker', 'domain-expert', 'moderator',
    'skeptic', 'creative', 'critic'
  ]),
  persona: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  weight: z.number().min(0).max(2).optional(),
});

const RunDynamicCouncilSchema = z.object({
  question: z.string().min(1).max(10000),
  
  // Option 1: Let meta-council decide
  metaConfig: z.object({
    planningMode: z.enum(['static', 'llm', 'hybrid']).optional(),
    plannerModel: z.string().optional(),
  }).optional(),
  
  // Option 2: Provide explicit config
  config: z.object({
    council: z.object({
      size: z.number().int().min(3).max(15),
      members: z.array(DynamicCouncilMemberSchema),
      voting: z.object({
        method: z.enum(['majority', 'super-majority', 'unanimous', 'ranked-choice', 'weighted', 'confidence', 'consensus', 'veto']).optional(),
        threshold: z.number().min(0).max(1).optional(),
      }).optional(),
    }),
    iteration: z.object({
      enabled: z.boolean().optional(),
      maxIterations: z.number().int().min(1).max(10).optional(),
      maxTotalTokens: z.number().positive().optional(),
      maxDurationMs: z.number().positive().optional(),
      convergenceThreshold: z.number().min(0).max(1).optional(),
      improvementThreshold: z.number().min(0).max(1).optional(),
      strategy: z.enum(['refine', 'escalate', 'specialize', 'debate']).optional(),
    }).optional(),
    memory: z.object({
      enabled: z.boolean().optional(),
      compressionEnabled: z.boolean().optional(),
      maxContextTokens: z.number().positive().optional(),
    }).optional(),
  }).optional(),
  
  // Skip planning if config provided
  skipPlanning: z.boolean().optional(),
  
  // Session config overrides
  sessionConfig: z.object({
    selfCorrectionEnabled: z.boolean().optional(),
    selfCorrectionThreshold: z.number().min(0).max(1).optional(),
    maxCorrectionRounds: z.number().int().min(0).max(5).optional(),
    parallelExecution: z.boolean().optional(),
    debugMode: z.boolean().optional(),
  }).optional(),
});

export const councilRoutes: FastifyPluginAsync = async (fastify) => {
  // ==========================================================================
  // STANDARD COUNCIL ROUTES
  // ==========================================================================

  /**
   * List available presets
   */
  fastify.get('/presets', async () => {
    return Object.entries(COUNCIL_PRESETS).map(([key, preset]) => ({
      key,
      name: preset.name,
      description: preset.description,
      memberCount: preset.members.length,
      config: preset.config,
    }));
  });

  /**
   * Get a specific preset by key
   */
  fastify.get<{ Params: { presetKey: string } }>('/presets/:presetKey', async (request, reply) => {
    const presetKey = request.params.presetKey as keyof typeof COUNCIL_PRESETS;
    
    if (!COUNCIL_PRESETS[presetKey]) {
      reply.code(404);
      return { error: `Preset '${presetKey}' not found` };
    }
    
    const preset = COUNCIL_PRESETS[presetKey];
    return {
      key: presetKey,
      name: preset.name,
      description: preset.description,
      memberCount: preset.members.length,
      config: preset.config,
      members: preset.members.map(m => ({
        name: m.name,
        role: m.role,
        modelId: m.modelConfig.name,
      })),
    };
  });

  /**
   * List available models
   */
  fastify.get('/models', async () => {
    return Object.entries(AZURE_MODELS).map(([key, model]) => ({
      key,
      name: model.name,
      provider: model.provider,
      capabilities: model.capabilities,
      maxTokens: model.maxTokens,
    }));
  });

  /**
   * Run a council session (standard mode)
   * Now uses dynamic role assignment by default (can be disabled with useDynamic: false)
   */
  fastify.post<{ Body: z.infer<typeof RunCouncilSchema> }>('/run', async (request, _reply) => {
    const body = RunCouncilSchema.parse(request.body);
    
    // Check if dynamic planning should be used (default: true unless preset/members provided)
    const useDynamic = body.useDynamic ?? (!body.preset && !body.members);
    
    if (useDynamic && !body.preset && !body.members) {
      // Use dynamic council with meta-council planning
      const options = {
        metaConfig: {
          planningMode: body.planningMode ?? 'hybrid',
        } as MetaCouncilConfigInput,
        sessionConfig: body.config,
      };

      const session = await dynamicPipeline.run(body.question, options);
      await sessionRepository.create(session);

      return {
        sessionId: session.id,
        status: session.status,
        finalAnswer: session.finalAnswer,
        finalConfidence: session.finalConfidence,
        totalTokens: session.totalTokens,
        totalDurationMs: session.totalDurationMs,
        correctionRounds: session.correctionRounds,
        stageCount: session.stages.length,
        // Include dynamic config info
        dynamicConfig: session.dynamicConfig ? {
          complexity: session.dynamicConfig.meta?.complexity,
          domain: session.dynamicConfig.meta?.domain,
          planningMode: session.dynamicConfig.meta?.planningMode,
          reasoning: session.dynamicConfig.meta?.reasoning,
          councilSize: session.dynamicConfig.council.size,
        } : undefined,
      };
    }
    
    // Standard mode: use preset or custom members
    let members: CouncilMember[];
    let config: Partial<SessionConfig>;

    if (body.preset) {
      // Use preset configuration
      const preset = getPreset(body.preset);
      members = [...preset.members];
      config = { ...preset.config };
    } else if (body.members && body.members.length > 0) {
      // Custom members
      members = body.members.map((m, i) => 
        createMember(m.modelKey as keyof typeof AZURE_MODELS, {
          role: m.role ?? 'opinion-giver',
          name: m.name ?? `Member ${i + 1}`,
          weight: m.weight,
          systemPrompt: m.systemPrompt,
        })
      );
      config = body.config ?? {};
    } else {
      // Default to standard preset
      const preset = getPreset('standard');
      members = [...preset.members];
      config = { ...preset.config };
    }

    // Merge custom config
    if (body.config) {
      config = { ...config, ...body.config };
    }

    // Run the council
    const session = await pipeline.run(body.question, members, config);
    
    // Store session
    await sessionRepository.create(session);

    return {
      sessionId: session.id,
      status: session.status,
      finalAnswer: session.finalAnswer,
      finalConfidence: session.finalConfidence,
      totalTokens: session.totalTokens,
      totalDurationMs: session.totalDurationMs,
      correctionRounds: session.correctionRounds,
      stageCount: session.stages.length,
    };
  });

  /**
   * Get session details with full debug info
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const session = await sessionRepository.get(request.params.id);
    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }
    return session;
  });

  /**
   * Get session traces for debugging
   */
  fastify.get<{ Params: { id: string } }>('/:id/traces', async (request, _reply) => {
    const sessionId = request.params.id;
    const traces = pipeline.getTraces(sessionId);
    return { sessionId, traces };
  });

  // ==========================================================================
  // DYNAMIC COUNCIL ROUTES
  // ==========================================================================

  /**
   * Analyze a question to get recommended council configuration
   * This is useful for previewing what config the meta-council would choose
   */
  fastify.post<{ Body: z.infer<typeof AnalyzeQuestionSchema> }>('/analyze', async (request, _reply) => {
    const body = AnalyzeQuestionSchema.parse(request.body);
    
    const config = await dynamicPipeline.analyze(body.question, {
      planningMode: body.planningMode ?? 'hybrid',
    });

    return {
      question: body.question,
      analysis: {
        complexity: config.meta?.complexity,
        domain: config.meta?.domain,
        reasoning: config.meta?.reasoning,
        planningMode: config.meta?.planningMode,
      },
      recommendedConfig: {
        councilSize: config.council.size,
        members: config.council.members.map((m: { model: string; role: string; persona?: string; weight?: number }) => ({
          model: m.model,
          role: m.role,
          persona: m.persona,
          weight: m.weight,
        })),
        votingMethod: config.council.voting?.method,
        iteration: config.iteration,
        memory: config.memory,
      },
    };
  });

  /**
   * Run a dynamic council session
   * Supports auto-planning, iterations, and memory
   */
  fastify.post<{ Body: z.infer<typeof RunDynamicCouncilSchema> }>('/run-dynamic', async (request, _reply) => {
    const body = RunDynamicCouncilSchema.parse(request.body);
    
    // Build options
    const options = {
      metaConfig: body.metaConfig as MetaCouncilConfigInput | undefined,
      config: body.config as DynamicCouncilConfigOutput | undefined,
      skipPlanning: body.skipPlanning,
      sessionConfig: body.sessionConfig,
    };

    // Run dynamic council
    const session = await dynamicPipeline.run(body.question, options);
    
    // Store session
    await sessionRepository.create(session);

    return {
      sessionId: session.id,
      status: session.status,
      finalAnswer: session.finalAnswer,
      finalConfidence: session.finalConfidence,
      totalTokens: session.totalTokens,
      totalDurationMs: session.totalDurationMs,
      correctionRounds: session.correctionRounds,
      stageCount: session.stages.length,
      // Dynamic council specific info
      dynamicConfig: session.dynamicConfig ? {
        complexity: session.dynamicConfig.meta?.complexity,
        domain: session.dynamicConfig.meta?.domain,
        planningMode: session.dynamicConfig.meta?.planningMode,
        councilSize: session.dynamicConfig.council.size,
        iterationEnabled: session.dynamicConfig.iteration?.enabled,
        maxIterations: session.dynamicConfig.iteration?.maxIterations,
      } : undefined,
      iterations: session.iterations,
    };
  });

  /**
   * List available roles with descriptions
   */
  fastify.get('/roles', async () => {
    return [
      {
        role: 'opinion-giver',
        description: 'Provides initial opinions and perspectives',
        stage: 'opinions',
      },
      {
        role: 'reviewer',
        description: 'Reviews and critiques other opinions',
        stage: 'review',
      },
      {
        role: 'synthesizer',
        description: 'Combines all perspectives into final answer',
        stage: 'synthesis',
      },
      {
        role: 'devil-advocate',
        description: 'Challenges consensus to prevent groupthink',
        stage: 'opinions',
      },
      {
        role: 'fact-checker',
        description: 'Verifies claims and flags misinformation',
        stage: 'review',
      },
      {
        role: 'domain-expert',
        description: 'Provides specialized domain knowledge',
        stage: 'opinions',
      },
      {
        role: 'skeptic',
        description: 'Questions assumptions and demands evidence',
        stage: 'opinions',
      },
      {
        role: 'creative',
        description: 'Generates novel and unconventional ideas',
        stage: 'opinions',
      },
      {
        role: 'critic',
        description: 'Provides constructive criticism',
        stage: 'review',
      },
      {
        role: 'moderator',
        description: 'Guides discussion flow (not voting)',
        stage: 'all',
      },
      {
        role: 'backup',
        description: 'Activated when confidence is low',
        stage: 'correction',
      },
      {
        role: 'arbiter',
        description: 'Breaks ties in deadlocked voting',
        stage: 'voting',
      },
    ];
  });

  /**
   * List available voting methods with descriptions
   */
  fastify.get('/voting-methods', async () => {
    return [
      {
        method: 'majority',
        description: 'Simple majority (>50%)',
        threshold: 0.5,
      },
      {
        method: 'super-majority',
        description: 'Two-thirds majority (≥67%)',
        threshold: 0.67,
      },
      {
        method: 'unanimous',
        description: 'All members must agree',
        threshold: 1.0,
      },
      {
        method: 'weighted',
        description: 'Votes weighted by member expertise',
        threshold: 0.5,
      },
      {
        method: 'confidence',
        description: 'Weighted by confidence scores',
        threshold: 0.5,
      },
      {
        method: 'ranked-choice',
        description: 'Instant-runoff with ranked preferences',
        threshold: 0.5,
      },
      {
        method: 'consensus',
        description: 'Iterative consensus building',
        threshold: 0.8,
      },
      {
        method: 'veto',
        description: 'Any member can veto',
        threshold: 1.0,
      },
    ];
  });

  /**
   * List available iteration strategies
   */
  fastify.get('/iteration-strategies', async () => {
    return [
      {
        strategy: 'refine',
        description: 'Same council refines answer each iteration',
        bestFor: 'Improving quality incrementally',
      },
      {
        strategy: 'escalate',
        description: 'Add more members each iteration',
        bestFor: 'Complex problems needing diverse perspectives',
      },
      {
        strategy: 'specialize',
        description: 'Route to specialist sub-councils',
        bestFor: 'Multi-domain problems',
      },
      {
        strategy: 'debate',
        description: 'Structured back-and-forth between positions',
        bestFor: 'Controversial topics with clear opposing views',
      },
    ];
  });
};

