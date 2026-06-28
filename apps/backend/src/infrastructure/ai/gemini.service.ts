import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { conversationMessageScope } from '../database/tenant-query';
import { logger } from '../../core/logger';
import { GEMINI_ERROR_MESSAGE_SO } from './smartreception-knowledge';
import { CONTACT_FOOTER_SO, requestsEnglish } from './somali-menu';
import type { AIResponse } from './ai.types';
import { searchKnowledgeContext } from './knowledge-search.service';
import { withAiTimeout } from './gemini-timeout';
import { parseGeminiAiResponse } from './gemini-json-parse';
import { loadBusinessAIPrompt } from './business-ai-context.service';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import { isSmartReceptionBusiness } from './smartreception-tenant';
import {
  classifyAiResourceRoute,
  type AiResourceRoute,
} from './ai-intent-router.service';
import { getBusinessProfileContext } from './business-profile-prompt.service';

export interface GenerateResponseOptions {
  /** Reply in English only when customer explicitly requested it. */
  preferEnglish?: boolean;
  /** True when this is the customer's first inbound message in the conversation. */
  isFirstCustomerMessage?: boolean;
  /** Override automatic routing (tests / admin). */
  forceRoute?: AiResourceRoute;
}

const CHAT_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
  }
  return genAI;
}

function getChatModel(generationConfig?: Record<string, unknown>): GenerativeModel {
  return getClient().getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
      ...generationConfig,
    },
  });
}

function buildLanguageInstruction(preferEnglish: boolean): string {
  if (preferEnglish) {
    return 'Customer explicitly requested English. Reply ONLY in English.';
  }
  return 'ALWAYS reply ONLY in Somali (Af-Soomaali). Never use English unless the customer explicitly asked for English.';
}

function buildProfilePrompt(params: {
  businessName: string;
  profileContext: string;
  historyText: string;
  customerMessage: string;
  preferEnglish: boolean;
  fallbackMessage: string;
}): string {
  return `You are the company identity assistant for ${params.businessName}.

CRITICAL — USE ONLY BUSINESS PROFILE (never Knowledge Base, never general world knowledge):
${params.profileContext || '(Business profile not yet configured — introduce the business politely and offer to help.)'}

${buildLanguageInstruction(params.preferEnglish)}

RULES:
- Answer ONLY company identity questions: who we are, about us, mission, vision, contact, website, hours, address
- NEVER list product pricing, packages, or operational FAQs — those belong to a separate knowledge system
- Never reference SmartReception or any business other than ${params.businessName}
- Be warm and professional; match brand tone if provided
- If information is missing from the profile, say so politely

CONVERSATION HISTORY:
${params.historyText || 'No prior messages.'}

CUSTOMER MESSAGE:
${params.customerMessage}

Respond in JSON only:
{
  "content": "your WhatsApp reply",
  "intent": "company_intro|contact|general",
  "actions": [{"type": "none"}],
  "confidence": 0.0-1.0,
  "language": "${params.preferEnglish ? 'en' : 'so'}"
}`;
}

function buildKnowledgePrompt(params: {
  businessName: string;
  knowledgeContext: string;
  historyText: string;
  customerMessage: string;
  preferEnglish: boolean;
  systemPrompt: string;
}): string {
  const hasKnowledge = Boolean(params.knowledgeContext?.trim());

  return `${params.systemPrompt}

${buildLanguageInstruction(params.preferEnglish)}

CRITICAL — KNOWLEDGE BASE ONLY (operational questions):
- Use excerpts below for products, services, pricing, FAQs, policies, how-to, appointments, technical docs
- NEVER answer company introduction, mission, vision, website, or contact from this context
- If asked who you are or about the company, say you can share company details — do not invent from KB

${hasKnowledge ? `Answer using KNOWLEDGE BASE excerpts for ${params.businessName}.` : `No KB excerpts matched — ask the customer for more details politely.`}

KNOWLEDGE BASE EXCERPTS (${params.businessName}):
${params.knowledgeContext || '(none indexed)'}

LEAD COLLECTION:
If customer shows buying intent, collect: Full Name, Business Name, Phone, Email, Service Required.
Ask one or two fields at a time. When all fields collected, set action collect_lead with complete:true.

CONVERSATION HISTORY:
${params.historyText || 'No prior messages.'}

CUSTOMER MESSAGE:
${params.customerMessage}

Respond in JSON only:
{
  "content": "your WhatsApp reply",
  "intent": "support|booking|lead|pricing|services|general",
  "actions": [{"type": "none"}],
  "confidence": 0.0-1.0,
  "language": "${params.preferEnglish ? 'en' : 'so'}"
}

Action types: none, collect_lead, book_appointment, qualify_lead, escalate, request_feedback

Use request_feedback when the customer's issue appears resolved and you want satisfaction confirmation before closing.
Use escalate when the customer needs human support or you cannot help further.
For collect_lead include data: { "fullName", "businessName", "phone", "email", "service", "complete": true|false }

RULES:
- You are the operational assistant for ${params.businessName}, NOT a generic bot
- Never reference SmartReception unless this is SmartReception
- Be specific using KB facts only`;
}

export async function generateResponse(
  businessId: string,
  conversationId: string,
  customerMessage: string,
  options: GenerateResponseOptions = {}
): Promise<AIResponse> {
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

  const [profile, businessContext] = await Promise.all([
    getCachedBusinessProfile(businessId),
    loadBusinessAIPrompt(businessId),
  ]);
  const business = profile.business;
  const aiConfig = businessContext.aiConfiguration;

  const conversationHistory = await prisma.message.findMany({
    where: conversationMessageScope(conversationId, businessId),
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { direction: true, content: true },
  });

  const historyText = conversationHistory
    .reverse()
    .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const fallback: AIResponse = {
    content: businessContext.fallbackMessage || aiConfig?.fallbackMessage || GEMINI_ERROR_MESSAGE_SO,
    intent: 'general',
    actions: [{ type: 'none' }],
    confidence: 0,
    language,
  };

  let prompt: string;

  if (route === 'business_profile') {
    const profileContext = await getBusinessProfileContext(businessId);
    prompt = buildProfilePrompt({
      businessName: businessContext.businessName,
      profileContext,
      historyText,
      customerMessage,
      preferEnglish,
      fallbackMessage: fallback.content,
    });
    console.log('[AI] Route: Business Profile', { businessId, conversationId });
  } else {
    const knowledgeContext = await searchKnowledgeContext(businessId, customerMessage);
    prompt = buildKnowledgePrompt({
      businessName: businessContext.businessName,
      knowledgeContext,
      historyText,
      customerMessage,
      preferEnglish,
      systemPrompt: businessContext.systemPrompt,
    });
    console.log('[AI] Route: Knowledge Base', { businessId, conversationId });
  }

  try {
    const model = getChatModel({ temperature: aiConfig?.temperature ?? 0.7 });

    const result = await withAiTimeout(
      model.generateContent(prompt),
      null as unknown as Awaited<ReturnType<typeof model.generateContent>>,
      'Gemini generateContent'
    );

    if (!result) {
      return fallback;
    }

    const responseText = result.response.text()?.trim() || '{}';

    const parsed = parseGeminiAiResponse(responseText, language);
    if (!parsed) {
      logger.warn('Gemini JSON parse failed, using fallback', { preview: responseText.slice(0, 200) });
      return fallback;
    }

    if (!parsed.content?.trim()) {
      return {
        content: preferEnglish
          ? 'How can I help you today?'
          : 'Sideen kuu caawin karnaa maanta?',
        intent: parsed.intent || 'general',
        actions: parsed.actions || [{ type: 'none' }],
        confidence: 0.5,
        language,
      };
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
    console.log('[AI] Response generated (Gemini)', { route });
    return {
      content,
      intent: parsed.intent || 'general',
      actions: parsed.actions || [{ type: 'none' }],
      confidence: parsed.confidence ?? 0.7,
      language: parsed.language || language,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[AI] Gemini generation failed:', detail);
    logger.error('Gemini generation failed:', { detail, route });
    return fallback;
  }
}

export async function summarizeDocument(text: string): Promise<string> {
  try {
    const model = getClient().getGenerativeModel({ model: CHAT_MODEL });
    const result = await model.generateContent(
      `Summarize this business document in 3-5 bullet points (Somali and English keywords where helpful):\n\n${text.slice(0, 12000)}`
    );
    return result.response.text()?.trim() || text.slice(0, 500);
  } catch (error) {
    logger.warn('Gemini summarize failed', { error });
    return text.slice(0, 500);
  }
}

export async function extractKnowledge(text: string): Promise<string> {
  try {
    const model = getChatModel();
    const result = await model.generateContent(
      `Extract operational knowledge only (products, services, pricing, FAQs, policies, procedures).
Do NOT extract company mission, vision, or contact details — those belong in Business Profile.

Output plain text, bilingual Somali/English where useful:\n\n${text.slice(0, 15000)}`
    );
    return result.response.text()?.trim() || text.slice(0, 2000);
  } catch (error) {
    logger.warn('Gemini extractKnowledge failed', { error });
    return text.slice(0, 2000);
  }
}

export async function answerQuestion(question: string, context: string): Promise<string> {
  try {
    const model = getChatModel();
    const preferEnglish = requestsEnglish(question);
    const result = await model.generateContent(
      `${buildLanguageInstruction(preferEnglish)}\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely for WhatsApp.`
    );
    return result.response.text()?.trim() || GEMINI_ERROR_MESSAGE_SO;
  } catch {
    return GEMINI_ERROR_MESSAGE_SO;
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const results = await generateEmbeddings([text]);
  return results[0] ?? null;
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!config.ai.geminiApiKey || texts.length === 0) {
    return texts.map(() => null);
  }

  try {
    const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
    const results = await Promise.all(
      texts.map(async (text) => {
        try {
          const result = await model.embedContent(text.slice(0, 8000));
          return result.embedding?.values ?? null;
        } catch (error) {
          logger.debug('Single embedding failed', { error });
          return null;
        }
      })
    );
    return results;
  } catch (error) {
    logger.warn('Gemini embeddings batch failed', { error });
    return texts.map(() => null);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function detectIntent(message: string): Promise<string> {
  try {
    const model = getClient().getGenerativeModel({
      model: CHAT_MODEL,
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    });
    const result = await model.generateContent(
      `Classify intent as one word: support, booking, lead, pricing, services, or general.\nMessage: ${message}`
    );
    return result.response.text()?.toLowerCase().trim().split(/\s+/)[0] || 'general';
  } catch {
    return 'general';
  }
}

export const geminiService = {
  generateResponse,
  summarizeDocument,
  extractKnowledge,
  answerQuestion,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  detectIntent,
};
