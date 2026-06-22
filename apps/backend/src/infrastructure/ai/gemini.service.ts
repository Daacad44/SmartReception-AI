import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';
import {
  GEMINI_ERROR_MESSAGE_SO,
  SMARTRECEPTION_SYSTEM_PROMPT,
  detectMessageLanguage,
} from './smartreception-knowledge';
import type { AIResponse } from './ai.types';
import { searchKnowledgeContext } from './knowledge-search.service';

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

function buildLanguageInstruction(language: 'so' | 'en' | 'mixed'): string {
  if (language === 'so') {
    return 'Customer wrote in Somali. Reply ONLY in Somali (Af-Soomaali).';
  }
  if (language === 'en') {
    return 'Customer wrote in English. Reply ONLY in English.';
  }
  return 'Customer used mixed Somali-English. Reply naturally using both languages as appropriate.';
}

export async function generateResponse(
  businessId: string,
  conversationId: string,
  customerMessage: string
): Promise<AIResponse> {
  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { businessId },
  });

  const language = detectMessageLanguage(customerMessage);
  const knowledgeContext = await searchKnowledgeContext(businessId, customerMessage);

  const conversationHistory = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { direction: true, content: true },
  });

  const historyText = conversationHistory
    .reverse()
    .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const systemPrompt = aiConfig?.systemPrompt || SMARTRECEPTION_SYSTEM_PROMPT;
  const hasKnowledge = Boolean(knowledgeContext?.trim());

  const prompt = `${systemPrompt}

${buildLanguageInstruction(language)}

CRITICAL — ANSWER PRIORITY (follow strictly):
1. KNOWLEDGE BASE excerpts below (primary — never contradict them)
2. FAQ content in knowledge base
3. Business settings / system prompt company facts
4. Only if nothing above applies, use careful reasoning

${hasKnowledge ? 'You MUST answer using the KNOWLEDGE BASE below. Do NOT use general world knowledge when KB has the answer.' : 'No KB excerpts matched — use SmartReception company facts from the system prompt.'}

KNOWLEDGE BASE EXCERPTS:
${knowledgeContext || '(none indexed)'}

LEAD COLLECTION:
If customer shows buying intent for any service, collect: Full Name, Business Name, Phone, Email, Service Required.
Ask one or two fields at a time. When all fields collected, set action collect_lead with complete:true.

CONVERSATION HISTORY:
${historyText || 'No prior messages.'}

CUSTOMER MESSAGE:
${customerMessage}

Respond in JSON only:
{
  "content": "your WhatsApp reply",
  "intent": "support|booking|lead|pricing|services|general",
  "actions": [{"type": "none"}],
  "confidence": 0.0-1.0,
  "language": "so|en|mixed"
}

Action types: none, collect_lead, book_appointment, qualify_lead, escalate
For collect_lead include data: { "fullName", "businessName", "phone", "email", "service", "complete": true|false }

Never say "I am having trouble right now" unless Gemini truly failed. Be specific using KB facts.`;

  try {
    const model = getChatModel({ temperature: aiConfig?.temperature ?? 0.7 });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text()?.trim() || '{}';

    let parsed: AIResponse;
    try {
      parsed = JSON.parse(responseText) as AIResponse;
    } catch {
      logger.warn('Gemini JSON parse failed, using raw text', { preview: responseText.slice(0, 200) });
      return {
        content: responseText.slice(0, 2000) || GEMINI_ERROR_MESSAGE_SO,
        intent: 'general',
        actions: [{ type: 'none' }],
        confidence: 0.5,
        language,
      };
    }

    if (!parsed.content?.trim()) {
      return {
        content: language === 'en'
          ? 'How can I help you today?'
          : 'Sideen kuu caawin karnaa maanta?',
        intent: parsed.intent || 'general',
        actions: parsed.actions || [{ type: 'none' }],
        confidence: 0.5,
        language,
      };
    }

    console.log('[AI] Response generated (Gemini)');
    return {
      content: parsed.content,
      intent: parsed.intent || 'general',
      actions: parsed.actions || [{ type: 'none' }],
      confidence: parsed.confidence ?? 0.7,
      language: parsed.language || language,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[AI] Gemini generation failed:', detail);
    logger.error('Gemini generation failed:', { detail });
    return {
      content: aiConfig?.fallbackMessage || GEMINI_ERROR_MESSAGE_SO,
      intent: 'general',
      actions: [{ type: 'none' }],
      confidence: 0,
      language,
    };
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
      `Extract key facts, services, pricing notes, and FAQs from this document. Output plain text, bilingual Somali/English where useful:\n\n${text.slice(0, 15000)}`
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
    const lang = detectMessageLanguage(question);
    const result = await model.generateContent(
      `${buildLanguageInstruction(lang)}\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely for WhatsApp.`
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
