import { prisma } from '../../database/prisma';
import { resolveEmbeddingProvider } from '../providers/provider-factory';
import { logger } from '../../../core/logger';
import { config } from '../../../config';
import { intelligentChunkText } from './intelligent-chunking.service';
import { invalidateRagCaches } from './retrieval-cache.service';

const embeddingCache = new Map<string, { embedding: number[]; loadedAt: number }>();
const EMBEDDING_CACHE_TTL_MS = 300_000;

/** @deprecated Use intelligentChunkText — kept for compatibility */
export function chunkText(text: string): string[] {
  return intelligentChunkText(text);
}

function inferTags(text: string, category?: string | null): string[] {
  const tags = new Set<string>();
  if (category) tags.add(category.toLowerCase());
  const patterns: Array<[RegExp, string]> = [
    [/crm/i, 'crm'],
    [/whatsapp/i, 'whatsapp'],
    [/website|web/i, 'website'],
    [/mobile|app/i, 'mobile'],
    [/qiimo|price|pricing/i, 'pricing'],
    [/ballan|appointment/i, 'appointment'],
    [/ai receptionist/i, 'ai-receptionist'],
  ];
  for (const [pattern, tag] of patterns) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

export async function indexDocumentChunks(params: {
  businessId: string;
  documentId: string;
  title: string;
  category?: string | null;
  type: string;
  content: string;
  question?: string | null;
  answer?: string | null;
  versionId?: string | null;
  knowledgeVersion?: number;
}): Promise<number> {
  await prisma.knowledgeChunk.updateMany({
    where: { documentId: params.documentId },
    data: { isActive: false, status: 'ARCHIVED' },
  });

  const segments: Array<{ content: string; title: string; priority: number; description?: string }> = [];

  if (params.type === 'FAQ' && params.question) {
    segments.push({
      content: `Q: ${params.question}\nA: ${params.answer ?? ''}`,
      title: params.title,
      description: params.question,
      priority: 10,
    });
  } else {
    for (const [index, chunk] of intelligentChunkText(params.content).entries()) {
      segments.push({
        content: chunk,
        title: `${params.title} #${index + 1}`,
        description: chunk.slice(0, 120),
        priority: 0,
      });
    }
  }

  if (!segments.length) return 0;

  const provider = resolveEmbeddingProvider();
  const embedResult = await provider.embed({ texts: segments.map((s) => s.content) });
  const embeddingVersion = config.ai.embeddingModel;

  const rows = segments.map((segment, index) => ({
    businessId: params.businessId,
    documentId: params.documentId,
    versionId: params.versionId ?? undefined,
    title: segment.title,
    description: segment.description,
    category: params.category ?? params.type,
    tags: inferTags(segment.content, params.category),
    language: 'so',
    content: segment.content,
    embedding: embedResult.embeddings[index] ?? undefined,
    priority: segment.priority,
    chunkIndex: index,
    isActive: true,
    status: 'ACTIVE',
    source: params.type,
    embeddingVersion,
    knowledgeVersion: params.knowledgeVersion,
    confidenceScore: segment.priority >= 10 ? 0.9 : 0.7,
  }));

  await prisma.knowledgeChunk.createMany({
    data: rows.map((row) => ({
      ...row,
      embedding: row.embedding ?? undefined,
    })),
  });

  invalidateRagCaches(params.businessId);

  logger.info('Indexed knowledge chunks', {
    businessId: params.businessId,
    documentId: params.documentId,
    count: rows.length,
  });

  return rows.length;
}

export async function deactivateDocumentChunks(documentId: string): Promise<void> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { documentId },
    select: { businessId: true },
    take: 1,
  });
  await prisma.knowledgeChunk.updateMany({
    where: { documentId },
    data: { isActive: false, status: 'ARCHIVED' },
  });
  if (chunks[0]?.businessId) {
    invalidateRagCaches(chunks[0].businessId);
  }
}

export function invalidateEmbeddingCache(businessId: string): void {
  for (const key of embeddingCache.keys()) {
    if (key.startsWith(`${businessId}:`)) embeddingCache.delete(key);
  }
  invalidateRagCaches(businessId);
}

export async function getQueryEmbedding(businessId: string, query: string): Promise<number[] | null> {
  const cacheKey = `${businessId}:${query.slice(0, 200)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < EMBEDDING_CACHE_TTL_MS) {
    return cached.embedding;
  }

  const provider = resolveEmbeddingProvider();
  const result = await provider.embed({ texts: [query] });
  const embedding = result.embeddings[0];
  if (embedding) {
    embeddingCache.set(cacheKey, { embedding, loadedAt: Date.now() });
  }
  return embedding ?? null;
}

export async function backfillChunksFromLegacyDocuments(businessId: string): Promise<number> {
  const existing = await prisma.knowledgeChunk.count({
    where: { businessId, isActive: true, status: 'ACTIVE' },
  });
  if (existing > 0) return existing;

  const docs = await prisma.knowledgeDocument.findMany({
    where: { status: 'INDEXED', knowledgeBase: { businessId, isActive: true } },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      content: true,
      question: true,
      answer: true,
      embedding: true,
    },
    take: 100,
  });

  let total = 0;
  for (const doc of docs) {
    if (doc.embedding) {
      try {
        const parsed = JSON.parse(doc.embedding) as {
          chunks?: Array<{ text: string; embedding?: number[] | null }>;
        };
        if (parsed.chunks?.length) {
          await prisma.knowledgeChunk.updateMany({
            where: { documentId: doc.id },
            data: { isActive: false, status: 'ARCHIVED' },
          });
          await prisma.knowledgeChunk.createMany({
            data: parsed.chunks.map((chunk, index) => ({
              businessId,
              documentId: doc.id,
              title: `${doc.title} #${index + 1}`,
              category: doc.category ?? doc.type,
              tags: inferTags(chunk.text, doc.category),
              language: 'so',
              content: chunk.text,
              embedding: chunk.embedding ?? undefined,
              priority: doc.type === 'FAQ' ? 10 : 0,
              chunkIndex: index,
              isActive: true,
              status: 'ACTIVE',
              source: doc.type,
              embeddingVersion: config.ai.embeddingModel,
              confidenceScore: doc.type === 'FAQ' ? 0.9 : 0.7,
            })),
          });
          total += parsed.chunks.length;
          continue;
        }
      } catch {
        // fall through to re-index
      }
    }

    if (doc.content) {
      total += await indexDocumentChunks({
        businessId,
        documentId: doc.id,
        title: doc.title,
        category: doc.category,
        type: doc.type,
        content: doc.content,
        question: doc.question,
        answer: doc.answer,
      });
    }
  }

  invalidateRagCaches(businessId);
  return total;
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
