import type { CouncilMember, ModelConfig, SessionConfig } from './types.js';

/**
 * Preset model configurations for Azure OpenAI deployments
 * Updated January 2026 - Using latest deployed models
 */
export const AZURE_MODELS = {
  // Primary GPT-5 models (2025-08-07)
  'gpt-5': {
    id: 'azure-gpt-5',
    name: 'GPT-5',
    provider: 'azure-openai',
    deploymentName: 'gpt-5',
    capabilities: ['chat', 'reasoning', 'code', 'function-calling', 'agents'],
    maxTokens: 100000,
    temperature: 1, // GPT-5 works best with temperature=1 on latest API
  },
  'gpt-5-mini': {
    id: 'azure-gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'azure-openai',
    deploymentName: 'gpt-5-mini',
    capabilities: ['chat', 'code', 'agents'],
    maxTokens: 100000,
    temperature: 1,
  },
  // GPT-4.1 - Long context specialist (1M tokens input)
  'gpt-4.1': {
    id: 'azure-gpt-4.1',
    name: 'GPT-4.1',
    provider: 'azure-openai',
    deploymentName: 'gpt-4.1',
    capabilities: ['chat', 'code', 'function-calling', 'long-context'],
    maxTokens: 32768,
    temperature: 1,
  },
  // o-series Reasoning Models (no temperature control)
  'o4-mini': {
    id: 'azure-o4-mini',
    name: 'o4-mini (Reasoning)',
    provider: 'azure-openai',
    deploymentName: 'o4-mini',
    capabilities: ['chat', 'reasoning', 'agents'],
    maxTokens: 100000,
    temperature: 1, // o-series ignores temperature
  },
  'o3-mini': {
    id: 'azure-o3-mini',
    name: 'o3-mini (Reasoning)',
    provider: 'azure-openai',
    deploymentName: 'o3-mini',
    capabilities: ['chat', 'reasoning'],
    maxTokens: 65536,
    temperature: 1,
  },
  'o3': {
    id: 'azure-o3',
    name: 'o3 (Deep Reasoning)',
    provider: 'azure-openai',
    deploymentName: 'o3',
    capabilities: ['chat', 'reasoning'],
    maxTokens: 100000,
    temperature: 1,
  },
} satisfies Record<string, ModelConfig>;

/**
 * Create a council member from a model preset
 */
export function createMember(
  modelKey: keyof typeof AZURE_MODELS,
  overrides?: Partial<CouncilMember>
): CouncilMember {
  const modelConfig = AZURE_MODELS[modelKey];
  return {
    id: `member-${modelKey}-${Date.now()}`,
    name: modelConfig.name,
    modelConfig,
    role: 'opinion-giver',
    weight: 1,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

/**
 * Preset council configurations - Updated for 2026 models
 */
export const COUNCIL_PRESETS = {
  /**
   * Small council: 3 modern models for quick decisions
   */
  small: {
    name: 'Small Council',
    description: '3 GPT-5 series models for quick consensus',
    members: [
      createMember('gpt-5', { role: 'opinion-giver', name: 'GPT-5 Analyst' }),
      createMember('gpt-5-mini', { role: 'reviewer', name: 'GPT-5 Mini Critic' }),
      createMember('gpt-4.1', { role: 'synthesizer', name: 'GPT-4.1 Synthesizer' }),
    ],
    config: {
      councilSize: 3,
      votingMethod: 'majority',
      selfCorrectionEnabled: false,
    } satisfies Partial<SessionConfig>,
  },

  /**
   * Standard council: 5 members with GPT-5 + reasoning
   */
  standard: {
    name: 'Standard Council',
    description: '5 members: GPT-5 series + o4-mini reasoning',
    members: [
      createMember('gpt-5', { role: 'opinion-giver', name: 'GPT-5 Primary', priority: 1 }),
      createMember('gpt-5-mini', { role: 'opinion-giver', name: 'GPT-5 Mini Fast', priority: 2 }),
      createMember('gpt-4.1', { role: 'opinion-giver', name: 'GPT-4.1 Long Context', priority: 3 }),
      createMember('o4-mini', { role: 'reviewer', name: 'o4-mini Reasoner', priority: 4 }),
      createMember('gpt-5', { role: 'synthesizer', name: 'GPT-5 Synthesizer', priority: 5 }),
    ],
    config: {
      councilSize: 5,
      votingMethod: 'confidence',
      selfCorrectionEnabled: true,
      selfCorrectionThreshold: 0.65,
      maxCorrectionRounds: 1,
      backupMembersCount: 0,
    } satisfies Partial<SessionConfig>,
  },

  /**
   * Reasoning council: o-series + GPT-5 for complex problems
   */
  reasoning: {
    name: 'Reasoning Council',
    description: 'o4-mini + o3-mini for complex logical problems',
    members: [
      createMember('o4-mini', { role: 'opinion-giver', name: 'o4-mini Thinker', weight: 1.3 }),
      createMember('o3-mini', { role: 'opinion-giver', name: 'o3-mini Reasoner' }),
      createMember('gpt-5', { role: 'opinion-giver', name: 'GPT-5 Generalist' }),
      createMember('gpt-4.1', { role: 'reviewer', name: 'GPT-4.1 Reviewer' }),
      createMember('gpt-5', { role: 'synthesizer', name: 'GPT-5 Synthesizer' }),
    ],
    config: {
      councilSize: 5,
      votingMethod: 'weighted',
      selfCorrectionEnabled: true,
      selfCorrectionThreshold: 0.7,
      maxCorrectionRounds: 2,
      backupMembersCount: 0,
    } satisfies Partial<SessionConfig>,
  },

  /**
   * Diverse council: All available models for maximum diversity
   */
  diverse: {
    name: 'Diverse Council',
    description: 'All deployed models for maximum perspective',
    members: [
      createMember('gpt-5', { role: 'opinion-giver', name: 'GPT-5' }),
      createMember('gpt-5-mini', { role: 'opinion-giver', name: 'GPT-5 Mini' }),
      createMember('gpt-4.1', { role: 'opinion-giver', name: 'GPT-4.1' }),
      createMember('o4-mini', { role: 'reviewer', name: 'o4-mini Reviewer', weight: 1.2 }),
      createMember('o3-mini', { role: 'reviewer', name: 'o3-mini Reviewer' }),
      createMember('gpt-5', { role: 'synthesizer', name: 'GPT-5 Synthesizer' }),
    ],
    config: {
      councilSize: 6,
      votingMethod: 'ranked-choice',
      selfCorrectionEnabled: true,
      selfCorrectionThreshold: 0.6,
      maxCorrectionRounds: 2,
      backupMembersCount: 0,
    } satisfies Partial<SessionConfig>,
  },
} as const;

/**
 * Get a preset council configuration
 */
export function getPreset(name: keyof typeof COUNCIL_PRESETS) {
  return COUNCIL_PRESETS[name];
}
