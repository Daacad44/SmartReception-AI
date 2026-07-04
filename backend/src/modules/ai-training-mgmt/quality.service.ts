import type { BusinessProfile } from '@prisma/client';

export interface TrainingSnapshotDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  content: string | null;
  question: string | null;
  answer: string | null;
  embedding: string | null;
  chunkCount: number;
}

export interface TrainingSnapshot {
  profile: Partial<BusinessProfile> | null;
  documents: TrainingSnapshotDocument[];
  faqCount: number;
  indexedCount: number;
  embeddingCount: number;
  totalChunks: number;
  capturedAt: string;
}

export interface QualityScores {
  knowledgeScore: number;
  confidenceScore: number;
  readinessScore: number;
  hallucinationRisk: number;
  knowledgeCompleteness: number;
  knowledgeCoverage: number;
  embeddingQuality: number;
  knowledgeFreshness: number;
}

const PROFILE_FIELDS = [
  'businessName',
  'description',
  'mission',
  'vision',
  'products',
  'services',
  'pricing',
  'workingHours',
  'languages',
  'supportPolicy',
  'refundPolicy',
  'cancellationPolicy',
  'faqs',
  'contactEmail',
  'contactPhone',
  'website',
  'brandTone',
] as const;

export function calculateQualityScores(snapshot: TrainingSnapshot): QualityScores {
  const profile = snapshot.profile;
  const docs = snapshot.documents;
  const indexed = docs.filter((d) => d.status === 'INDEXED');
  const withEmbeddings = docs.filter((d) => d.embedding);

  const profileFilled = profile
    ? PROFILE_FIELDS.filter((f) => {
        const val = profile[f as keyof typeof profile];
        return val !== null && val !== undefined && String(val).trim() !== '';
      }).length
    : 0;
  const knowledgeCompleteness = profile
    ? Math.round((profileFilled / PROFILE_FIELDS.length) * 100)
    : 0;

  const hasFaqs = snapshot.faqCount > 0 || docs.some((d) => d.type === 'FAQ');
  const hasDocs = indexed.length > 0;
  const knowledgeCoverage = Math.min(
    100,
    (hasFaqs ? 35 : 0) + (hasDocs ? 45 : 0) + Math.min(20, indexed.length * 4)
  );

  const embeddingQuality =
    docs.length > 0 ? Math.round((withEmbeddings.length / docs.length) * 100) : 0;

  const daysSinceCapture = 0;
  const knowledgeFreshness = Math.max(0, 100 - daysSinceCapture * 2);

  const chunkDensity = snapshot.totalChunks > 0 ? Math.min(100, snapshot.totalChunks * 2) : 0;
  const knowledgeScore = Math.round(
    knowledgeCompleteness * 0.35 + knowledgeCoverage * 0.35 + embeddingQuality * 0.2 + chunkDensity * 0.1
  );

  const confidenceScore = Math.round(
    embeddingQuality * 0.4 + knowledgeCoverage * 0.35 + (hasFaqs ? 15 : 0) + (profileFilled > 8 ? 10 : 0)
  );

  const hallucinationRisk = Math.max(
    0,
    Math.min(100, 100 - confidenceScore + (knowledgeCoverage < 40 ? 20 : 0))
  );

  const readinessScore = Math.round(
    knowledgeScore * 0.35 +
      confidenceScore * 0.35 +
      knowledgeFreshness * 0.15 +
      (100 - hallucinationRisk) * 0.15
  );

  return {
    knowledgeScore,
    confidenceScore,
    readinessScore,
    hallucinationRisk,
    knowledgeCompleteness,
    knowledgeCoverage,
    embeddingQuality,
    knowledgeFreshness,
  };
}

export function buildSnapshotDocument(doc: {
  id: string;
  title: string;
  type: string;
  status: string;
  content: string | null;
  question: string | null;
  answer: string | null;
  embedding: string | null;
}): TrainingSnapshotDocument {
  let chunkCount = 0;
  if (doc.embedding) {
    try {
      const parsed = JSON.parse(doc.embedding) as { chunkCount?: number; chunks?: unknown[] };
      chunkCount = parsed.chunkCount ?? parsed.chunks?.length ?? 0;
    } catch {
      chunkCount = 0;
    }
  }
  return { ...doc, chunkCount };
}
