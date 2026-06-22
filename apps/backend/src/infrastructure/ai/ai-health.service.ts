import { config } from '../../config';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';

export type AiHealthStatus = 'active' | 'misconfigured' | 'degraded' | 'inactive';

export interface AiHealthResult {
  status: AiHealthStatus;
  provider: string;
  model: string;
  apiKeyConfigured: boolean;
  autoReplyEnabled: boolean;
  detail?: string;
}

let cachedReachable: { ok: boolean; checkedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function isGeminiReachable(): Promise<boolean> {
  const now = Date.now();
  if (cachedReachable && now - cachedReachable.checkedAt < CACHE_TTL_MS) {
    return cachedReachable.ok;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.ai.model });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 5 },
    });
    await result.response;
    cachedReachable = { ok: true, checkedAt: now };
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('Gemini health check failed', { detail });
    cachedReachable = { ok: false, checkedAt: now };
    return false;
  }
}

export async function getAiHealth(businessId: string): Promise<AiHealthResult> {
  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { businessId },
    select: { enableAutoReply: true },
  });

  const apiKeyConfigured = Boolean(config.ai.geminiApiKey);
  const autoReplyEnabled = Boolean(aiConfig?.enableAutoReply);

  if (!apiKeyConfigured) {
    return {
      status: 'misconfigured',
      provider: config.ai.provider,
      model: config.ai.model,
      apiKeyConfigured: false,
      autoReplyEnabled,
      detail: 'GEMINI_API_KEY is not set in server environment',
    };
  }

  if (!autoReplyEnabled) {
    return {
      status: 'inactive',
      provider: config.ai.provider,
      model: config.ai.model,
      apiKeyConfigured: true,
      autoReplyEnabled: false,
      detail: 'Auto-reply is disabled in AI settings',
    };
  }

  const reachable = await isGeminiReachable();
  if (reachable) {
    return {
      status: 'active',
      provider: config.ai.provider,
      model: config.ai.model,
      apiKeyConfigured: true,
      autoReplyEnabled: true,
    };
  }

  return {
    status: 'degraded',
    provider: config.ai.provider,
    model: config.ai.model,
    apiKeyConfigured: true,
    autoReplyEnabled: true,
    detail: 'Gemini API is not reachable',
  };
}

export function isAiConfigured(): boolean {
  return Boolean(config.ai.geminiApiKey);
}
