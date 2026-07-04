import { prisma } from '../../infrastructure/database/prisma';
import { DocumentType } from '@prisma/client';

export class KnowledgeRepository {
  async findBases(businessId: string) {
    return prisma.knowledgeBase.findMany({
      where: { businessId, isActive: true },
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findBaseById(businessId: string, id: string) {
    return prisma.knowledgeBase.findFirst({
      where: { id, businessId, isActive: true },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getDefaultBase(businessId: string) {
    return prisma.knowledgeBase.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDocument(data: {
    knowledgeBaseId: string;
    title: string;
    type: DocumentType;
    fileUrl?: string;
    fileSize?: number;
    content?: string;
    category?: string;
    question?: string;
    answer?: string;
    status?: 'UPLOADED' | 'PENDING' | 'PROCESSING' | 'INDEXING' | 'INDEXED' | 'FAILED';
  }) {
    return prisma.knowledgeDocument.create({ data });
  }

  async findDocument(businessId: string, documentId: string) {
    return prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        knowledgeBase: { businessId },
      },
    });
  }

  async updateDocument(
    documentId: string,
    data: {
      title?: string;
      content?: string;
      status?: 'UPLOADED' | 'PENDING' | 'PROCESSING' | 'INDEXING' | 'INDEXED' | 'FAILED';
      processingError?: string | null;
      category?: string;
      question?: string;
      answer?: string;
    }
  ) {
    return prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        title: data.title,
        content: data.content,
        status: data.status as 'UPLOADED' | 'PENDING' | 'PROCESSING' | 'INDEXING' | 'INDEXED' | 'FAILED' | undefined,
        processingError: data.processingError,
        category: data.category,
        question: data.question,
        answer: data.answer,
      },
    });
  }

  async deleteDocument(documentId: string) {
    return prisma.knowledgeDocument.delete({ where: { id: documentId } });
  }

  async findFaqs(businessId: string, knowledgeBaseId?: string) {
    return prisma.knowledgeDocument.findMany({
      where: {
        type: 'FAQ',
        knowledgeBase: {
          businessId,
          ...(knowledgeBaseId && { id: knowledgeBaseId }),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const knowledgeRepository = new KnowledgeRepository();
