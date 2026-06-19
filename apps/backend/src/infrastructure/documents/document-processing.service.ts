import { DocumentStatus, DocumentType } from '@prisma/client';
import { prisma } from '../database/prisma';
import { storageService } from '../storage';
import { getDocumentQueue } from '../queue/queues';
import { extractDocumentText } from '../../modules/knowledge/document-processor';
import { logger } from '../../core/logger';

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

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'INDEXING', content: trimmed.slice(0, 50000) },
    });

    const chunks = chunkText(trimmed.slice(0, 50000));

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: 'INDEXED',
        embedding: JSON.stringify({ chunks, chunkCount: chunks.length }),
        processingError: null,
      },
    });

    logger.info(`Document ${documentId} indexed with ${chunks.length} chunks`);
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
