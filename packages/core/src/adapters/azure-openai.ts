import { AzureOpenAI } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { Message, ModelConfig } from '../types.js';
import type { 
  ModelAdapter, 
  CompletionResponse, 
  CompletionOptions 
} from './base.js';
import { registerAdapter } from './base.js';

/**
 * Azure OpenAI model adapter
 * Supports GPT-4, GPT-4o, GPT-5 series and o-series reasoning models
 */
export class AzureOpenAIAdapter implements ModelAdapter {
  readonly id: string;
  readonly config: ModelConfig;
  private client: AzureOpenAI | null = null;

  constructor(config: ModelConfig) {
    this.id = config.id;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const endpoint = this.config.endpoint ?? process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = this.config.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = this.config.apiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-01-preview';

    if (!endpoint) {
      throw new Error('Azure OpenAI endpoint is required');
    }
    if (!apiKey) {
      throw new Error('Azure OpenAI API key is required');
    }

    this.client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
    });
  }

  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResponse> {
    if (!this.client) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    // Map messages to Azure OpenAI format
    const chatMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));

    // Build request params
    const maxTokensValue = options?.maxTokens ?? this.config.maxTokens;
    const isReasoning = this.isReasoningModel();
    
    // Azure OpenAI 2024-12-01-preview uses max_completion_tokens for all models
    // Some models don't support custom temperature
    const params: ChatCompletionCreateParamsNonStreaming = {
      model: this.config.deploymentName,
      messages: chatMessages,
      max_completion_tokens: maxTokensValue,
      // Only set temperature if explicitly non-default and model supports it
      ...((!isReasoning && options?.temperature !== undefined && options.temperature !== 1) && { 
        temperature: options.temperature 
      }),
      ...((!isReasoning && options?.topP !== undefined) && { top_p: options.topP }),
      ...(options?.stop && { stop: options.stop }),
      ...(options?.seed !== undefined && { seed: options.seed }),
      ...(options?.responseFormat === 'json_object' && { 
        response_format: { type: 'json_object' } 
      }),
    };

    // Add reasoning effort for o-series models
    if (this.isReasoningModel() && options?.reasoningEffort) {
      (params as any).reasoning_effort = options.reasoningEffort;
    }

    try {
      const response = await this.client.chat.completions.create(params);
      const endTime = performance.now();

      const choice = response.choices[0];
      
      return {
        content: choice?.message?.content ?? '',
        finishReason: this.mapFinishReason(choice?.finish_reason),
        tokenUsage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        latencyMs: endTime - startTime,
        raw: response,
      };
    } catch (error) {
      const endTime = performance.now();
      throw new AzureOpenAIError(
        `Azure OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
        endTime - startTime
      );
    }
  }

  async *stream(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterable<string> {
    if (!this.client) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }

    const chatMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    const maxTokensValue = options?.maxTokens ?? this.config.maxTokens;
    const isReasoning = this.isReasoningModel();

    const stream = await this.client.chat.completions.create({
      model: this.config.deploymentName,
      messages: chatMessages,
      max_completion_tokens: maxTokensValue,
      // Don't pass temperature - let model use default
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.chat.completions.create({
        model: this.config.deploymentName,
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.client = null;
  }

  /**
   * Check if this is an o-series reasoning model
   */
  private isReasoningModel(): boolean {
    const name = this.config.deploymentName.toLowerCase();
    return name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4');
  }

  private mapFinishReason(
    reason: string | null | undefined
  ): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      case 'tool_calls': return 'tool_calls';
      default: return null;
    }
  }
}

/**
 * Custom error for Azure OpenAI failures
 */
export class AzureOpenAIError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly latencyMs: number
  ) {
    super(message);
    this.name = 'AzureOpenAIError';
  }
}

// Register the adapter
registerAdapter('azure-openai', (config) => new AzureOpenAIAdapter(config));
