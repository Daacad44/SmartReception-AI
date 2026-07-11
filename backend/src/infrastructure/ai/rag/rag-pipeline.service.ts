import { config } from '../../../config';
import { logger } from '../../../core/logger';
import { prisma } from '../../database/prisma';
import { loadBusinessAIPrompt } from '../business-ai-context.service';
import { getBusinessProfileContext } from '../business-profile-prompt.service';
import { buildAppointmentAvailabilityContext } from '../../appointments/appointment-availability.service';
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
import { handoverReply } from '../../../modules/ai-training-mgmt/ai-knowledge.constants';
import type { ScoredChunk } from './types';

export interface RagPipelineOptions {
  preferEnglish?: boolean;
  isFirstCustomerMessage?: boolean;
  forceRoute?: AiResourceRoute;
  customerId?: string;
  messageId?: string;
  /**
   * Sandbox mode: runs the identical retrieval + grounding + generation path as
   * production but skips analytics/usage recording so validation runs never
   * pollute live cost or conversation metrics.
   */
  sandbox?: boolean;
}

/** Super-admin-only diagnostics attached to every pipeline result. */
export interface RagPipelineMeta {
  route: string;
  intent: string;
  missingKnowledge: boolean;
  searchSuccess: boolean;
  usedFallback: boolean;
  groundedConfidence: number;
  hallucinationRisk: number;
  embeddingMatchScore: number;
  avgScore: number;
  confidence: number;
  retrievalMs: number;
  latencyMs: number;
  provider: string;
  model: string;
  knowledgeChars: number;
  promptChars: number;
  retrievedChunkCount: number;
  categories: string[];
  chunks: Array<{
    id: string;
    title: string;
    section: string | null;
    score: number;
    confidence: string;
  }>;
}

function toMetaChunks(chunks: ScoredChunk[]): RagPipelineMeta['chunks'] {
  return chunks.map((c) => ({
    id: c.id,
    title: c.title ?? 'Untitled',
    section: c.category ?? null,
    score: Math.round(c.score * 1000) / 1000,
    confidence: String(c.confidence),
  }));
}

export async function executeRagPipeline(
  businessId: string,
  conversationId: string,
  customerMessage: string,
  options: RagPipelineOptions = {}
): Promise<AIResponse & { _meta?: RagPipelineMeta }> {
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

  const buildMeta = (overrides: Partial<RagPipelineMeta> = {}): RagPipelineMeta => ({
    route,
    intent: retrieval.intent,
    missingKnowledge: retrieval.usedFallback || !retrieval.searchSuccess,
    searchSuccess: retrieval.searchSuccess,
    usedFallback: retrieval.usedFallback,
    groundedConfidence: retrieval.groundedConfidence,
    hallucinationRisk: retrieval.hallucinationRisk,
    embeddingMatchScore: retrieval.maxScore,
    avgScore: retrieval.avgScore,
    confidence: retrieval.groundedConfidence,
    retrievalMs: retrieval.retrievalMs,
    latencyMs: Date.now() - started,
    provider: config.ai.provider,
    model: config.ai.model,
    knowledgeChars: 0,
    promptChars: 0,
    retrievedChunkCount: retrieval.chunks.length,
    categories: retrieval.categories,
    chunks: toMetaChunks(retrieval.chunks),
    ...overrides,
  });

  const compressed = compressContextForPrompt({
    chunks: retrieval.chunks,
    memory,
    baselineCharEstimate: retrieval.baselineCharEstimate,
  });

  // Appointment/hours questions need the real working hours + open slots so the
  // AI offers genuine times from PostgreSQL, never invented ones.
  const needsAvailability =
    retrieval.intent === 'booking' ||
    retrieval.intent === 'contact' ||
    /\b(open|hour|hours|appointment|book|booking|schedule|available|availability|today|closed)\b/i.test(
      customerMessage
    ) ||
    /(saacad|furan|xiran|xidhan|ballan|maanta|maalin)/i.test(customerMessage);
  const appointmentContext = needsAvailability
    ? await buildAppointmentAvailabilityContext(businessId)
    : undefined;

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
      appointmentContext,
      groundedConfidence: retrieval.groundedConfidence,
    });
  } else {
    if (!retrieval.searchSuccess && retrieval.usedFallback) {
      // Zero-hallucination guard: no grounded knowledge → never invent an answer.
      // Respond with the canonical handover script (identical in sandbox + live).
      const noKnowledgeMessage = handoverReply(preferEnglish);

      if (!options.sandbox) {
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
      }

      return {
        content: noKnowledgeMessage,
        intent: retrieval.intent,
        actions: [{ type: 'none' }],
        confidence: 0.2,
        language,
        _meta: buildMeta({ missingKnowledge: true, confidence: 0.2, latencyMs: Date.now() - started }),
      };
    }

    built = buildEnterpriseKnowledgePrompt({
      businessName: businessContext.businessName,
      systemPrompt: businessContext.systemPrompt,
      compressed,
      customerMessage,
      preferEnglish,
      route: 'knowledge_base',
      appointmentContext,
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
      if (!options.sandbox) {
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
      }
      return {
        ...fallback,
        _meta: buildMeta({
          provider: provider.name,
          model: provider.chatModel,
          knowledgeChars,
          promptChars,
          confidence: 0,
          latencyMs: Date.now() - started,
        }),
      };
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

    if (!options.sandbox) {
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
    }

    return {
      content,
      intent: parsed.intent || retrieval.intent,
      actions: parsed.actions || [{ type: 'none' }],
      confidence: blendedConfidence,
      language: parsed.language || language,
      _meta: buildMeta({
        intent: parsed.intent || retrieval.intent,
        provider: response.provider,
        model: response.model,
        knowledgeChars,
        promptChars,
        confidence: blendedConfidence,
        latencyMs: response.latencyMs,
      }),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('RAG pipeline failed', { detail, businessId, conversationId });

    if (!options.sandbox) {
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
    }

    return {
      ...fallback,
      _meta: buildMeta({ knowledgeChars, promptChars, confidence: 0, latencyMs: Date.now() - started }),
    };
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
