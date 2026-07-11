import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { logger } from '../../core/logger';
import { GEMINI_ERROR_MESSAGE_SO } from './smartreception-knowledge';
import { requestsEnglish } from './somali-menu';
import type { AIResponse } from './ai.types';
import { resolveAiProvider, resolveEmbeddingProvider } from './providers/provider-factory';
import { executeRagPipeline } from './rag/rag-pipeline.service';
import type { RagPipelineMeta } from './rag/rag-pipeline.service';
import type { AiResourceRoute } from './ai-intent-router.service';

export interface GenerateResponseOptions {
  preferEnglish?: boolean;
  isFirstCustomerMessage?: boolean;
  forceRoute?: AiResourceRoute;
  customerId?: string;
  messageId?: string;
  sandbox?: boolean;
}

const CHAT_MODEL = 'gemini-2.5-flash';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!genAI) genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
  return genAI;
}

export async function generateResponse(
  businessId: string,
  conversationId: string,
  customerMessage: string,
  options: GenerateResponseOptions = {}
): Promise<AIResponse & { _meta?: RagPipelineMeta }> {
  return executeRagPipeline(businessId, conversationId, customerMessage, options);
}

export async function summarizeDocument(text: string): Promise<string> {
  try {
    const provider = resolveAiProvider();
    const response = await provider.chat({
      systemPrompt: 'Summarize business documents in 3-5 bullet points.',
      userPrompt: text.slice(0, 12000),
      temperature: 0.3,
      maxOutputTokens: 500,
    });
    return response.text.trim() || text.slice(0, 500);
  } catch (error) {
    logger.warn('Document summarize failed', { error });
    return text.slice(0, 500);
  }
}

export async function extractKnowledge(text: string): Promise<string> {
  try {
    const provider = resolveAiProvider();
    const response = await provider.chat({
      systemPrompt:
        'Extract operational knowledge only (products, services, pricing, FAQs, policies). No company mission or contact info.',
      userPrompt: text.slice(0, 15000),
      temperature: 0.2,
      maxOutputTokens: 2000,
    });
    return response.text.trim() || text.slice(0, 2000);
  } catch (error) {
    logger.warn('extractKnowledge failed', { error });
    return text.slice(0, 2000);
  }
}

export async function answerQuestion(question: string, context: string): Promise<string> {
  try {
    const provider = resolveAiProvider();
    const preferEnglish = requestsEnglish(question);
    const response = await provider.chat({
      systemPrompt: preferEnglish ? 'Reply in English.' : 'Reply in Somali.',
      userPrompt: `Context:\n${context}\n\nQuestion: ${question}`,
      maxOutputTokens: 400,
    });
    return response.text.trim() || GEMINI_ERROR_MESSAGE_SO;
  } catch {
    return GEMINI_ERROR_MESSAGE_SO;
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const results = await generateEmbeddings([text]);
  return results[0] ?? null;
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  try {
    const provider = resolveEmbeddingProvider();
    const result = await provider.embed({ texts });
    return result.embeddings;
  } catch (error) {
    if (!config.ai.geminiApiKey) return texts.map(() => null);
    const model = getClient().getGenerativeModel({ model: config.ai.embeddingModel });
    return Promise.all(
      texts.map(async (text) => {
        try {
          const result = await model.embedContent(text.slice(0, 8000));
          return result.embedding?.values ?? null;
        } catch {
          return null;
        }
      })
    );
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
    const provider = resolveAiProvider();
    const response = await provider.chat({
      systemPrompt: 'Classify intent as one word only.',
      userPrompt: `support, booking, lead, pricing, services, or general.\nMessage: ${message}`,
      temperature: 0,
      maxOutputTokens: 10,
    });
    return response.text.toLowerCase().trim().split(/\s+/)[0] || 'general';
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
