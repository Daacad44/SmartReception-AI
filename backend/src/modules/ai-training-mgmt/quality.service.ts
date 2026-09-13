import type { BusinessProfile } from '@prisma/client';
import {
  countEmbeddedChunks,
  hasUsableDocumentEmbedding,
} from '../../infrastructure/ai/embedding-utils';

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

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  value: number;
  detail: string;
}

export interface ReadinessBreakdown {
  status: 'healthy' | 'degraded' | 'critical';
  readinessScore: number;
  checks: ReadinessCheck[];
}

/**
 * Actual BusinessProfile columns. The previous list mixed non-existent names
 * (`description`, `contactEmail`, `pricing`, `faqs`, …) which capped
 * completeness around ~40% even for a fully filled profile.
 */
const PROFILE_FIELDS = [
  'businessName',
  'businessDescription',
  'mission',
  'vision',
  'workingHours',
  'languages',
  'brandTone',
  'website',
  'email',
  'phone',
  'supportEmail',
  'whatsapp',
  'address',
  'whyChooseUs',
  'targetAudience',
  'callToAction',
] as const;

function isFilled(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim() !== '';
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val as object).length > 0;
  return false;
}

export function calculateQualityScores(snapshot: TrainingSnapshot): QualityScores {
  const profile = snapshot.profile;
  const docs = snapshot.documents;
  const indexed = docs.filter((d) => d.status === 'INDEXED');
  const withEmbeddings = docs.filter((d) => hasUsableDocumentEmbedding(d.embedding));

  const profileFilled = profile
    ? PROFILE_FIELDS.filter((f) => isFilled(profile[f as keyof typeof profile])).length
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

  const embeddedChunkCount = docs.reduce((sum, d) => sum + countEmbeddedChunks(d.embedding), 0);
  const chunkDensity = embeddedChunkCount > 0 ? Math.min(100, embeddedChunkCount * 2) : 0;
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

export function describeReadiness(scores: QualityScores, snapshot: TrainingSnapshot): ReadinessBreakdown {
  const checks: ReadinessCheck[] = [
    {
      id: 'profile',
      label: 'Business profile completeness',
      passed: scores.knowledgeCompleteness >= 70,
      value: scores.knowledgeCompleteness,
      detail:
        scores.knowledgeCompleteness >= 70
          ? 'Core business profile fields are filled.'
          : 'Fill business description, contact details, hours, and policies so the AI has identity context.',
    },
    {
      id: 'documents',
      label: 'Indexed knowledge documents',
      passed: snapshot.indexedCount > 0,
      value: snapshot.indexedCount,
      detail:
        snapshot.indexedCount > 0
          ? `${snapshot.indexedCount} document(s) indexed.`
          : 'Upload and index at least one knowledge document.',
    },
    {
      id: 'embeddings',
      label: 'Vector embeddings',
      passed: scores.embeddingQuality >= 70,
      value: scores.embeddingQuality,
      detail:
        scores.embeddingQuality >= 70
          ? 'Documents have usable embeddings for retrieval.'
          : 'Embeddings are missing or incomplete. Re-index the knowledge base.',
    },
    {
      id: 'faqs',
      label: 'FAQs',
      passed: snapshot.faqCount > 0,
      value: snapshot.faqCount,
      detail:
        snapshot.faqCount > 0
          ? `${snapshot.faqCount} FAQ(s) available.`
          : 'Add frequently asked questions to improve answer coverage.',
    },
  ];

  const status: ReadinessBreakdown['status'] =
    scores.readinessScore >= 70 ? 'healthy' : scores.readinessScore >= 40 ? 'degraded' : 'critical';

  return { status, readinessScore: scores.readinessScore, checks };
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
