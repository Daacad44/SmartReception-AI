import type { ScoredChunk } from './types';

function contentFingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Rank chunks by score, apply MMR-style diversity, remove near-duplicates.
 */
export function rankAndDeduplicateChunks(
  candidates: ScoredChunk[],
  topK: number
): { chunks: ScoredChunk[]; rankingMs: number } {
  const started = Date.now();
  if (!candidates.length) return { chunks: [], rankingMs: 0 };

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aTime = a.updatedAt?.getTime() ?? 0;
    const bTime = b.updatedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const selected: ScoredChunk[] = [];
  const seen = new Set<string>();

  for (const chunk of sorted) {
    const fp = contentFingerprint(chunk.content);
    if (seen.has(fp)) continue;

    const isDuplicate = selected.some(
      (s) => jaccardSimilarity(contentFingerprint(s.content), fp) > 0.85
    );
    if (isDuplicate) continue;

    selected.push(chunk);
    seen.add(fp);

    if (selected.length >= topK) break;
  }

  return { chunks: selected, rankingMs: Date.now() - started };
}

export function boostChunksByCategory(
  chunks: ScoredChunk[],
  categoryHints: string[]
): ScoredChunk[] {
  if (!categoryHints.length) return chunks;

  return chunks.map((chunk) => {
    const category = (chunk.category ?? '').toLowerCase();
    const tagMatch = chunk.tags.some((t) =>
      categoryHints.some((h) => t.toLowerCase().includes(h.toLowerCase()))
    );
    const catMatch = categoryHints.some((h) => category.includes(h.toLowerCase()));
    const boost = tagMatch || catMatch ? 0.12 : 0;
    return { ...chunk, score: Math.min(1, chunk.score + boost) };
  });
}
