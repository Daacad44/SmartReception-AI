import { DocumentStatus, DocumentType } from '@prisma/client';
import { prisma } from '../database/prisma';
import { storageService } from '../storage';
import { getDocumentQueue } from '../queue/queues';
import { extractDocumentText } from '../../modules/knowledge/document-processor';
import { generateEmbeddings, extractKnowledge } from '../ai/gemini.service';
import { invalidateKnowledgeCache } from '../ai/knowledge-search.service';
import { indexDocumentChunks } from '../ai/rag/chunk-indexer.service';
import { logger } from '../../core/logger';
import { notifyKnowledge } from '../notifications/notification-helper';

const CHUNK_SIZE = 1500;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if ((current + '\n\n' + trimmed).length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [text.slice(0, CHUNK_SIZE)];
}

async function downloadFileBuffer(fileUrl: string): Promise<Buffer> {
  if (fileUrl.startsWith('supabase://') || fileUrl.startsWith('http')) {
    return storageService.download(fileUrl);
  }
  throw new Error('Unsupported file URL');
}

export async function processDocumentById(documentId: string, businessId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findFirst({
    where: {
      id: documentId,
      knowledgeBase: { businessId },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.status === 'INDEXED') {
    return;
  }

  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'PROCESSING', processingError: null },
  });

  try {
    let content = document.content || '';

    if (!content && document.fileUrl && document.type !== 'FAQ') {
      const buffer = await downloadFileBuffer(document.fileUrl);
      content = await extractDocumentText(buffer, document.type);
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('No text could be extracted from this document');
    }

    const enriched = await extractKnowledge(trimmed.slice(0, 50000));
    const indexableText = enriched || trimmed;

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'INDEXING', content: indexableText.slice(0, 50000) },
    });

    const chunks = chunkText(indexableText.slice(0, 50000));
    const embeddings = await generateEmbeddings(chunks);
    const indexedChunks = chunks.map((text, index) => ({
      text,
      embedding: embeddings[index] ?? null,
    }));

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'INDEXED',
        embedding: JSON.stringify({
          chunks: indexedChunks,
          chunkCount: chunks.length,
          vectorSearchEnabled: embeddings.some((e) => e !== null),
        }),
        processingError: null,
      },
    });

    logger.info(`Document ${documentId} indexed with ${chunks.length} chunks`);
    invalidateKnowledgeCache(businessId);

    await indexDocumentChunks({
      businessId,
      documentId,
      title: document.title,
      category: document.category,
      type: document.type,
      content: indexableText.slice(0, 50000),
      question: document.question,
      answer: document.answer,
    });

    const { invalidateRetrievalCache } = await import('../ai/rag/retrieval.service');
    invalidateRetrievalCache(businessId);

    await notifyKnowledge(
      businessId,
      'Document indexed',
      `Knowledge document is ready for AI search (${chunks.length} chunks)`,
      documentId
    );

    const { scheduleAutoTrainingAfterProcessing } = await import(
      '../../modules/ai-training-mgmt/auto-training.service'
    );
    void scheduleAutoTrainingAfterProcessing(businessId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document processing failed';
    logger.error(`Document processing failed for ${documentId}:`, error);
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'FAILED', processingError: message },
    });
    throw error;
  }
}

export function scheduleDocumentProcessing(
  documentId: string,
  knowledgeBaseId: string,
  businessId: string
): void {
  const queue = getDocumentQueue();

  if (queue) {
    void queue
      .add('process-document', { documentId, knowledgeBaseId, businessId })
      .catch((error) => logger.error('Failed to enqueue document job:', error));
    return;
  }

  void processDocumentById(documentId, businessId).catch((error) => {
    logger.error(`Background document processing failed for ${documentId}:`, error);
  });
}
