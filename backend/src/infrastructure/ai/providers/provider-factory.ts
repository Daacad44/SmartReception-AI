import { config } from '../../../config';
import { claudeProvider } from './claude.provider';
import { geminiProvider } from './gemini.provider';
import { openAiProvider } from './openai.provider';
import type { AiProvider, AiProviderName } from './types';

const providers: Record<AiProviderName, AiProvider> = {
  gemini: geminiProvider,
  openai: openAiProvider,
  claude: claudeProvider,
};

export function resolveAiProvider(preferred?: AiProviderName): AiProvider {
  const order: AiProviderName[] = preferred
    ? [preferred, 'gemini', 'openai', 'claude']
    : [(config.ai.provider as AiProviderName) || 'gemini', 'gemini', 'openai', 'claude'];

  const seen = new Set<AiProviderName>();
  for (const name of order) {
    if (seen.has(name)) continue;
    seen.add(name);
    const provider = providers[name];
    if (provider?.isConfigured()) return provider;
  }

  throw new Error('No AI provider is configured');
}

export function resolveEmbeddingProvider(): AiProvider {
  if (openAiProvider.isConfigured()) return openAiProvider;
  if (geminiProvider.isConfigured()) return geminiProvider;
  throw new Error('No embedding provider is configured');
}

export { providers };
