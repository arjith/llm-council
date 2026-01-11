import type { Message, ModelConfig } from '../types.js';

/**
 * Response from a model completion
 */
export interface CompletionResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  raw?: unknown;
}

/**
 * Options for completion requests
 */
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  seed?: number;
  responseFormat?: 
    | 'text' 
    | 'json_object' 
    | { type: 'json_schema'; json_schema: { name: string; strict?: boolean; schema: object } };
  reasoningEffort?: 'low' | 'medium' | 'high'; // For o-series models
}

/**
 * Base interface for model adapters
 */
export interface ModelAdapter {
  /**
   * Unique identifier for this adapter instance
   */
  readonly id: string;

  /**
   * The model configuration
   */
  readonly config: ModelConfig;

  /**
   * Initialize the adapter (establish connections, validate config, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Send a completion request to the model
   */
  complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResponse>;

  /**
   * Stream a completion response (optional)
   */
  stream?(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterable<string>;

  /**
   * Check if the model is healthy/available
   */
  healthCheck(): Promise<boolean>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

/**
 * Factory function type for creating adapters
 */
export type ModelAdapterFactory = (config: ModelConfig) => ModelAdapter;

/**
 * Registry of adapter factories by provider
 */
export const adapterRegistry = new Map<string, ModelAdapterFactory>();

/**
 * Register an adapter factory for a provider
 */
export function registerAdapter(
  provider: string,
  factory: ModelAdapterFactory
): void {
  adapterRegistry.set(provider, factory);
}

/**
 * Create an adapter for a model config
 */
export function createAdapter(config: ModelConfig): ModelAdapter {
  const factory = adapterRegistry.get(config.provider);
  if (!factory) {
    throw new Error(`No adapter registered for provider: ${config.provider}`);
  }
  return factory(config);
}
