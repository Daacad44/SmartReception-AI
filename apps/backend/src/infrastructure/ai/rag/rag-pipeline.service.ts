import { config } from '../../../config';
import { logger } from '../../../core/logger';
import { prisma } from '../../database/prisma';
import {
  classifyAiResourceRoute,
  type AiResourceRoute,
} from '../ai-intent-router.service';
import { loadBusinessAIPrompt } from '../business-ai-context.service';
import { getBusinessProfileContext } from '../business-profile-prompt.service';
import { getCachedBusinessProfile } from '../business-tenant-cache.service';
import { isSmartReceptionBusiness } from '../smartreception-tenant';
import { CONTACT_FOOTER_SO } from '../somali-menu';
import { parseGeminiAiResponse } from '../gemini-json-parse';
import { withAiTimeout } from '../gemini-timeout';
import { GEMINI_ERROR_MESSAGE_SO } from '../smartreception-knowledge';
import type { AIResponse } from '../ai.types';
import { resolveAiProvider } from '../providers/provider-factory';
import { estimateCostUsd } from '../providers/types';
import {
  buildConversationMemory,
  formatMemoryForPrompt,
} from '../memory/conversation-memory.service';
import {
  buildOptimizedKnowledgePrompt,
  buildOptimizedProfilePrompt,
  estimateTokensFromChars,
} from './prompt-builder.service';
import { retrieveRelevantChunks } from './retrieval.service';
import { aiUsageTracker } from '../../../modules/ai-analytics/usage-tracker.service';

export interface RagPipelineOptions {
  preferEnglish?: boolean;
  isFirstCustomerMessage?: boolean;
  forceRoute?: AiResourceRoute;
  customerId?: string;
  messageId?: string;
}

export async function executeRagPipeline(
  businessId: string,
  conversationId: string,
  customerMessage: string,
  options: RagPipelineOptions = {}
): Promise<AIResponse & { _meta?: Record<string, unknown> }> {
  const started = Date.now();
  const preferEnglish = options.preferEnglish === true;
  const language = preferEnglish ? 'en' : 'so';

  let isFirstCustomerMessage = options.isFirstCustomerMessage;
  if (isFirstCustomerMessage === undefined) {
    const inboundCount = await prisma.message.count({
      where: { conversationId, direction: 'INBOUND' },
    });
    isFirstCustomerMessage = inboundCount <= 1;
  }

  const route =
    options.forceRoute ??
    classifyAiResourceRoute(customerMessage, { isFirstCustomerMessage });

  const [profile, businessContext, memory, retrieval] = await Promise.all([
    getCachedBusinessProfile(businessId),
    loadBusinessAIPrompt(businessId),
    buildConversationMemory(businessId, conversationId),
    route === 'knowledge_base'
      ? retrieveRelevantChunks(businessId, customerMessage)
      : Promise.resolve({
          chunks: [],
          categories: [],
          searchSuccess: false,
          usedFallback: false,
          baselineCharEstimate: 0,
        }),
  ]);

  const business = profile.business;
  const aiConfig = businessContext.aiConfiguration;
  const memoryContext = formatMemoryForPrompt(memory);

  const fallback: AIResponse = {
    content: businessContext.fallbackMessage || aiConfig?.fallbackMessage || GEMINI_ERROR_MESSAGE_SO,
    intent: 'general',
    actions: [{ type: 'none' }],
    confidence: 0,
    language,
  };

  let systemPrompt: string;
  let userPrompt: string;
  let knowledgeChars = 0;

  if (route === 'business_profile') {
    const profileContext = await getBusinessProfileContext(businessId);
    const built = buildOptimizedProfilePrompt({
      businessName: businessContext.businessName,
      systemPrompt: businessContext.systemPrompt,
      knowledgeChunks: [],
      memoryContext,
      customerMessage,
      preferEnglish,
      route,
      profileContext,
    });
    systemPrompt = built.systemPrompt;
    userPrompt = built.userPrompt;
    knowledgeChars = built.knowledgeChars;
  } else {
    const built = buildOptimizedKnowledgePrompt({
      businessName: businessContext.businessName,
      systemPrompt: businessContext.systemPrompt,
      knowledgeChunks: retrieval.chunks,
      memoryContext,
      customerMessage,
      preferEnglish,
      route,
    });
    systemPrompt = built.systemPrompt;
    userPrompt = built.userPrompt;
    knowledgeChars = built.knowledgeChars;
  }

  const baselineTokensEstimate = estimateTokensFromChars(retrieval.baselineCharEstimate || knowledgeChars * 20);
  const promptChars = systemPrompt.length + userPrompt.length;

  try {
    const provider = resolveAiProvider();
    const chatPromise = provider.chat({
      systemPrompt,
      userPrompt,
      temperature: aiConfig?.temperature ?? 0.7,
      maxOutputTokens: aiConfig?.maxTokens ?? 800,
      jsonMode: true,
    });

    const response = await withAiTimeout(chatPromise, null, 'AI chat');
    if (!response) {
      await aiUsageTracker.record({
        businessId,
        conversationId,
        customerId: options.customerId,
        messageId: options.messageId,
        provider: provider.name,
        model: provider.chatModel,
        operation: 'chat',
        inputTokens: estimateTokensFromChars(promptChars),
        outputTokens: 0,
        latencyMs: Date.now() - started,
        promptChars,
        responseChars: 0,
        retrievedChunkCount: retrieval.chunks.length,
        retrievedCategories: retrieval.categories,
        intent: route,
        route,
        usedRag: route === 'knowledge_base',
        usedSummary: memory.usedSummary,
        summaryChars: memory.summaryChars,
        knowledgeChars,
        baselineTokensEstimate,
        fallbackUsed: true,
        success: false,
        errorMessage: 'timeout',
      });
      return fallback;
    }

    const parsed = parseGeminiAiResponse(response.text, language);
    if (!parsed?.content?.trim()) {
      return fallback;
    }

    let content = parsed.content;
    if (
      route === 'knowledge_base' &&
      isSmartReceptionBusiness(business) &&
      !preferEnglish &&
      !content.includes('+25268776299') &&
      ['services', 'pricing', 'general', 'support', 'lead'].includes(parsed.intent || 'general')
    ) {
      content = `${content}\n\n${CONTACT_FOOTER_SO}`;
    }

    const savingsTokens = Math.max(0, baselineTokensEstimate - response.usage.totalTokens);
    const tokenSavingsPercent =
      baselineTokensEstimate > 0 ? (savingsTokens / baselineTokensEstimate) * 100 : 0;

    await aiUsageTracker.record({
      businessId,
      conversationId,
      customerId: options.customerId,
      messageId: options.messageId,
      provider: response.provider,
      model: response.model,
      operation: 'chat',
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: response.latencyMs,
      promptChars,
      responseChars: content.length,
      retrievedChunkCount: retrieval.chunks.length,
      retrievedCategories: retrieval.categories,
      intent: parsed.intent || route,
      route,
      usedRag: route === 'knowledge_base',
      usedSummary: memory.usedSummary,
      summaryChars: memory.summaryChars,
      knowledgeChars,
      baselineTokensEstimate,
      tokenSavingsPercent,
      fallbackUsed: retrieval.usedFallback,
      success: true,
      metadata: {
        chunkIds: retrieval.chunks.map((c) => c.id),
        searchSuccess: retrieval.searchSuccess,
      },
    });

    return {
      content,
      intent: parsed.intent || 'general',
      actions: parsed.actions || [{ type: 'none' }],
      confidence: parsed.confidence ?? 0.7,
      language: parsed.language || language,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('RAG pipeline failed', { detail, businessId, conversationId });

    await aiUsageTracker.record({
      businessId,
      conversationId,
      customerId: options.customerId,
      messageId: options.messageId,
      provider: config.ai.provider,
      model: config.ai.model,
      operation: 'chat',
      inputTokens: estimateTokensFromChars(promptChars),
      outputTokens: 0,
      latencyMs: Date.now() - started,
      promptChars,
      responseChars: 0,
      retrievedChunkCount: retrieval.chunks.length,
      retrievedCategories: retrieval.categories,
      route,
      usedRag: route === 'knowledge_base',
      usedSummary: memory.usedSummary,
      summaryChars: memory.summaryChars,
      knowledgeChars,
      baselineTokensEstimate,
      fallbackUsed: true,
      success: false,
      errorMessage: detail,
    });

    return fallback;
  }
}
