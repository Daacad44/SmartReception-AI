import { config } from '../../../config';
import type {
  AiChatRequest,
  AiChatResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProvider,
} from './types';

const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;
  readonly chatModel = CHAT_MODEL;
  readonly embeddingModel = EMBEDDING_MODEL;

  isConfigured(): boolean {
    return Boolean(config.ai.openaiApiKey);
  }

  private headers() {
    return {
      Authorization: `Bearer ${config.ai.openaiApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const started = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxOutputTokens ?? 800,
        ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI chat failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    return {
      text: data.choices?.[0]?.message?.content?.trim() ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: this.chatModel,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    const started = Date.now();
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.embeddingModel,
        input: request.texts.map((t) => t.slice(0, 8000)),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };

    return {
      embeddings: (data.data ?? []).map((row) => row.embedding ?? null),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: this.embeddingModel,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}

export const openAiProvider = new OpenAiProvider();
