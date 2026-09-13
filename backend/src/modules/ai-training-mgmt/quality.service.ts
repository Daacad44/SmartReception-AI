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

/** Actual BusinessProfile columns used for completeness — must match Prisma. */
const PROFILE_FIELDS = [
  'businessName',
  'businessDescription',
  'companyOverview',
  'aboutUs',
  'mission',
  'vision',
  'workingHours',
  'languages',
  'brandTone',
  'email',
  'phone',
  'website',
  'address',
  'targetAudience',
  'whyChooseUs',
  'callToAction',
] as const;

export interface ReadinessGap {
  code: string;
  message: string;
}

function isProfileFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return String(value).trim() !== '';
}

function parseEmbeddingPayload(raw: string | null): {
  chunkCount: number;
  vectorCount: number;
  vectorSearchEnabled: boolean;
} {
  if (!raw) {
    return { chunkCount: 0, vectorCount: 0, vectorSearchEnabled: false };
  }
  try {
    const parsed = JSON.parse(raw) as {
      chunkCount?: number;
      chunks?: Array<{ embedding?: number[] | null }>;
      vectorSearchEnabled?: boolean;
    };
    const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
    const vectorCount = chunks.filter(
      (chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0
    ).length;
    return {
      chunkCount: parsed.chunkCount ?? chunks.length,
      vectorCount,
      vectorSearchEnabled: parsed.vectorSearchEnabled === true || vectorCount > 0,
    };
  } catch {
    return { chunkCount: 0, vectorCount: 0, vectorSearchEnabled: false };
  }
}

export function documentHasVectors(embedding: string | null): boolean {
  return parseEmbeddingPayload(embedding).vectorCount > 0;
}

export function calculateQualityScores(snapshot: TrainingSnapshot): QualityScores {
  const profile = snapshot.profile;
  const docs = snapshot.documents;
  const indexed = docs.filter((d) => d.status === 'INDEXED');
  const withEmbeddings = docs.filter((d) => documentHasVectors(d.embedding));

  const profileFilled = profile
    ? PROFILE_FIELDS.filter((f) => isProfileFieldFilled(profile[f as keyof typeof profile])).length
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

export function describeReadinessGaps(
  snapshot: TrainingSnapshot,
  scores: QualityScores
): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  const missingProfile = PROFILE_FIELDS.filter(
    (field) => !isProfileFieldFilled(snapshot.profile?.[field as keyof typeof snapshot.profile])
  );
  if (scores.knowledgeCompleteness < 70) {
    gaps.push({
      code: 'INCOMPLETE_PROFILE',
      message: `Business profile is ${scores.knowledgeCompleteness}% complete (${missingProfile.length} fields empty).`,
    });
  }
  if (snapshot.faqCount === 0 && !snapshot.documents.some((d) => d.type === 'FAQ')) {
    gaps.push({
      code: 'MISSING_FAQS',
      message: 'No FAQs are indexed. Add FAQs to raise answer coverage.',
    });
  }
  if (snapshot.indexedCount === 0) {
    gaps.push({
      code: 'NO_INDEXED_DOCUMENTS',
      message: 'No knowledge documents have finished indexing.',
    });
  }
  const missingVectors = snapshot.documents.filter((d) => !documentHasVectors(d.embedding));
  if (missingVectors.length > 0) {
    gaps.push({
      code: 'MISSING_EMBEDDINGS',
      message: `${missingVectors.length} document(s) have no usable vector embeddings.`,
    });
  }
  return gaps;
}

export function readinessStatus(score: number): 'healthy' | 'degraded' | 'critical' {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'degraded';
  return 'critical';
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
  const parsed = parseEmbeddingPayload(doc.embedding);
  return { ...doc, chunkCount: parsed.chunkCount };
}
