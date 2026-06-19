import { knowledgeRepository } from './knowledge.repository';
import { NotFoundError, ValidationError } from '../../core/errors';
import { CreateFaqInput } from '@smartreception/shared';
import { storageService } from '../../infrastructure/storage';
import { scheduleDocumentProcessing, processDocumentById } from '../../infrastructure/documents/document-processing.service';
import { prisma } from '../../infrastructure/database/prisma';
import { DocumentType } from '@prisma/client';

const MIME_TO_TYPE: Record<string, DocumentType> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOCX',
  'text/plain': 'TXT',
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

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
    if (!file?.buffer?.length) {
      throw new ValidationError('File is empty');
    }

    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT');
    }

    const base =
      knowledgeBaseId
        ? await knowledgeRepository.findBaseById(businessId, knowledgeBaseId)
        : await knowledgeRepository.getDefaultBase(businessId);

    if (!base) {
      throw new NotFoundError('Knowledge base not found');
    }

    const docType = MIME_TO_TYPE[file.mimetype] ?? MIME_TO_TYPE[this.mimeFromExtension(ext)];
    if (!docType) {
      throw new ValidationError('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT');
    }

    const { key, url } = await storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      `knowledge/${businessId}`
    );

    const document = await knowledgeRepository.createDocument({
      knowledgeBaseId: base.id,
      title: title || file.originalname,
      type: docType,
      fileUrl: url.includes('http') ? url : `supabase://knowledge-documents/${key}`,
      fileSize: file.size,
      status: 'UPLOADED',
    });

    scheduleDocumentProcessing(document.id, base.id, businessId);

    return document;
  }

  async processDocument(businessId: string, documentId: string) {
    const document = await knowledgeRepository.findDocument(businessId, documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (document.status === 'INDEXED') {
      return document;
    }

    scheduleDocumentProcessing(documentId, document.knowledgeBaseId, businessId);
    return knowledgeRepository.findDocument(businessId, documentId);
  }

  async getDocumentStatus(businessId: string, documentId: string) {
    const document = await knowledgeRepository.findDocument(businessId, documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    return {
      id: document.id,
      status: document.status,
      processingError: document.processingError,
      updatedAt: document.updatedAt,
    };
  }

  private mimeFromExtension(ext: string): string {
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
    };
    return map[ext] ?? '';
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
      status: 'INDEXED',
    });

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
