import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../../config';
import type {
  AiChatRequest,
  AiChatResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProvider,
} from './types';

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!client) client = new GoogleGenerativeAI(config.ai.geminiApiKey);
  return client;
}

function extractUsage(metadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined) {
  const inputTokens = metadata?.promptTokenCount ?? 0;
  const outputTokens = metadata?.candidatesTokenCount ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: metadata?.totalTokenCount ?? inputTokens + outputTokens,
  };
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  readonly chatModel = config.ai.model;
  readonly embeddingModel = config.ai.embeddingModel;

  isConfigured(): boolean {
    return Boolean(config.ai.geminiApiKey);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const started = Date.now();
    const model = getClient().getGenerativeModel({
      model: this.chatModel,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxOutputTokens ?? 800,
        ...(request.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });

    const prompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? '';
    const usage = extractUsage(result.response.usageMetadata);

    return {
      text,
      usage,
      model: this.chatModel,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    const started = Date.now();
    const model = getClient().getGenerativeModel({ model: this.embeddingModel });
    const embeddings = await Promise.all(
      request.texts.map(async (text) => {
        try {
          const result = await model.embedContent(text.slice(0, 8000));
          return result.embedding?.values ?? null;
        } catch {
          return null;
        }
      })
    );

    const charCount = request.texts.reduce((sum, t) => sum + t.length, 0);
    const estimatedTokens = Math.ceil(charCount / 4);

    return {
      embeddings,
      usage: { inputTokens: estimatedTokens, outputTokens: 0, totalTokens: estimatedTokens },
      model: this.embeddingModel,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}

export const geminiProvider = new GeminiProvider();
