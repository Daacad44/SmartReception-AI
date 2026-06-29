import { config } from '../../../config';
import { prisma } from '../../database/prisma';
import { cosineSimilarity, backfillChunksFromLegacyDocuments } from './chunk-indexer.service';
import {
  getCachedEmbedding,
  getCachedRetrieval,
  setCachedEmbedding,
  setCachedRetrieval,
} from './retrieval-cache.service';
import { detectCustomerIntent } from './intent-detection.service';
import { boostChunksByCategory, rankAndDeduplicateChunks } from './knowledge-ranking.service';
import {
  computeGroundedConfidence,
  scoreToConfidence,
  validateKnowledgeChunks,
} from './knowledge-validator.service';
import { resolveEmbeddingProvider } from '../providers/provider-factory';
import type { EnterpriseRetrievalResult, ScoredChunk } from './types';
import type { RouteContext } from '../ai-intent-router.service';

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

async function getQueryEmbedding(businessId: string, query: string): Promise<number[] | null> {
  const cached = getCachedEmbedding(businessId, query);
  if (cached) return cached;

  const provider = resolveEmbeddingProvider();
  const result = await provider.embed({ texts: [query] });
  const embedding = result.embeddings[0];
  if (embedding) {
    setCachedEmbedding(businessId, query, embedding);
  }
  return embedding ?? null;
}

async function loadBusinessChunks(businessId: string) {
  let chunks = await prisma.knowledgeChunk.findMany({
    where: { businessId, isActive: true, status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      category: true,
      tags: true,
      content: true,
      embedding: true,
      priority: true,
      language: true,
      documentId: true,
      updatedAt: true,
      confidenceScore: true,
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    take: 300,
  });

  if (!chunks.length) {
    await backfillChunksFromLegacyDocuments(businessId);
    chunks = await prisma.knowledgeChunk.findMany({
      where: { businessId, isActive: true, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        content: true,
        embedding: true,
        priority: true,
        language: true,
        documentId: true,
        updatedAt: true,
        confidenceScore: true,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
    });
  }

  return chunks;
}

async function scoreChunks(
  businessId: string,
  query: string,
  categoryHints: string[]
): Promise<{ candidates: ScoredChunk[]; baselineCharEstimate: number }> {
  const chunks = await loadBusinessChunks(businessId);
  const baselineCharEstimate = chunks.reduce((sum, c) => sum + c.content.length, 0);

  if (!chunks.length) {
    return { candidates: [], baselineCharEstimate: 0 };
  }

  const queryEmbedding = await getQueryEmbedding(businessId, query);
  const candidates: ScoredChunk[] = [];

  for (const chunk of chunks) {
    const embedding = parseEmbedding(chunk.embedding);
    let score = keywordScore(query, chunk.content, chunk.tags) + chunk.priority * 0.02;

    if (queryEmbedding && embedding) {
      score += cosineSimilarity(queryEmbedding, embedding) * 0.85;
    }

    if (chunk.confidenceScore && chunk.confidenceScore > 0) {
      score += chunk.confidenceScore * 0.05;
    }

    const confidence = scoreToConfidence(score);
    candidates.push({
      id: chunk.id,
      title: chunk.title,
      category: chunk.category,
      tags: chunk.tags,
      content: chunk.content,
      score,
      confidence,
      language: chunk.language,
      documentId: chunk.documentId,
      priority: chunk.priority,
      updatedAt: chunk.updatedAt,
    });
  }

  const boosted = boostChunksByCategory(candidates, categoryHints);
  return { candidates: boosted, baselineCharEstimate };
}

async function recordChunkRetrieval(chunkIds: string[], scores: Map<string, number>): Promise<void> {
  if (!chunkIds.length) return;
  const now = new Date();
  await Promise.all(
    chunkIds.map((id) =>
      prisma.knowledgeChunk.update({
        where: { id },
        data: {
          usageCount: { increment: 1 },
          lastRetrievedAt: now,
          lastRetrievalScore: scores.get(id) ?? undefined,
        },
      })
    )
  );
}

export async function executeEnterpriseRetrieval(
  businessId: string,
  query: string,
  routeContext: RouteContext,
  options: { topK?: number; allowSecondary?: boolean } = {}
): Promise<EnterpriseRetrievalResult> {
  const retrievalStarted = Date.now();
  const topK = options.topK ?? config.ai.ragTopK;
  const intentResult = detectCustomerIntent(query, routeContext);

  if (intentResult.route === 'business_profile') {
    return {
      chunks: [],
      categories: ['profile'],
      intent: intentResult.intent,
      route: intentResult.route,
      searchSuccess: true,
      usedFallback: false,
      cacheHit: false,
      retrievalMs: Date.now() - retrievalStarted,
      validationMs: 0,
      rankingMs: 0,
      baselineCharEstimate: 0,
      maxScore: 0,
      avgScore: 0,
      groundedConfidence: intentResult.confidence,
      hallucinationRisk: 0.1,
      secondaryRetrievalUsed: false,
      knowledgeIds: [],
    };
  }

  const cached = getCachedRetrieval(businessId, query);
  if (cached?.length) {
    const { groundedConfidence, hallucinationRisk, maxScore, avgScore } =
      computeGroundedConfidence(cached);
    return {
      chunks: cached,
      categories: [...new Set(cached.map((c) => c.category).filter(Boolean))] as string[],
      intent: intentResult.intent,
      route: intentResult.route,
      searchSuccess: true,
      usedFallback: false,
      cacheHit: true,
      retrievalMs: Date.now() - retrievalStarted,
      validationMs: 0,
      rankingMs: 0,
      baselineCharEstimate: cached.reduce((s, c) => s + c.content.length, 0),
      maxScore,
      avgScore,
      groundedConfidence,
      hallucinationRisk,
      secondaryRetrievalUsed: false,
      knowledgeIds: cached.map((c) => c.id),
    };
  }

  let { candidates, baselineCharEstimate } = await scoreChunks(
    businessId,
    query,
    intentResult.categoryHints
  );

  let secondaryRetrievalUsed = false;
  if (
    options.allowSecondary !== false &&
    config.ai.ragSecondaryRetrieval &&
    candidates.filter((c) => c.score >= config.ai.ragMinScore).length < 2
  ) {
    const broader = await scoreChunks(businessId, `${query} ${intentResult.intent}`, []);
    const merged = new Map<string, ScoredChunk>();
    for (const c of [...candidates, ...broader.candidates]) {
      const existing = merged.get(c.id);
      if (!existing || c.score > existing.score) merged.set(c.id, c);
    }
    candidates = [...merged.values()];
    secondaryRetrievalUsed = true;
  }

  const { chunks: ranked, rankingMs } = rankAndDeduplicateChunks(candidates, topK + 2);
  const { chunks: validated, validationMs } = validateKnowledgeChunks(ranked);
  const finalChunks = validated.slice(0, topK);

  const { groundedConfidence, hallucinationRisk, maxScore, avgScore } =
    computeGroundedConfidence(finalChunks);

  if (finalChunks.length) {
    setCachedRetrieval(businessId, query, finalChunks);
    const scoreMap = new Map(finalChunks.map((c) => [c.id, c.score]));
    void recordChunkRetrieval(finalChunks.map((c) => c.id), scoreMap).catch(() => undefined);
  }

  const categories = [...new Set(finalChunks.map((c) => c.category).filter(Boolean))] as string[];

  return {
    chunks: finalChunks,
    categories,
    intent: intentResult.intent,
    route: intentResult.route,
    searchSuccess: finalChunks.length > 0 && maxScore >= config.ai.ragMinScore,
    usedFallback: finalChunks.length === 0,
    cacheHit: false,
    retrievalMs: Date.now() - retrievalStarted,
    validationMs,
    rankingMs,
    baselineCharEstimate,
    maxScore,
    avgScore,
    groundedConfidence,
    hallucinationRisk,
    secondaryRetrievalUsed,
    knowledgeIds: finalChunks.map((c) => c.id),
  };
}
