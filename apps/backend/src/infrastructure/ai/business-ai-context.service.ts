import type { AIConfiguration, Business, KnowledgeDocument } from '@prisma/client';
import { prisma } from '../database/prisma';
import { knowledgeRepository } from '../../modules/knowledge/knowledge.repository';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import {
  buildDefaultSystemPrompt,
  isSmartReceptionBusiness,
  isSmartReceptionStoredContent,
} from './smartreception-tenant';

export interface BusinessAIContext {
  businessId: string;
  businessName: string;
  aiConfiguration: AIConfiguration;
  knowledgeContext: string;
  systemPrompt: string;
  fallbackMessage: string;
}

const KNOWLEDGE_DOC_LIMIT = 20;

type KnowledgeSnippet = Pick<KnowledgeDocument, 'type' | 'question' | 'answer' | 'content'>;

function formatKnowledgeDocuments(documents: KnowledgeSnippet[]): string {
  return documents
    .map((doc) => {
      if (doc.type === 'FAQ') {
        return `Q: ${doc.question}\nA: ${doc.answer}`;
      }
      return doc.content?.slice(0, 1000) || '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildBusinessSystemPrompt(
  business: Pick<Business, 'id' | 'slug' | 'name'>,
  aiConfig: AIConfiguration
): string {
  const stored = aiConfig.systemPrompt?.trim();
  if (stored) {
    if (isSmartReceptionBusiness(business) || !isSmartReceptionStoredContent(stored)) {
      return stored;
    }
  }

  return buildDefaultSystemPrompt(business.name);
}

function buildBusinessFallbackMessage(
  business: Pick<Business, 'name'>,
  aiConfig: AIConfiguration
): string {
  if (aiConfig.fallbackMessage?.trim()) {
    return aiConfig.fallbackMessage.trim();
  }

  return `Thank you for contacting ${business.name}. A team member will assist you shortly.`;
}

/** Hot-path prompt load — cached profile only, no KB document scan (searchKnowledgeContext handles retrieval). */
export async function loadBusinessAIPrompt(
  businessId: string
): Promise<Pick<BusinessAIContext, 'businessId' | 'businessName' | 'aiConfiguration' | 'systemPrompt' | 'fallbackMessage'>> {
  const profile = await getCachedBusinessProfile(businessId);
  const business = profile.business;

  const aiConfiguration =
    profile.aiConfiguration ??
    (await prisma.aIConfiguration.create({ data: { businessId } }));

  return {
    businessId,
    businessName: business.name,
    aiConfiguration,
    systemPrompt: buildBusinessSystemPrompt(business, aiConfiguration),
    fallbackMessage: buildBusinessFallbackMessage(business, aiConfiguration),
  };
}

/** Load AI prompt + static KB snapshot for a single business. Never uses global defaults. */
export async function loadBusinessAIContext(businessId: string): Promise<BusinessAIContext> {
  const prompt = await loadBusinessAIPrompt(businessId);

  const knowledgeBase = await knowledgeRepository.getDefaultBase(businessId);
  const documents = knowledgeBase
    ? await prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId: knowledgeBase.id, status: 'INDEXED', knowledgeBase: { businessId } },
        orderBy: { createdAt: 'desc' },
        take: KNOWLEDGE_DOC_LIMIT,
        select: {
          type: true,
          question: true,
          answer: true,
          content: true,
        },
      })
    : [];

  const knowledgeContext =
    documents.length > 0
      ? formatKnowledgeDocuments(documents)
      : 'No knowledge base content is available for this business yet.';

  return { ...prompt, knowledgeContext };
}
