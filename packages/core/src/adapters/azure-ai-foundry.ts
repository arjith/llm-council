import { OpenAI } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { Message, ModelConfig } from '../types.js';
import type { 
  ModelAdapter, 
  CompletionResponse, 
  CompletionOptions 
} from './base.js';
import { registerAdapter } from './base.js';

/**
 * Azure AI Foundry (Serverless / MaaS) model adapter
 * Supports Claude, Llama, Mistral, Cohere, etc. via Azure AI Model Inference API
 * which is compatible with OpenAI Chat Completion API.
 */
export class AzureAIFoundryAdapter implements ModelAdapter {
  readonly id: string;
  readonly config: ModelConfig;
  private client: OpenAI | null = null;

  constructor(config: ModelConfig) {
    this.id = config.id;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const endpoint = this.config.endpoint ?? process.env.AZURE_AI_FOUNDRY_ENDPOINT; // e.g., https://<model>.eastus2.models.ai.azure.com/
    const apiKey = this.config.apiKey ?? process.env.AZURE_AI_FOUNDRY_API_KEY;

    if (!endpoint) {
      throw new Error(`Azure AI Foundry endpoint is required for model ${this.config.id}`);
    }
    if (!apiKey) {
      throw new Error(`Azure AI Foundry API key is required for model ${this.config.id}`);
    }

    // Azure AI Foundry MaaS uses OpenAI-compatible API
    // Endpoint usually needs /chat/completions appended if not present, 
    // but the OpenAI client handles baseURL.
    // However, usually MaaS endpoint is like `https://MainEndpoint.models.ai.azure.com/`
    // and we need to pass `baseURL`.
    
    this.client = new OpenAI({
      baseURL: endpoint, 
      apiKey: apiKey,
      // Azure MaaS does not always need organization/project, but needs dangerous allow browser if used in browser
      dangerouslyAllowBrowser: true, 
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

    // Mapping messages
    const chatMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));

    // Build params - Note that 'model' parameter is often ignored by MaaS endpoint 
    // as the endpoint *is* the model deployment, but OpenAI SDK requires it.
    // We pass the deployment name or just 'default'.
    const params: ChatCompletionCreateParamsNonStreaming = {
      model: this.config.deploymentName || 'default',
      messages: chatMessages,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      temperature: options?.temperature ?? this.config.temperature,
      top_p: options?.topP ?? this.config.topP,
      ...(options?.stop && { stop: options.stop }),
      ...(options?.seed !== undefined && { seed: options.seed }),
    };

    try {
      const response = await this.client.chat.completions.create(params);
      const endTime = performance.now();

      const choice = response.choices[0];
      
      const finishReason = choice?.finish_reason;
      let mappedFinishReason: CompletionResponse['finishReason'] = null;
      
      if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'content_filter' || finishReason === 'tool_calls') {
        mappedFinishReason = finishReason;
      }
      
      return {
        content: choice?.message?.content ?? '',
        finishReason: mappedFinishReason,
        tokenUsage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        latencyMs: endTime - startTime,
        raw: response,
      };
    } catch (error) {
      // const endTime = performance.now(); // Unused
      throw new Error(
        `Azure AI Foundry request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

    const stream = await this.client.chat.completions.create({
      model: this.config.deploymentName || 'default',
      messages: chatMessages,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      temperature: options?.temperature ?? this.config.temperature,
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
        model: this.config.deploymentName || 'default',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}

// Register the adapter
registerAdapter('azure-ai-foundry', (config) => new AzureAIFoundryAdapter(config));
