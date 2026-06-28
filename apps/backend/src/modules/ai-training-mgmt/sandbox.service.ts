import { prisma } from '../../infrastructure/database/prisma';
import { answerQuestion } from '../../infrastructure/ai/gemini.service';
import { searchVersionKnowledgeContext } from '../../infrastructure/ai/knowledge-search.service';
import { NotFoundError, ValidationError } from '../../core/errors';
import { recordAiTrainingAudit } from './audit.service';

export class SandboxService {
  async createSession(
    businessId: string,
    versionId: string,
    opts: { trainerId?: string; userId?: string; label?: string }
  ) {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId, status: { in: ['SANDBOX', 'PENDING_APPROVAL', 'PRODUCTION', 'ARCHIVED'] } },
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

    const knowledgeContext = await searchVersionKnowledgeContext(session.versionId, content);
    const missingKnowledge = !knowledgeContext || knowledgeContext.length < 20;

    const reply = await answerQuestion(content, knowledgeContext || 'No knowledge available.');

    const confidence = knowledgeContext ? Math.min(0.95, 0.5 + knowledgeContext.length / 2000) : 0.25;
    const hallucinationRisk = missingKnowledge ? 0.65 : Math.max(0, 1 - confidence);

    const assistantMessage = await prisma.aiSandboxMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: reply,
        confidence,
        hallucinationRisk,
        missingKnowledge,
        sources: knowledgeContext ? { excerpt: knowledgeContext.slice(0, 500) } : undefined,
      },
    });

    await recordAiTrainingAudit(
      { businessId, versionId: session.versionId, ...audit },
      'SANDBOX_TEST',
      { entity: 'AiSandboxSession', entityId: sessionId }
    );

    return assistantMessage;
  }

  async getTestReport(businessId: string, sessionId: string) {
    const session = await this.getSession(businessId, sessionId);
    const messages = session.messages.filter((m: { role: string }) => m.role === 'ASSISTANT');

    const avgConfidence =
      messages.length > 0
        ? messages.reduce((sum: number, m: { confidence?: number | null }) => sum + (m.confidence ?? 0), 0) / messages.length
        : 0;
    const avgHallucinationRisk =
      messages.length > 0
        ? messages.reduce((sum: number, m: { hallucinationRisk?: number | null }) => sum + (m.hallucinationRisk ?? 0), 0) / messages.length
        : 0;
    const missingKnowledgeCount = messages.filter((m: { missingKnowledge?: boolean }) => m.missingKnowledge).length;

    return {
      sessionId,
      versionId: session.versionId,
      versionNumber: session.version.versionNumber,
      messageCount: session.messages.length,
      avgConfidence: Math.round(avgConfidence * 100),
      avgHallucinationRisk: Math.round(avgHallucinationRisk * 100),
      missingKnowledgeCount,
      passed: avgConfidence >= 0.6 && missingKnowledgeCount <= Math.ceil(messages.length * 0.3),
    };
  }
}

export const sandboxService = new SandboxService();
