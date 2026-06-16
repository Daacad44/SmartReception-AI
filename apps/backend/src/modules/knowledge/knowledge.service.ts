import { knowledgeRepository } from './knowledge.repository';
import { NotFoundError } from '../../core/errors';
import { CreateFaqInput } from '@smartreception/shared';
import { storageService } from '../../infrastructure/storage/r2.service';
import { getDocumentQueue } from '../../infrastructure/queue/queues';
import { prisma } from '../../infrastructure/database/prisma';
import { DocumentType } from '@prisma/client';

const MIME_TO_TYPE: Record<string, DocumentType> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
};

export class KnowledgeService {
  async listBases(businessId: string) {
    return knowledgeRepository.findBases(businessId);
  }

  async getBase(businessId: string, id: string) {
    const base = await knowledgeRepository.findBaseById(businessId, id);
    if (!base) {
      throw new NotFoundError('Knowledge base not found');
    }
    return base;
  }

  async uploadDocument(
    businessId: string,
    file: Express.Multer.File,
    title?: string,
    knowledgeBaseId?: string
  ) {
    const base =
      knowledgeBaseId
        ? await knowledgeRepository.findBaseById(businessId, knowledgeBaseId)
        : await knowledgeRepository.getDefaultBase(businessId);

    if (!base) {
      throw new NotFoundError('Knowledge base not found');
    }

    const docType = MIME_TO_TYPE[file.mimetype];
    if (!docType) {
      throw new NotFoundError('Unsupported file type. Allowed: PDF, DOCX, TXT');
    }

    const { url } = await storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      `knowledge/${businessId}`
    );

    const document = await knowledgeRepository.createDocument({
      knowledgeBaseId: base.id,
      title: title || file.originalname,
      type: docType,
      fileUrl: url,
      fileSize: file.size,
      content: docType === 'TXT' ? file.buffer.toString('utf-8') : undefined,
    });

    const queue = getDocumentQueue();
    if (queue) {
      await queue.add('process-document', {
        documentId: document.id,
        knowledgeBaseId: base.id,
        businessId,
      });
    } else if (docType === 'TXT') {
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'INDEXED' },
      });
    }

    return document;
  }

  async listFaqs(businessId: string, knowledgeBaseId?: string) {
    return knowledgeRepository.findFaqs(businessId, knowledgeBaseId);
  }

  async createFaq(businessId: string, input: CreateFaqInput, userId: string) {
    const base = await knowledgeRepository.getDefaultBase(businessId);
    if (!base) {
      throw new NotFoundError('Knowledge base not found');
    }

    const document = await knowledgeRepository.createDocument({
      knowledgeBaseId: base.id,
      title: input.question,
      type: 'FAQ',
      question: input.question,
      answer: input.answer,
      category: input.category,
      content: `Q: ${input.question}\nA: ${input.answer}`,
    });

    await knowledgeRepository.updateDocument(document.id, { status: 'INDEXED' });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'KnowledgeDocument',
        entityId: document.id,
      },
    });

    return document;
  }

  async updateFaq(
    businessId: string,
    id: string,
    input: Partial<CreateFaqInput>,
    userId: string
  ) {
    const document = await knowledgeRepository.findDocument(businessId, id);
    if (!document || document.type !== 'FAQ') {
      throw new NotFoundError('FAQ not found');
    }

    const updated = await knowledgeRepository.updateDocument(id, {
      title: input.question,
      question: input.question,
      answer: input.answer,
      category: input.category,
      content:
        input.question && input.answer
          ? `Q: ${input.question}\nA: ${input.answer}`
          : undefined,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'KnowledgeDocument',
        entityId: id,
      },
    });

    return updated;
  }

  async deleteFaq(businessId: string, id: string, userId: string) {
    const document = await knowledgeRepository.findDocument(businessId, id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    await knowledgeRepository.deleteDocument(id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'KnowledgeDocument',
        entityId: id,
      },
    });
  }

  async deleteDocument(businessId: string, id: string, userId: string) {
    const document = await knowledgeRepository.findDocument(businessId, id);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (document.fileUrl) {
      try {
        await storageService.delete(document.fileUrl);
      } catch {
        // File may already be removed from storage
      }
    }

    await knowledgeRepository.deleteDocument(id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'KnowledgeDocument',
        entityId: id,
      },
    });
  }
}

export const knowledgeService = new KnowledgeService();
