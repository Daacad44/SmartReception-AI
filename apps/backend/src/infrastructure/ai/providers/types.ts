export type AiProviderName = 'gemini' | 'openai' | 'claude';

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiChatRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export interface AiChatResponse {
  text: string;
  usage: AiTokenUsage;
  model: string;
  provider: AiProviderName;
  latencyMs: number;
}

export interface AiEmbeddingRequest {
  texts: string[];
}

export interface AiEmbeddingResponse {
  embeddings: (number[] | null)[];
  usage: AiTokenUsage;
  model: string;
  provider: AiProviderName;
  latencyMs: number;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly chatModel: string;
  readonly embeddingModel: string;
  isConfigured(): boolean;
  chat(request: AiChatRequest): Promise<AiChatResponse>;
  embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse>;
}

export interface AiProviderCostRates {
  inputPer1M: number;
  outputPer1M: number;
}

export const PROVIDER_COST_RATES: Record<AiProviderName, AiProviderCostRates> = {
  gemini: { inputPer1M: 0.075, outputPer1M: 0.3 },
  openai: { inputPer1M: 0.15, outputPer1M: 0.6 },
  claude: { inputPer1M: 0.25, outputPer1M: 1.25 },
};

export function estimateCostUsd(
  provider: AiProviderName,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = PROVIDER_COST_RATES[provider];
  return (inputTokens / 1_000_000) * rates.inputPer1M + (outputTokens / 1_000_000) * rates.outputPer1M;
}
