import type { ScoredChunk } from './types';

interface CacheEntry<T> {
  value: T;
  loadedAt: number;
}

const retrievalCache = new Map<string, CacheEntry<ScoredChunk[]>>();
const embeddingCache = new Map<string, CacheEntry<number[]>>();

const RETRIEVAL_TTL_MS = 30_000;
const EMBEDDING_TTL_MS = 300_000;

export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function getCachedRetrieval(businessId: string, query: string): ScoredChunk[] | null {
  const key = `${businessId}:${normalizeQuery(query)}`;
  const entry = retrievalCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.loadedAt > RETRIEVAL_TTL_MS) {
    retrievalCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedRetrieval(businessId: string, query: string, chunks: ScoredChunk[]): void {
  const key = `${businessId}:${normalizeQuery(query)}`;
  retrievalCache.set(key, { value: chunks, loadedAt: Date.now() });
}

export function getCachedEmbedding(businessId: string, query: string): number[] | null {
  const key = `${businessId}:${normalizeQuery(query)}`;
  const entry = embeddingCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.loadedAt > EMBEDDING_TTL_MS) {
    embeddingCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedEmbedding(businessId: string, query: string, embedding: number[]): void {
  const key = `${businessId}:${normalizeQuery(query)}`;
  embeddingCache.set(key, { value: embedding, loadedAt: Date.now() });
}

export function invalidateRagCaches(businessId: string): void {
  for (const key of retrievalCache.keys()) {
    if (key.startsWith(`${businessId}:`)) retrievalCache.delete(key);
  }
  for (const key of embeddingCache.keys()) {
    if (key.startsWith(`${businessId}:`)) embeddingCache.delete(key);
  }
}
