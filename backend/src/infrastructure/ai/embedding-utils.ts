export interface ParsedDocumentEmbedding {
  chunks?: Array<{ text?: string; embedding?: number[] | null } | string>;
  chunkCount?: number;
  vectorSearchEnabled?: boolean;
}

export function parseDocumentEmbedding(raw: string | null | undefined): ParsedDocumentEmbedding | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedDocumentEmbedding;
  } catch {
    return null;
  }
}

export function hasUsableDocumentEmbedding(raw: string | null | undefined): boolean {
  const parsed = parseDocumentEmbedding(raw);
  if (!parsed) return false;
  if (parsed.vectorSearchEnabled === false) return false;
  const chunks = parsed.chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) return false;
  return chunks.some((chunk) => {
    if (typeof chunk === 'string') return false;
    return Array.isArray(chunk?.embedding) && chunk.embedding.length > 0;
  });
}

export function countEmbeddedChunks(raw: string | null | undefined): number {
  const parsed = parseDocumentEmbedding(raw);
  if (!parsed?.chunks) return 0;
  return parsed.chunks.filter((chunk) => {
    if (typeof chunk === 'string') return false;
    return Array.isArray(chunk?.embedding) && chunk.embedding.length > 0;
  }).length;
}
