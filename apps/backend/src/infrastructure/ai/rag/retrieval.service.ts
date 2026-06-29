import { config } from '../../../config';
import { prisma } from '../../database/prisma';
import { cosineSimilarity, getQueryEmbedding, backfillChunksFromLegacyDocuments } from './chunk-indexer.service';

const retrievalCache = new Map<string, { result: RetrievedChunk[]; loadedAt: number }>();
const RETRIEVAL_CACHE_TTL_MS = 30_000;

export interface RetrievedChunk {
  id: string;
  title: string | null;
  category: string | null;
  tags: string[];
  content: string;
  score: number;
  language: string;
}

export interface RagRetrievalResult {
  chunks: RetrievedChunk[];
  categories: string[];
  searchSuccess: boolean;
  usedFallback: boolean;
  baselineCharEstimate: number;
}

function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
    return value as number[];
  }
  return null;
}

function keywordScore(query: string, text: string, tags: string[]): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  if (t.includes(q)) score += 0.5;
  for (const word of q.split(/\s+/).filter((w) => w.length > 2)) {
    if (t.includes(word)) score += 0.08;
  }
  for (const tag of tags) {
    if (q.includes(tag.toLowerCase())) score += 0.15;
  }
  return score;
}

export async function retrieveRelevantChunks(
  businessId: string,
  query: string,
  topK = config.ai.ragTopK
): Promise<RagRetrievalResult> {
  const cacheKey = `${businessId}:${query.slice(0, 120)}`;
  const cached = retrievalCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < RETRIEVAL_CACHE_TTL_MS) {
    const categories = [...new Set(cached.result.map((c) => c.category).filter(Boolean))] as string[];
    return {
      chunks: cached.result,
      categories,
      searchSuccess: cached.result.length > 0,
      usedFallback: false,
      baselineCharEstimate: await estimateFullKbChars(businessId),
    };
  }

  let chunks = await prisma.knowledgeChunk.findMany({
    where: { businessId, isActive: true },
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      content: true,
      embedding: true,
      priority: true,
      language: true,
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  if (!chunks.length) {
    await backfillChunksFromLegacyDocuments(businessId);
    chunks = await prisma.knowledgeChunk.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        content: true,
        embedding: true,
        priority: true,
        language: true,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  const baselineCharEstimate = chunks.reduce((sum, c) => sum + c.content.length, 0);

  if (!chunks.length) {
    return { chunks: [], categories: [], searchSuccess: false, usedFallback: true, baselineCharEstimate: 0 };
  }

  const queryEmbedding = await getQueryEmbedding(businessId, query);
  const scored: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const embedding = parseEmbedding(chunk.embedding);
    let score = keywordScore(query, chunk.content, chunk.tags) + chunk.priority * 0.02;

    if (queryEmbedding && embedding) {
      score += cosineSimilarity(queryEmbedding, embedding) * 0.85;
    }

    if (score >= 0.2) {
      scored.push({
        id: chunk.id,
        title: chunk.title,
        category: chunk.category,
        tags: chunk.tags,
        content: chunk.content,
        score,
        language: chunk.language,
      });
    }
  }

  const top = scored.sort((a, b) => b.score - a.score).slice(0, topK);
  retrievalCache.set(cacheKey, { result: top, loadedAt: Date.now() });

  const categories = [...new Set(top.map((c) => c.category).filter(Boolean))] as string[];

  return {
    chunks: top,
    categories,
    searchSuccess: top.length > 0,
    usedFallback: top.length === 0,
    baselineCharEstimate,
  };
}

async function estimateFullKbChars(businessId: string): Promise<number> {
  const agg = await prisma.knowledgeChunk.aggregate({
    where: { businessId, isActive: true },
    _sum: { chunkIndex: true },
  });
  if (agg._sum.chunkIndex) return agg._sum.chunkIndex * 900;

  const docs = await prisma.knowledgeDocument.findMany({
    where: { status: 'INDEXED', knowledgeBase: { businessId, isActive: true } },
    select: { content: true },
    take: 100,
  });
  return docs.reduce((sum, d) => sum + (d.content?.length ?? 0), 0);
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return '';
  return chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.title ?? chunk.category ?? 'Knowledge'}\n${chunk.content}`)
    .join('\n\n');
}

export function invalidateRetrievalCache(businessId: string): void {
  for (const key of retrievalCache.keys()) {
    if (key.startsWith(`${businessId}:`)) retrievalCache.delete(key);
  }
}
