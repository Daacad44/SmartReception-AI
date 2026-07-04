import { prisma } from '../../infrastructure/database/prisma';
import { searchVersionKnowledgeContext } from '../../infrastructure/ai/knowledge-search.service';
import { answerQuestion } from '../../infrastructure/ai/gemini.service';
import { logger } from '../../core/logger';
import { NO_KNOWLEDGE_REPLY, VALIDATION_THRESHOLD } from './ai-knowledge.constants';

const MAX_QUESTIONS = 50;

const VALIDATION_TEMPLATES = [
  'What is the company name?',
  'What services do you offer?',
  'What are your pricing details?',
  'What is your refund policy?',
  'What are your business hours?',
  'How can customers contact you?',
  'How do appointments work?',
  'What products do you sell?',
  'What are your FAQs?',
  'What are your terms and conditions?',
  'What are your business rules?',
  'What is your opening hours?',
];

export interface ValidationQuestionResult {
  question: string;
  expectedAnswer?: string;
  aiAnswer: string;
  retrieved: boolean;
  accuracy: number;
  confidence: number;
  hallucinationDetected: boolean;
  missingInformation: boolean;
  contextMatch: number;
  groundingScore: number;
  responseQuality: number;
}

export interface TrainingValidationReport {
  passed: boolean;
  qualityScore: number;
  validationScore: number;
  threshold: number;
  questionsTested: number;
  retrievalSuccessRate: number;
  answerQualityRate: number;
  accuracy: number;
  hallucinationRate: number;
  knowledgeCoverage: number;
  isolationVerified: boolean;
  readyForProduction: boolean;
  deploymentStatus: 'DEPLOYED' | 'VALIDATION_FAILED' | 'PENDING';
  warnings: string[];
  errors: string[];
  samples: Array<{
    question: string;
    retrieved: boolean;
    answerLength: number;
    confidence: number;
  }>;
  detailedResults: ValidationQuestionResult[];
  incorrectAnswers: ValidationQuestionResult[];
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
      return this.failedReport(['Version not found for business']);
    }

    const snapshot = version.snapshotData as {
      documents?: Array<{
        id: string;
        title: string;
        type?: string;
        question?: string;
        answer?: string;
        content?: string;
        category?: string;
      }>;
      faqCount?: number;
      profile?: { businessName?: string; services?: string[] };
    } | null;

    const warnings: string[] = [];
    const errors: string[] = [];
    const detailedResults: ValidationQuestionResult[] = [];

    const questions = this.buildValidationQuestions(snapshot?.documents ?? [], snapshot?.profile);
    if (!questions.length) {
      warnings.push('No validation questions could be generated from knowledge base');
    }

    let retrievalHits = 0;
    let answerHits = 0;
    let hallucinationCount = 0;

    const testQuestions = questions.slice(0, MAX_QUESTIONS);

    for (const { question, expectedAnswer } of testQuestions) {
      try {
        const context = await searchVersionKnowledgeContext(versionId, question);
        const retrieved = Boolean(context && context.length >= 20);
        if (retrieved) retrievalHits++;

        const missingKnowledge = !retrieved;
        let aiAnswer: string;

        if (missingKnowledge) {
          aiAnswer = NO_KNOWLEDGE_REPLY;
        } else {
          aiAnswer = await answerQuestion(question, context);
          if (this.detectHallucination(aiAnswer, context)) {
            hallucinationCount++;
          }
        }

        const accuracy = this.scoreAccuracy(aiAnswer, expectedAnswer, context);
        const confidence = retrieved ? Math.min(0.95, 0.5 + (context?.length ?? 0) / 2000) : 0.25;
        const hallucinationDetected =
          missingKnowledge && !aiAnswer.includes("don't have verified information");
        const groundingScore = retrieved ? Math.min(100, (context?.length ?? 0) / 30) : 0;
        const contextMatch = retrieved ? Math.min(100, retrievalHits * 10) : 0;
        const responseQuality = this.scoreResponseQuality(aiAnswer, retrieved);
        const answerOk = responseQuality >= 50 && !hallucinationDetected;

        if (answerOk) answerHits++;

        detailedResults.push({
          question,
          expectedAnswer,
          aiAnswer,
          retrieved,
          accuracy,
          confidence: Math.round(confidence * 100),
          hallucinationDetected,
          missingInformation: missingKnowledge,
          contextMatch,
          groundingScore: Math.round(groundingScore),
          responseQuality,
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

    const questionsTested = Math.max(testQuestions.length, 1);
    const retrievalSuccessRate = (retrievalHits / questionsTested) * 100;
    const answerQualityRate = (answerHits / questionsTested) * 100;
    const accuracy = answerQualityRate;
    const hallucinationRate = (hallucinationCount / questionsTested) * 100;
    const knowledgeCoverage = Math.min(100, (questions.length / MAX_QUESTIONS) * 100);

    const qualityScore = Math.round(
      retrievalSuccessRate * 0.25 +
        answerQualityRate * 0.35 +
        (100 - hallucinationRate) * 0.2 +
        knowledgeCoverage * 0.1 +
        (isolationVerified ? 10 : 0)
    );

    const validationScore = qualityScore;
    const passed =
      isolationVerified &&
      validationScore >= VALIDATION_THRESHOLD &&
      hallucinationRate < 30 &&
      errors.length === 0 &&
      (version.readinessScore ?? 0) >= 30;

    const incorrectAnswers = detailedResults.filter(
      (r) => r.accuracy < 50 || r.hallucinationDetected
    );

    if (!passed && !errors.length) {
      warnings.push('Quality thresholds not met — training requires review');
    }

    const samples = detailedResults.map((r) => ({
      question: r.question,
      retrieved: r.retrieved,
      answerLength: r.aiAnswer.length,
      confidence: r.confidence / 100,
    }));

    return {
      passed,
      qualityScore,
      validationScore,
      threshold: VALIDATION_THRESHOLD,
      questionsTested,
      retrievalSuccessRate,
      answerQualityRate,
      accuracy,
      hallucinationRate,
      knowledgeCoverage,
      isolationVerified,
      readyForProduction: passed,
      deploymentStatus: passed ? 'DEPLOYED' : 'VALIDATION_FAILED',
      warnings,
      errors,
      samples,
      detailedResults,
      incorrectAnswers,
    };
  }

  private buildValidationQuestions(
    documents: Array<{
      id: string;
      title: string;
      type?: string;
      question?: string;
      answer?: string;
      content?: string;
      category?: string;
    }>,
    profile?: { businessName?: string; services?: string[] }
  ): Array<{ question: string; expectedAnswer?: string }> {
    const questions: Array<{ question: string; expectedAnswer?: string }> = [];

    if (profile?.businessName) {
      questions.push({
        question: 'What is the company name?',
        expectedAnswer: profile.businessName,
      });
    }

    for (const doc of documents) {
      if (doc.type === 'FAQ' && doc.question) {
        questions.push({ question: doc.question, expectedAnswer: doc.answer });
      } else if (doc.title) {
        const category = doc.category?.toLowerCase() ?? '';
        if (category.includes('policy')) {
          questions.push({ question: `What is the ${doc.title} policy?`, expectedAnswer: doc.content });
        } else if (category.includes('pricing')) {
          questions.push({ question: `What are the pricing details for ${doc.title}?`, expectedAnswer: doc.content });
        } else if (category.includes('product')) {
          questions.push({ question: `Tell me about ${doc.title}`, expectedAnswer: doc.content });
        } else if (category.includes('service')) {
          questions.push({ question: `What services are listed in ${doc.title}?`, expectedAnswer: doc.content });
        } else {
          questions.push({ question: `What do you know about ${doc.title}?`, expectedAnswer: doc.content });
        }
      }
    }

    for (const template of VALIDATION_TEMPLATES) {
      if (!questions.some((q) => q.question === template)) {
        questions.push({ question: template });
      }
    }

    return questions;
  }

  private detectHallucination(answer: string, context: string): boolean {
    if (answer.includes("don't have verified information")) return false;
    const contextWords = new Set(context.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
    const answerWords = answer.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    if (!answerWords.length) return true;
    const overlap = answerWords.filter((w) => contextWords.has(w)).length;
    return overlap / answerWords.length < 0.15 && answer.length > 80;
  }

  private scoreAccuracy(answer: string, expected?: string, context?: string): number {
    if (answer.includes("don't have verified information")) {
      return expected ? 20 : 80;
    }
    if (expected) {
      const expectedWords = expected.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const answerLower = answer.toLowerCase();
      const matches = expectedWords.filter((w) => answerLower.includes(w)).length;
      return expectedWords.length > 0 ? Math.round((matches / expectedWords.length) * 100) : 50;
    }
    if (context && context.length > 20) return 70;
    return 40;
  }

  private scoreResponseQuality(answer: string, retrieved: boolean): number {
    if (!retrieved && answer.includes("don't have verified information")) return 90;
    if (!retrieved) return 20;
    if (answer.length < 10) return 30;
    if (answer.length > 500) return 60;
    return 75;
  }

  private failedReport(errors: string[]): TrainingValidationReport {
    return {
      passed: false,
      qualityScore: 0,
      validationScore: 0,
      threshold: VALIDATION_THRESHOLD,
      questionsTested: 0,
      retrievalSuccessRate: 0,
      answerQualityRate: 0,
      accuracy: 0,
      hallucinationRate: 100,
      knowledgeCoverage: 0,
      isolationVerified: false,
      readyForProduction: false,
      deploymentStatus: 'VALIDATION_FAILED',
      warnings: [],
      errors,
      samples: [],
      detailedResults: [],
      incorrectAnswers: [],
    };
  }

  private async verifyBusinessIsolation(businessId: string): Promise<boolean> {
    const foreignChunks = await prisma.knowledgeChunk.count({
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
    });
    return foreignChunks === 0;
  }
}

export const trainingValidationService = new TrainingValidationService();
