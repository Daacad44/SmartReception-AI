import { config } from '../../../config';
import { logger } from '../../../core/logger';
import { prisma } from '../../database/prisma';
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
import {
  buildConversationMemory,
} from '../memory/conversation-memory.service';
import { executeEnterpriseRetrieval } from './enterprise-retrieval.service';
import { compressContextForPrompt } from './context-compression.service';
import {
  buildEnterpriseKnowledgePrompt,
  buildEnterpriseProfilePrompt,
  estimateTokensFromChars,
} from './prompt-builder.service';
import { aiUsageTracker } from '../../../modules/ai-analytics/usage-tracker.service';
import type { AiResourceRoute } from '../ai-intent-router.service';

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

  const [profile, businessContext, memory, retrieval] = await Promise.all([
    getCachedBusinessProfile(businessId),
    loadBusinessAIPrompt(businessId),
    buildConversationMemory(businessId, conversationId),
    executeEnterpriseRetrieval(businessId, customerMessage, { isFirstCustomerMessage }),
  ]);

  const route = options.forceRoute ?? retrieval.route;
  const business = profile.business;
  const aiConfig = businessContext.aiConfiguration;

  const fallback: AIResponse = {
    content: businessContext.fallbackMessage || aiConfig?.fallbackMessage || GEMINI_ERROR_MESSAGE_SO,
    intent: retrieval.intent,
    actions: [{ type: 'none' }],
    confidence: 0,
    language,
  };

  const compressed = compressContextForPrompt({
    chunks: retrieval.chunks,
    memory,
    baselineCharEstimate: retrieval.baselineCharEstimate,
  });

  let built;
  if (route === 'business_profile') {
    const profileContext = await getBusinessProfileContext(businessId);
    built = buildEnterpriseProfilePrompt({
      businessName: businessContext.businessName,
      systemPrompt: businessContext.systemPrompt,
      compressed,
      customerMessage,
      preferEnglish,
      route,
      profileContext,
      groundedConfidence: retrieval.groundedConfidence,
    });
  } else {
    if (!retrieval.searchSuccess && retrieval.usedFallback) {
      const noKnowledgeMessage = preferEnglish
        ? "I don't have specific information about that in our knowledge base yet. A team member can help you with more details."
        : "Weli macluumaad gaar ah oo ku saabsan su'aashaada kuma hayno. Shaqaale ayaa ku caawin kara faahfaahin dheeraad ah.";

      await aiUsageTracker.record({
        businessId,
        conversationId,
        customerId: options.customerId,
        messageId: options.messageId,
        provider: config.ai.provider,
        model: config.ai.model,
        operation: 'chat',
        inputTokens: 0,
        outputTokens: estimateTokensFromChars(noKnowledgeMessage.length),
        latencyMs: Date.now() - started,
        promptChars: 0,
        responseChars: noKnowledgeMessage.length,
        retrievedChunkCount: 0,
        retrievedCategories: [],
        intent: retrieval.intent,
        route,
        usedRag: true,
        usedSummary: memory.usedSummary,
        summaryChars: memory.summaryChars,
        knowledgeChars: 0,
        baselineTokensEstimate: estimateTokensFromChars(retrieval.baselineCharEstimate),
        tokenSavingsPercent: 100,
        fallbackUsed: true,
        success: true,
        metadata: {
          hallucinationGuard: true,
          groundedConfidence: retrieval.groundedConfidence,
          retrievalMs: retrieval.retrievalMs,
        },
      });

      return {
        content: noKnowledgeMessage,
        intent: retrieval.intent,
        actions: [{ type: 'none' }],
        confidence: 0.2,
        language,
      };
    }

    built = buildEnterpriseKnowledgePrompt({
      businessName: businessContext.businessName,
      systemPrompt: businessContext.systemPrompt,
      compressed,
      customerMessage,
      preferEnglish,
      route: 'knowledge_base',
      groundedConfidence: retrieval.groundedConfidence,
    });
  }

  const { systemPrompt, userPrompt, knowledgeChars, compressionPercent, citations } = built;
  const baselineTokensEstimate = estimateTokensFromChars(
    retrieval.baselineCharEstimate || knowledgeChars * 20
  );
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
      await recordUsage({
        businessId,
        conversationId,
        customerId: options.customerId,
        messageId: options.messageId,
        provider: provider.name,
        model: provider.chatModel,
        inputTokens: estimateTokensFromChars(promptChars),
        outputTokens: 0,
        latencyMs: Date.now() - started,
        promptChars,
        responseChars: 0,
        retrieval,
        memory,
        knowledgeChars,
        baselineTokensEstimate,
        compressionPercent,
        citations,
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
      ['services', 'pricing', 'general', 'support', 'lead'].includes(parsed.intent || retrieval.intent)
    ) {
      content = `${content}\n\n${CONTACT_FOOTER_SO}`;
    }

    const modelConfidence = parsed.confidence ?? 0.7;
    const blendedConfidence = Math.min(
      modelConfidence,
      retrieval.groundedConfidence > 0 ? retrieval.groundedConfidence : modelConfidence
    );

    const savingsTokens = Math.max(0, baselineTokensEstimate - response.usage.totalTokens);
    const tokenSavingsPercent =
      baselineTokensEstimate > 0 ? (savingsTokens / baselineTokensEstimate) * 100 : compressionPercent;

    await recordUsage({
      businessId,
      conversationId,
      customerId: options.customerId,
      messageId: options.messageId,
      provider: response.provider,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: response.latencyMs,
      promptChars,
      responseChars: content.length,
      retrieval,
      memory,
      knowledgeChars,
      baselineTokensEstimate,
      compressionPercent: tokenSavingsPercent,
      citations,
      fallbackUsed: retrieval.usedFallback,
      success: true,
      intent: parsed.intent || retrieval.intent,
      confidence: blendedConfidence,
    });

    return {
      content,
      intent: parsed.intent || retrieval.intent,
      actions: parsed.actions || [{ type: 'none' }],
      confidence: blendedConfidence,
      language: parsed.language || language,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('RAG pipeline failed', { detail, businessId, conversationId });

    await recordUsage({
      businessId,
      conversationId,
      customerId: options.customerId,
      messageId: options.messageId,
      provider: config.ai.provider,
      model: config.ai.model,
      inputTokens: estimateTokensFromChars(promptChars),
      outputTokens: 0,
      latencyMs: Date.now() - started,
      promptChars,
      responseChars: 0,
      retrieval,
      memory,
      knowledgeChars,
      baselineTokensEstimate,
      compressionPercent,
      citations,
      fallbackUsed: true,
      success: false,
      errorMessage: detail,
    });

    return fallback;
  }
}

async function recordUsage(params: {
  businessId: string;
  conversationId: string;
  customerId?: string;
  messageId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  promptChars: number;
  responseChars: number;
  retrieval: Awaited<ReturnType<typeof executeEnterpriseRetrieval>>;
  memory: Awaited<ReturnType<typeof buildConversationMemory>>;
  knowledgeChars: number;
  baselineTokensEstimate: number;
  compressionPercent: number;
  citations: string[];
  fallbackUsed: boolean;
  success: boolean;
  errorMessage?: string;
  intent?: string;
  confidence?: number;
}) {
  await aiUsageTracker.record({
    businessId: params.businessId,
    conversationId: params.conversationId,
    customerId: params.customerId,
    messageId: params.messageId,
    provider: params.provider,
    model: params.model,
    operation: 'chat',
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    latencyMs: params.latencyMs,
    promptChars: params.promptChars,
    responseChars: params.responseChars,
    retrievedChunkCount: params.retrieval.chunks.length,
    retrievedCategories: params.retrieval.categories,
    intent: params.intent ?? params.retrieval.intent,
    route: params.retrieval.route,
    usedRag: params.retrieval.route === 'knowledge_base',
    usedSummary: params.memory.usedSummary,
    summaryChars: params.memory.summaryChars,
    knowledgeChars: params.knowledgeChars,
    baselineTokensEstimate: params.baselineTokensEstimate,
    tokenSavingsPercent: params.compressionPercent,
    fallbackUsed: params.fallbackUsed,
    success: params.success,
    errorMessage: params.errorMessage,
    metadata: {
      chunkIds: params.citations,
      knowledgeIds: params.retrieval.knowledgeIds,
      searchSuccess: params.retrieval.searchSuccess,
      cacheHit: params.retrieval.cacheHit,
      retrievalMs: params.retrieval.retrievalMs,
      validationMs: params.retrieval.validationMs,
      rankingMs: params.retrieval.rankingMs,
      maxScore: params.retrieval.maxScore,
      avgScore: params.retrieval.avgScore,
      groundedConfidence: params.retrieval.groundedConfidence,
      hallucinationRisk: params.retrieval.hallucinationRisk,
      secondaryRetrievalUsed: params.retrieval.secondaryRetrievalUsed,
      confidence: params.confidence,
      contextSize: params.promptChars,
      compressionPercent: params.compressionPercent,
    },
  });
}
