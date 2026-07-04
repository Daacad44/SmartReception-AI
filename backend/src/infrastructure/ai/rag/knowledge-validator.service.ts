import type { ScoredChunk, ConfidenceLevel } from './types';
import { config } from '../../../config';

export interface ValidationResult {
  chunks: ScoredChunk[];
  removedCount: number;
  validationMs: number;
}

export function validateKnowledgeChunks(
  chunks: ScoredChunk[],
  minScore = config.ai.ragMinScore
): ValidationResult {
  const started = Date.now();
  const validated: ScoredChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.score < minScore) continue;
    if (!chunk.content?.trim() || chunk.content.length < 10) continue;
    if (chunk.confidence === 'low' && chunk.score < minScore + 0.15) continue;
    validated.push(chunk);
  }

  return {
    chunks: validated,
    removedCount: chunks.length - validated.length,
    validationMs: Date.now() - started,
  };
}

export function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 0.65) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

export function computeGroundedConfidence(chunks: ScoredChunk[]): {
  groundedConfidence: number;
  hallucinationRisk: number;
  maxScore: number;
  avgScore: number;
} {
  if (!chunks.length) {
    return { groundedConfidence: 0, hallucinationRisk: 0.9, maxScore: 0, avgScore: 0 };
  }

  const scores = chunks.map((c) => c.score);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highCount = chunks.filter((c) => c.confidence === 'high').length;

  const groundedConfidence = Math.round(
    Math.min(0.98, maxScore * 0.5 + avgScore * 0.3 + (highCount / chunks.length) * 0.2) * 100
  ) / 100;

  const hallucinationRisk = Math.round((1 - groundedConfidence) * 100) / 100;

  return { groundedConfidence, hallucinationRisk, maxScore, avgScore };
}
