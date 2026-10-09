import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';

interface Gate { key: string; category: string; passed: boolean; critical: boolean; reason: string }
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function evaluateReleaseSnapshot(snapshot: Record<string, unknown>, approvedKnowledge: number): Gate[] {
  const draft = (snapshot.draft ?? {}) as Record<string, unknown>;
  const instructions = (draft.instructions ?? {}) as Record<string, unknown>;
  const escalation = (draft.escalationPolicy ?? {}) as Record<string, unknown>;
  const skills = Array.isArray(snapshot.skills) ? snapshot.skills as Array<Record<string, unknown>> : [];
  const boundaries = Array.isArray(instructions.boundaries) ? instructions.boundaries : [];
  return [
    { key: 'approved_knowledge', category: 'GROUNDING', passed: approvedKnowledge > 0, critical: true, reason: approvedKnowledge > 0 ? `${approvedKnowledge} approved sources` : 'No approved knowledge source' },
    { key: 'anti_invention_boundaries', category: 'HALLUCINATION', passed: boundaries.length > 0, critical: true, reason: boundaries.length > 0 ? 'Explicit answer boundaries present' : 'No explicit anti-invention boundaries' },
    { key: 'missing_knowledge_handover', category: 'ESCALATION', passed: escalation.handoverOnMissingKnowledge === true, critical: true, reason: escalation.handoverOnMissingKnowledge === true ? 'Missing knowledge triggers handover' : 'Missing-knowledge handover is disabled' },
    { key: 'human_handover_skill', category: 'ESCALATION', passed: skills.some((skill) => skill.skillKey === 'human.handover' && skill.enabled === true), critical: true, reason: 'Human handover capability must be enabled' },
    { key: 'professional_role', category: 'BEHAVIOR', passed: typeof instructions.role === 'string' && instructions.role.length >= 10, critical: false, reason: 'Professional role must be configured' },
  ];
}

export class AgentEvaluationService {
  async evaluate(businessId: string, agentId: string, releaseId: string, userId?: string) {
    const [release, approvedKnowledge] = await Promise.all([
      prisma.aiAgentRelease.findFirst({ where: { id: releaseId, agentId, businessId } }),
      prisma.aiAgentKnowledgeSource.count({ where: { agentId, businessId, status: 'APPROVED', OR: [{ freshnessDueAt: null }, { freshnessDueAt: { gte: new Date() } }] } }),
    ]);
    if (!release) throw new NotFoundError('Agent release not found');
    if (!['DRAFT', 'FAILED', 'READY_FOR_REVIEW'].includes(release.status)) throw new ValidationError('This release cannot be evaluated in its current state');
    const gates = evaluateReleaseSnapshot(release.snapshotData as Record<string, unknown>, approvedKnowledge);
    const criticalFailures = gates.filter((gate) => gate.critical && !gate.passed).length;
    const overallScore = Math.round((gates.filter((gate) => gate.passed).length / gates.length) * 100);
    const passed = criticalFailures === 0 && overallScore >= 80;
    return prisma.$transaction(async (tx) => {
      const run = await tx.aiAgentEvaluationRun.create({ data: { businessId, agentId, releaseId, status: passed ? 'PASSED' : 'FAILED', overallScore, criticalFailures, startedAt: new Date(), completedAt: new Date(), summary: json({ gate: 'PRE_DEPLOYMENT', passed }), cases: { create: gates.map((gate) => ({ caseKey: gate.key, category: gate.category, input: json({ releaseId }), expected: json({ passed: true }), actual: json({ reason: gate.reason }), score: gate.passed ? 100 : 0, passed: gate.passed, criticalFailure: gate.critical && !gate.passed, failureReason: gate.passed ? null : gate.reason })) } } });
      await tx.aiAgentRelease.update({ where: { id: releaseId }, data: { status: passed ? 'READY_FOR_REVIEW' : 'FAILED', evaluationSummary: json({ runId: run.id, overallScore, criticalFailures, passed }) } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentEvaluationRun', entityId: run.id, newData: json({ releaseId, overallScore, criticalFailures, passed }) } });
      return tx.aiAgentEvaluationRun.findUniqueOrThrow({ where: { id: run.id }, include: { cases: true } });
    });
  }

  list(businessId: string, agentId: string) {
    return prisma.aiAgentEvaluationRun.findMany({ where: { businessId, agentId }, include: { cases: true, release: { select: { releaseNumber: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
  }
}

export const agentEvaluationService = new AgentEvaluationService();
