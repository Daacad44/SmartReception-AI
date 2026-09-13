import { prisma } from '../../infrastructure/database/prisma';
import { businessProfileService } from '../business-profile/business-profile.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import {
  buildSnapshotDocument,
  calculateQualityScores,
  describeReadinessGaps,
  documentHasVectors,
  readinessStatus,
  type QualityScores,
  type ReadinessGap,
  type TrainingSnapshot,
} from './quality.service';

export interface LiveReadiness {
  snapshot: TrainingSnapshot;
  scores: QualityScores;
  gaps: ReadinessGap[];
  status: ReturnType<typeof readinessStatus>;
  indexedCount: number;
  embeddingCount: number;
  documentCount: number;
  faqCount: number;
}

export async function evaluateLiveReadiness(businessId: string): Promise<LiveReadiness> {
  const profile = await businessProfileService.get(businessId);
  const bases = await knowledgeService.listBases(businessId);
  const baseId = bases[0]?.id;
  const documents = baseId
    ? await prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId: baseId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          content: true,
          question: true,
          answer: true,
          embedding: true,
        },
      })
    : [];

  const snapshotDocs = documents.map(buildSnapshotDocument);
  const faqCount = documents.filter((d) => d.type === 'FAQ').length;
  const indexedCount = documents.filter((d) => d.status === 'INDEXED').length;
  const embeddingCount = documents.filter((d) => documentHasVectors(d.embedding)).length;
  const totalChunks = snapshotDocs.reduce((sum, d) => sum + d.chunkCount, 0);

  const snapshot: TrainingSnapshot = {
    profile,
    documents: snapshotDocs,
    faqCount,
    indexedCount,
    embeddingCount,
    totalChunks,
    capturedAt: new Date().toISOString(),
  };

  const scores = calculateQualityScores(snapshot);
  const gaps = describeReadinessGaps(snapshot, scores);

  return {
    snapshot,
    scores,
    gaps,
    status: readinessStatus(scores.readinessScore),
    indexedCount,
    embeddingCount,
    documentCount: documents.length,
    faqCount,
  };
}
