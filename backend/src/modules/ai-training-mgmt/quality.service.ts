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
  updatedAt?: string;
}

export interface TrainingSnapshot {
  profile: Partial<BusinessProfile> | null;
  documents: TrainingSnapshotDocument[];
  faqCount: number;
  indexedCount: number;
  embeddingCount: number;
  totalChunks: number;
  serviceCount?: number;
  productCount?: number;
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
  contentQuality: number;
}

export interface ReadinessAssessment {
  scores: QualityScores;
  checks: Array<{ key: string; label: string; score: number; complete: boolean }>;
  gaps: string[];
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function profileChecks(profile: Partial<BusinessProfile> | null) {
  const p = profile ?? {};
  return [
    ['identity', 'Business identity', hasValue(p.businessName)],
    ['description', 'Business description', hasValue(p.businessDescription) || hasValue(p.companyOverview) || hasValue(p.aboutUs)],
    ['category', 'Industry and category', hasValue(p.businessCategory) || hasValue(p.industryLabel)],
    ['audience', 'Target audience', hasValue(p.targetAudience)],
    ['hours', 'Working hours', hasValue(p.workingHours)],
    ['languages', 'Supported languages', hasValue(p.languages)],
    ['tone', 'Brand tone', hasValue(p.brandTone)],
    ['contact', 'Customer contact', hasValue(p.email) || hasValue(p.supportEmail) || hasValue(p.phone) || hasValue(p.whatsapp)],
    ['location', 'Business location', hasValue(p.address) || hasValue(p.city) || hasValue(p.country)],
    ['trust', 'Business value proposition', hasValue(p.whyChooseUs) || hasValue(p.callToAction) || hasValue(p.companyIntroduction)],
  ] as const;
}

export function calculateQualityScores(snapshot: TrainingSnapshot): QualityScores {
  const profile = snapshot.profile;
  const docs = snapshot.documents;
  const indexed = docs.filter((d) => d.status === 'INDEXED');
  const withEmbeddings = docs.filter((d) => d.embedding);

  const completedProfileChecks = profileChecks(profile).filter(([, , complete]) => complete).length;
  const knowledgeCompleteness = Math.round((completedProfileChecks / profileChecks(profile).length) * 100);

  const hasFaqs = snapshot.faqCount > 0 || docs.some((d) => d.type === 'FAQ');
  const hasDocs = indexed.length > 0;
  const hasServices = (snapshot.serviceCount ?? 0) > 0;
  const hasProducts = (snapshot.productCount ?? 0) > 0;
  const indexedRatio = docs.length > 0 ? indexed.length / docs.length : 0;
  const knowledgeCoverage = Math.round(Math.min(
    100,
    (hasFaqs ? 20 : 0) +
      (hasDocs ? 25 : 0) +
      (hasServices || hasProducts ? 25 : 0) +
      knowledgeCompleteness * 0.2 +
      indexedRatio * 10
  ));

  const embeddingQuality =
    docs.length > 0 ? Math.round((withEmbeddings.length / docs.length) * 100) : 0;

  const meaningfulDocuments = docs.filter((doc) => {
    const body = doc.type === 'FAQ'
      ? `${doc.question ?? ''} ${doc.answer ?? ''}`
      : doc.content ?? '';
    return body.trim().length >= 60;
  }).length;
  const contentQuality = docs.length > 0
    ? Math.round((meaningfulDocuments / docs.length) * 100)
    : 0;

  const capturedAt = new Date(snapshot.capturedAt).getTime();
  const oldestDocumentAt = docs
    .map((doc) => doc.updatedAt ? new Date(doc.updatedAt).getTime() : capturedAt)
    .filter(Number.isFinite)
    .reduce((oldest, current) => Math.min(oldest, current), capturedAt);
  const ageDays = Math.max(0, Math.floor((capturedAt - oldestDocumentAt) / 86_400_000));
  const knowledgeFreshness = ageDays <= 180
    ? 100
    : Math.max(0, Math.round(100 - ((ageDays - 180) / 185) * 100));

  const knowledgeScore = Math.round(
    knowledgeCompleteness * 0.3 + knowledgeCoverage * 0.3 + embeddingQuality * 0.25 + contentQuality * 0.15
  );

  const confidenceScore = Math.round(
    embeddingQuality * 0.35 + knowledgeCoverage * 0.3 + contentQuality * 0.2 + (hasFaqs ? 15 : 0)
  );

  const hallucinationRisk = Math.max(0, Math.min(100,
    Math.round(100 - (confidenceScore * 0.7 + knowledgeCompleteness * 0.3))
  ));

  const readinessScore = Math.round(
    knowledgeScore * 0.4 +
      confidenceScore * 0.3 +
      knowledgeFreshness * 0.1 +
      (100 - hallucinationRisk) * 0.2
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
    contentQuality,
  };
}

export function assessTrainingSnapshot(snapshot: TrainingSnapshot): ReadinessAssessment {
  const scores = calculateQualityScores(snapshot);
  const checks = [
    { key: 'profile', label: 'Business profile completeness', score: scores.knowledgeCompleteness, complete: scores.knowledgeCompleteness === 100 },
    { key: 'coverage', label: 'Knowledge coverage', score: scores.knowledgeCoverage, complete: scores.knowledgeCoverage === 100 },
    { key: 'content', label: 'Document content quality', score: scores.contentQuality, complete: scores.contentQuality === 100 },
    { key: 'embeddings', label: 'Embedding coverage', score: scores.embeddingQuality, complete: scores.embeddingQuality === 100 },
    { key: 'freshness', label: 'Knowledge freshness', score: scores.knowledgeFreshness, complete: scores.knowledgeFreshness === 100 },
  ];
  const gaps = [
    ...profileChecks(snapshot.profile)
      .filter(([, , complete]) => !complete)
      .map(([, label]) => `Complete ${label.toLowerCase()} in Business Information`),
    ...(!snapshot.documents.length ? ['Upload at least one approved business document'] : []),
    ...(snapshot.indexedCount < snapshot.documents.length ? ['Finish indexing every uploaded document'] : []),
    ...(snapshot.faqCount === 0 ? ['Add approved frequently asked questions and answers'] : []),
    ...(!(snapshot.serviceCount || snapshot.productCount) ? ['Add at least one service or product'] : []),
    ...(scores.contentQuality < 100 ? ['Expand short or empty documents with verified business facts'] : []),
    ...(scores.embeddingQuality < 100 ? ['Generate embeddings for every approved document'] : []),
    ...(scores.knowledgeFreshness < 100 ? ['Review and refresh knowledge older than six months'] : []),
  ];
  return { scores, checks, gaps: [...new Set(gaps)] };
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
  updatedAt?: Date | string;
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
  return {
    ...doc,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    chunkCount,
  };
}
