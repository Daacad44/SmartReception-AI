/**
 * Legacy retrieval facade — delegates to enterprise retrieval engine.
 */
import { executeEnterpriseRetrieval } from './enterprise-retrieval.service';
import { mapScoredToLegacy } from './prompt-builder.service';
import { invalidateRagCaches } from './retrieval-cache.service';
import type { ScoredChunk } from './types';

export type RetrievedChunk = {
  id: string;
  title: string | null;
  category: string | null;
  tags: string[];
  content: string;
  score: number;
  language: string;
};

export interface RagRetrievalResult {
  chunks: RetrievedChunk[];
  categories: string[];
  searchSuccess: boolean;
  usedFallback: boolean;
  baselineCharEstimate: number;
}

export async function retrieveRelevantChunks(
  businessId: string,
  query: string,
  topK?: number
): Promise<RagRetrievalResult> {
  const result = await executeEnterpriseRetrieval(
    businessId,
    query,
    { isFirstCustomerMessage: false },
    { topK }
  );

  return {
    chunks: mapScoredToLegacy(result.chunks),
    categories: result.categories,
    searchSuccess: result.searchSuccess,
    usedFallback: result.usedFallback,
    baselineCharEstimate: result.baselineCharEstimate,
  };
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return '';
  return chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.title ?? chunk.category ?? 'Knowledge'}\n${chunk.content}`)
    .join('\n\n');
}

export function invalidateRetrievalCache(businessId: string): void {
  invalidateRagCaches(businessId);
}

export type { ScoredChunk };
