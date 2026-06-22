import { config } from '../../config';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';

export type AiHealthStatus = 'active' | 'misconfigured' | 'degraded' | 'inactive';

export interface AiHealthResult {
  status: AiHealthStatus;
  provider: 'openai';
  model: string;
  apiKeyConfigured: boolean;
  autoReplyEnabled: boolean;
  detail?: string;
}

export async function getAiHealth(businessId: string): Promise<AiHealthResult> {
  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { businessId },
    select: { enableAutoReply: true },
  });

  const apiKeyConfigured = Boolean(config.openai.apiKey);
  const autoReplyEnabled = Boolean(aiConfig?.enableAutoReply);

  if (!apiKeyConfigured) {
    return {
      status: 'misconfigured',
      provider: 'openai',
      model: config.openai.model,
      apiKeyConfigured: false,
      autoReplyEnabled,
      detail: 'OPENAI_API_KEY is not set in server environment',
    };
  }

  if (!autoReplyEnabled) {
    return {
      status: 'inactive',
      provider: 'openai',
      model: config.openai.model,
      apiKeyConfigured: true,
      autoReplyEnabled: false,
      detail: 'Auto-reply is disabled in AI settings',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${config.openai.apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return {
        status: 'active',
        provider: 'openai',
        model: config.openai.model,
        apiKeyConfigured: true,
        autoReplyEnabled: true,
      };
    }

    const body = await response.text();
    logger.warn('OpenAI health check failed', { status: response.status, body: body.slice(0, 200) });
    return {
      status: 'degraded',
      provider: 'openai',
      model: config.openai.model,
      apiKeyConfigured: true,
      autoReplyEnabled: true,
      detail: `OpenAI API returned ${response.status}`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('OpenAI health check error', { detail });
    return {
      status: 'degraded',
      provider: 'openai',
      model: config.openai.model,
      apiKeyConfigured: true,
      autoReplyEnabled: true,
      detail,
    };
  }
}
