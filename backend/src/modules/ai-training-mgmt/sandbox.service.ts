import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { generateResponse } from '../../infrastructure/ai/gemini.service';
import { requestsEnglish } from '../../infrastructure/ai/somali-menu';
import { NotFoundError, ValidationError } from '../../core/errors';
import { recordAiTrainingAudit } from './audit.service';
import { knowledgeGapService } from './knowledge-gap.service';
import { VALIDATION_THRESHOLD } from './ai-knowledge.constants';

/**
 * Sandbox = the AI Validation Environment.
 *
 * Every sandbox turn runs the IDENTICAL production RAG pipeline
 * (`generateResponse`, sandbox mode) so a Super Admin sees exactly what a live
 * customer would after deployment: real knowledge retrieval, real appointment
 * availability, real grounded confidence, and the zero-hallucination handover
 * when the knowledge base has no answer. Analytics/usage recording is skipped in
 * sandbox mode so validation never pollutes live metrics.
 */
export class SandboxService {
  private readonly TESTABLE_STATUSES = ['SANDBOX', 'PENDING_APPROVAL', 'PRODUCTION', 'ARCHIVED'] as const;

  async createSession(
    businessId: string,
    versionId: string,
    opts: { trainerId?: string; userId?: string; label?: string }
  ) {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId, status: { in: [...this.TESTABLE_STATUSES] } },
    });
    if (!version) throw new NotFoundError('Sandbox version not found');

    return prisma.aiSandboxSession.create({
      data: {
        businessId,
        versionId,
        trainerId: opts.trainerId,
        userId: opts.userId,
        label: opts.label,
      },
    });
  }

  async listSessions(businessId: string, versionId?: string) {
    return prisma.aiSandboxSession.findMany({
      where: { businessId, ...(versionId ? { versionId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        version: { select: { versionNumber: true, status: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(businessId: string, sessionId: string) {
    const session = await prisma.aiSandboxSession.findFirst({
      where: { id: sessionId, businessId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        version: true,
      },
    });
    if (!session) throw new NotFoundError('Sandbox session not found');
    return session;
  }

  async sendMessage(
    businessId: string,
    sessionId: string,
    content: string,
    audit: { trainerId?: string; userId?: string }
  ) {
    const session = await this.getSession(businessId, sessionId);
    if (session.version.status !== 'SANDBOX' && session.version.status !== 'PENDING_APPROVAL') {
      throw new ValidationError('Sandbox testing is only available for sandbox versions');
    }

    await prisma.aiSandboxMessage.create({
      data: { sessionId, role: 'USER', content },
    });

    // Run the exact production pipeline in sandbox mode.
    const preferEnglish = requestsEnglish(content);
    const result = await generateResponse(businessId, `sandbox-${sessionId}`, content, {
      sandbox: true,
      preferEnglish,
    });
    const meta = result._meta;

    const missingKnowledge = meta?.missingKnowledge ?? result.confidence < 0.25;
    const groundedConfidence = meta?.groundedConfidence ?? result.confidence;
    const hallucinationRisk = meta?.hallucinationRisk ?? Math.max(0, 1 - result.confidence);

    const sources: Prisma.InputJsonValue = {
      route: meta?.route ?? 'knowledge_base',
      categories: meta?.categories ?? [],
      chunks: meta?.chunks ?? [],
      embeddingMatchScore: meta?.embeddingMatchScore ?? 0,
      avgScore: meta?.avgScore ?? 0,
      knowledgeChars: meta?.knowledgeChars ?? 0,
      promptChars: meta?.promptChars ?? 0,
    };

    const assistantMessage = await prisma.aiSandboxMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: result.content,
        confidence: result.confidence,
        groundedConfidence,
        hallucinationRisk,
        missingKnowledge,
        intent: meta?.intent ?? result.intent,
        route: meta?.route,
        modelUsed: meta?.model,
        provider: meta?.provider,
        retrievedChunkCount: meta?.retrievedChunkCount ?? 0,
        embeddingMatchScore: meta?.embeddingMatchScore,
        latencyMs: meta?.latencyMs,
        sources,
      },
    });

    // Zero-hallucination: an unanswered question opens a knowledge-gap /
    // human-handover record so Super Admin can train the missing knowledge.
    if (missingKnowledge) {
      await knowledgeGapService
        .record({
          businessId,
          versionId: session.versionId,
          sessionId,
          question: content,
          category: meta?.categories?.[0] ?? null,
          intent: meta?.intent ?? result.intent ?? null,
          groundedConfidence,
          hallucinationRisk,
          source: 'SANDBOX',
        })
        .catch(() => undefined);
    }

    await recordAiTrainingAudit(
      { businessId, versionId: session.versionId, ...audit },
      'SANDBOX_TEST',
      { entity: 'AiSandboxSession', entityId: sessionId }
    );

    return assistantMessage;
  }

  async getTestReport(businessId: string, sessionId: string) {
    const session = await this.getSession(businessId, sessionId);
    const assistantMessages = session.messages.filter((m) => m.role === 'ASSISTANT');
    const count = assistantMessages.length;

    const avg = (pick: (m: (typeof assistantMessages)[number]) => number | null | undefined) =>
      count > 0 ? assistantMessages.reduce((sum, m) => sum + (pick(m) ?? 0), 0) / count : 0;

    const avgConfidence = avg((m) => m.confidence);
    const avgGrounded = avg((m) => m.groundedConfidence);
    const avgHallucinationRisk = avg((m) => m.hallucinationRisk);
    const avgLatency = avg((m) => m.latencyMs);
    const unknownCount = assistantMessages.filter((m) => m.missingKnowledge).length;
    const answeredCount = count - unknownCount;
    const knowledgeCoverage = count > 0 ? Math.round((answeredCount / count) * 100) : 0;
    const hallucinationCount = assistantMessages.filter(
      (m) => !m.missingKnowledge && (m.hallucinationRisk ?? 0) > 0.5
    ).length;

    const passed =
      count > 0 &&
      avgGrounded * 100 >= VALIDATION_THRESHOLD &&
      unknownCount <= Math.ceil(count * 0.3) &&
      hallucinationCount === 0;

    const recommendedImprovements: string[] = [];
    if (unknownCount > 0) {
      recommendedImprovements.push(
        `${unknownCount} question(s) had no grounded answer — review the Knowledge Gaps report and retrain.`
      );
    }
    if (avgGrounded * 100 < VALIDATION_THRESHOLD) {
      recommendedImprovements.push(
        `Average grounded confidence (${Math.round(avgGrounded * 100)}%) is below the ${VALIDATION_THRESHOLD}% threshold — add more relevant knowledge.`
      );
    }
    if (hallucinationCount > 0) {
      recommendedImprovements.push(
        `${hallucinationCount} answer(s) showed elevated hallucination risk — verify grounding for these responses.`
      );
    }
    if (count === 0) {
      recommendedImprovements.push('No test questions have been run yet — run the standard test suite.');
    }

    return {
      sessionId,
      versionId: session.versionId,
      versionNumber: session.version.versionNumber,
      questionsTested: count,
      correctAnswers: answeredCount,
      unknownQuestions: unknownCount,
      messageCount: session.messages.length,
      knowledgeCoverage,
      avgConfidence: Math.round(avgConfidence * 100),
      avgGroundedConfidence: Math.round(avgGrounded * 100),
      avgHallucinationRisk: Math.round(avgHallucinationRisk * 100),
      hallucinationCount,
      avgLatencyMs: Math.round(avgLatency),
      failedTests: unknownCount + hallucinationCount,
      recommendedImprovements,
      passed,
    };
  }

  /**
   * AI Readiness Checklist (Phase 5). Each item is derived from real platform
   * state — never a placeholder — and reported as COMPLETE / PENDING / FAILED.
   */
  async getReadinessChecklist(businessId: string, versionId?: string) {
    const [profile, docAgg, indexedCount, chunkAgg, embeddedChunks, workspace, sandboxAgg, deployment] =
      await Promise.all([
        prisma.businessProfile.findUnique({ where: { businessId } }),
        prisma.knowledgeDocument.count({ where: { knowledgeBase: { businessId } } }),
        prisma.knowledgeDocument.count({
          where: { status: 'INDEXED', knowledgeBase: { businessId } },
        }),
        prisma.knowledgeChunk.count({ where: { businessId, isActive: true, status: 'ACTIVE' } }),
        prisma.knowledgeChunk.count({
          where: { businessId, isActive: true, status: 'ACTIVE', NOT: { embedding: { equals: Prisma.DbNull } } },
        }),
        prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }),
        prisma.aiSandboxSession.aggregate({
          where: { businessId },
          _count: { _all: true },
        }),
        prisma.aiDeploymentRequest.findFirst({
          where: { businessId, status: { in: ['APPROVED', 'DEPLOYED'] } },
          orderBy: { requestedAt: 'desc' },
        }),
      ]);

    const sandboxMessageCount = await prisma.aiSandboxMessage.count({
      where: { session: { businessId }, role: 'ASSISTANT' },
    });

    const version = versionId
      ? await prisma.aiTrainingVersion.findFirst({ where: { id: versionId, businessId } })
      : workspace?.sandboxVersionId
        ? await prisma.aiTrainingVersion.findUnique({ where: { id: workspace.sandboxVersionId } })
        : null;

    const profileFilled =
      profile != null &&
      [
        profile.businessName,
        profile.businessDescription,
        profile.companyOverview,
        profile.workingHours,
      ].filter((v) => v != null && String(v).trim() !== '').length >= 2;

    const readiness = version?.readinessScore ?? workspace?.aiReadinessScore ?? null;
    const evaluationPassed = readiness != null && readiness >= VALIDATION_THRESHOLD;

    type State = 'COMPLETE' | 'PENDING' | 'FAILED';
    const item = (key: string, label: string, state: State, detail: string) => ({
      key,
      label,
      state,
      detail,
    });
    const boolState = (ok: boolean): State => (ok ? 'COMPLETE' : 'PENDING');

    const items = [
      item('business_profile', 'Business Profile', boolState(profileFilled),
        profileFilled ? 'Core business details captured' : 'Complete the business profile'),
      item('knowledge_uploaded', 'Knowledge Uploaded', boolState(docAgg > 0),
        `${docAgg} document(s) uploaded`),
      item('knowledge_approved', 'Knowledge Approved', boolState(indexedCount > 0),
        `${indexedCount} document(s) indexed & approved`),
      item('training_completed', 'Training Completed', boolState(Boolean(workspace?.lastTrainedAt)),
        workspace?.lastTrainedAt ? `Last trained ${workspace.lastTrainedAt.toISOString()}` : 'Run training'),
      item('embeddings_generated', 'Embeddings Generated', boolState(embeddedChunks > 0),
        `${embeddedChunks} chunk embedding(s) generated`),
      item('knowledge_indexed', 'Knowledge Indexed', boolState(chunkAgg > 0),
        `${chunkAgg} active knowledge chunk(s)`),
      item('sandbox_tested', 'Sandbox Tested', boolState(sandboxMessageCount > 0),
        `${sandboxMessageCount} sandbox response(s) recorded`),
      item(
        'evaluation_passed',
        'AI Evaluation Passed',
        readiness == null ? 'PENDING' : evaluationPassed ? 'COMPLETE' : 'FAILED',
        readiness == null ? 'Not evaluated yet' : `Readiness ${Math.round(readiness)}% (threshold ${VALIDATION_THRESHOLD}%)`
      ),
      item('human_review', 'Human Review Passed', boolState(Boolean(deployment)),
        deployment ? 'Reviewed by Super Admin' : 'Awaiting Super Admin review'),
      item(
        'deployment_approved',
        'Deployment Approved',
        boolState(Boolean(deployment)),
        deployment ? `Deployment ${deployment.status}` : 'Not yet approved'
      ),
    ];

    const completed = items.filter((i) => i.state === 'COMPLETE').length;
    const failed = items.filter((i) => i.state === 'FAILED').length;

    return {
      businessId,
      versionId: version?.id ?? null,
      items,
      completed,
      total: items.length,
      failed,
      progress: Math.round((completed / items.length) * 100),
    };
  }
}

export const sandboxService = new SandboxService();
