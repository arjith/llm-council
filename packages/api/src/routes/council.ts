import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CouncilPipeline,
  getPreset,
  COUNCIL_PRESETS,
  createMember,
  AZURE_MODELS,
  type CouncilMember,
  type SessionConfig,
} from '@llm-council/core';
import { sessionRepository } from '../services/repository.js';

// Pipeline instance
const pipeline = new CouncilPipeline();

// Request schemas
const RunCouncilSchema = z.object({
  question: z.string().min(1).max(10000),
  preset: z.enum(['small', 'standard', 'reasoning', 'diverse']).optional(),
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

export const councilRoutes: FastifyPluginAsync = async (fastify) => {
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
   * Run a council session
   */
  fastify.post<{ Body: z.infer<typeof RunCouncilSchema> }>('/run', async (request, _reply) => {
    const body = RunCouncilSchema.parse(request.body);
    
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
};
