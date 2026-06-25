import type { AIConfiguration, Business, KnowledgeDocument } from '@prisma/client';
import { prisma } from '../database/prisma';
import { knowledgeRepository } from '../../modules/knowledge/knowledge.repository';
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

function formatKnowledgeDocuments(documents: KnowledgeDocument[]): string {
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

function buildBusinessSystemPrompt(business: Business, aiConfig: AIConfiguration): string {
  const stored = aiConfig.systemPrompt?.trim();
  if (stored) {
    if (isSmartReceptionBusiness(business) || !isSmartReceptionStoredContent(stored)) {
      return stored;
    }
  }

  return buildDefaultSystemPrompt(business.name);
}

function buildBusinessFallbackMessage(business: Business, aiConfig: AIConfiguration): string {
  if (aiConfig.fallbackMessage?.trim()) {
    return aiConfig.fallbackMessage.trim();
  }

  return `Thank you for contacting ${business.name}. A team member will assist you shortly.`;
}

/** Load AI prompt + knowledge for a single business. Never uses global defaults. */
export async function loadBusinessAIContext(businessId: string): Promise<BusinessAIContext> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  const aiConfiguration =
    (await prisma.aIConfiguration.findUnique({ where: { businessId } })) ??
    (await prisma.aIConfiguration.create({ data: { businessId } }));

  const knowledgeBase = await knowledgeRepository.getDefaultBase(businessId);
  const documents = knowledgeBase
    ? await prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId: knowledgeBase.id, status: 'INDEXED' },
        orderBy: { createdAt: 'desc' },
        take: KNOWLEDGE_DOC_LIMIT,
      })
    : [];

  const knowledgeContext =
    documents.length > 0
      ? formatKnowledgeDocuments(documents)
      : 'No knowledge base content is available for this business yet.';

  return {
    businessId,
    businessName: business.name,
    aiConfiguration,
    knowledgeContext,
    systemPrompt: buildBusinessSystemPrompt(business, aiConfiguration),
    fallbackMessage: buildBusinessFallbackMessage(business, aiConfiguration),
  };
}
