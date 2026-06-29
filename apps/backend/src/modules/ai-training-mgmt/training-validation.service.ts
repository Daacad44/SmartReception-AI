import { prisma } from '../../infrastructure/database/prisma';
import { searchVersionKnowledgeContext } from '../../infrastructure/ai/knowledge-search.service';
import { answerQuestion } from '../../infrastructure/ai/gemini.service';
import { logger } from '../../core/logger';

const SAMPLE_QUESTION_LIMIT = 5;

export interface TrainingValidationReport {
  passed: boolean;
  qualityScore: number;
  questionsTested: number;
  retrievalSuccessRate: number;
  answerQualityRate: number;
  isolationVerified: boolean;
  warnings: string[];
  errors: string[];
  samples: Array<{
    question: string;
    retrieved: boolean;
    answerLength: number;
    confidence: number;
  }>;
}

export class TrainingValidationService {
  async validateTrainingVersion(
    businessId: string,
    versionId: string
  ): Promise<TrainingValidationReport> {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId },
    });
    if (!version) {
      return {
        passed: false,
        qualityScore: 0,
        questionsTested: 0,
        retrievalSuccessRate: 0,
        answerQualityRate: 0,
        isolationVerified: false,
        warnings: [],
        errors: ['Version not found for business'],
        samples: [],
      };
    }

    const snapshot = version.snapshotData as {
      documents?: Array<{ id: string; title: string; type?: string; question?: string }>;
      faqCount?: number;
    } | null;

    const warnings: string[] = [];
    const errors: string[] = [];
    const samples: TrainingValidationReport['samples'] = [];

    const questions = this.buildSampleQuestions(snapshot?.documents ?? []);
    if (!questions.length) {
      warnings.push('No sample questions could be generated from knowledge base');
    }

    let retrievalHits = 0;
    let answerHits = 0;

    for (const question of questions.slice(0, SAMPLE_QUESTION_LIMIT)) {
      try {
        const context = await searchVersionKnowledgeContext(versionId, question);
        const retrieved = Boolean(context && context.length >= 20);
        if (retrieved) retrievalHits++;

        const answer = await answerQuestion(question, context || 'No knowledge available.');
        const answerOk = answer.length >= 20 && !/I don't know|ma haysto|lama helin/i.test(answer);
        if (answerOk) answerHits++;

        samples.push({
          question,
          retrieved,
          answerLength: answer.length,
          confidence: retrieved ? Math.min(0.95, 0.5 + (context?.length ?? 0) / 2000) : 0.25,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Validation sample failed';
        errors.push(msg);
        logger.warn('Training validation sample failed', { businessId, versionId, question, error: msg });
      }
    }

    const isolationVerified = await this.verifyBusinessIsolation(businessId);
    if (!isolationVerified) {
      errors.push('Business ID isolation check failed — cross-tenant chunks detected');
    }

    const questionsTested = Math.max(questions.slice(0, SAMPLE_QUESTION_LIMIT).length, 1);
    const retrievalSuccessRate = (retrievalHits / questionsTested) * 100;
    const answerQualityRate = (answerHits / questionsTested) * 100;
    const qualityScore = Math.round(
      retrievalSuccessRate * 0.45 + answerQualityRate * 0.35 + (isolationVerified ? 20 : 0)
    );

    const passed =
      isolationVerified &&
      retrievalSuccessRate >= 50 &&
      answerQualityRate >= 40 &&
      errors.length === 0 &&
      (version.readinessScore ?? 0) >= 30;

    if (!passed && !errors.length) {
      warnings.push('Quality thresholds not met — training requires review');
    }

    return {
      passed,
      qualityScore,
      questionsTested,
      retrievalSuccessRate,
      answerQualityRate,
      isolationVerified,
      warnings,
      errors,
      samples,
    };
  }

  private buildSampleQuestions(
    documents: Array<{ id: string; title: string; type?: string; question?: string }>
  ): string[] {
    const questions: string[] = [];
    for (const doc of documents) {
      if (doc.type === 'FAQ' && doc.question) {
        questions.push(doc.question);
      } else if (doc.title) {
        questions.push(`What do you know about ${doc.title}?`);
      }
    }
    if (!questions.length) {
      questions.push('What services do you offer?', 'What are your business hours?');
    }
    return [...new Set(questions)];
  }

  private async verifyBusinessIsolation(businessId: string): Promise<boolean> {
    const [chunkCount, foreignChunks] = await Promise.all([
      prisma.knowledgeChunk.count({ where: { businessId, isActive: true } }),
      prisma.knowledgeChunk.count({
        where: {
          isActive: true,
          businessId: { not: businessId },
          documentId: {
            in: (
              await prisma.knowledgeDocument.findMany({
                where: { knowledgeBase: { businessId } },
                select: { id: true },
              })
            ).map((d) => d.id),
          },
        },
      }),
    ]);

    if (foreignChunks > 0) return false;
    return chunkCount >= 0;
  }
}

export const trainingValidationService = new TrainingValidationService();
