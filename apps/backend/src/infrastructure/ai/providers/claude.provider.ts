import { config } from '../../../config';
import type {
  AiChatRequest,
  AiChatResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProvider,
} from './types';

const CHAT_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';

export class ClaudeProvider implements AiProvider {
  readonly name = 'claude' as const;
  readonly chatModel = CHAT_MODEL;
  readonly embeddingModel = 'n/a';

  isConfigured(): boolean {
    return Boolean(config.ai.anthropicApiKey);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const started = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.ai.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.chatModel,
        max_tokens: request.maxOutputTokens ?? 800,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude chat failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text =
      data.content?.find((block) => block.type === 'text')?.text?.trim() ?? '';

    return {
      text,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      model: this.chatModel,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    // Claude has no native embeddings — delegate to configured embedding provider at call site
    void request;
    throw new Error('Claude provider does not support embeddings');
  }
}

export const claudeProvider = new ClaudeProvider();
