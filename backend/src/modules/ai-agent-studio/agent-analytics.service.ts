import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';

export function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}

function average(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === 'number');
  return present.length ? Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 100) / 100 : 0;
}

export class AgentAnalyticsService {
  async get(businessId: string, agentId: string, days: number) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, select: { id: true, name: true, status: true, activeReleaseId: true } });
    if (!agent) throw new NotFoundError('AI agent not found');
    const from = new Date(Date.now() - days * 86_400_000);
    const [executions, actions, handoffs, evaluations, knowledge, releases] = await Promise.all([
      prisma.aiAgentExecution.findMany({ where: { businessId, agentId, startedAt: { gte: from } }, select: { status: true, confidence: true, latencyMs: true, tokensUsed: true, estimatedCost: true, startedAt: true } }),
      prisma.aiAgentAction.findMany({ where: { businessId, execution: { agentId }, createdAt: { gte: from } }, select: { type: true, status: true, createdAt: true } }),
      prisma.aiHandoffCase.findMany({ where: { businessId, agentExecution: { agentId }, createdAt: { gte: from } }, select: { status: true, priority: true, createdAt: true, slaDueAt: true, acknowledgedAt: true } }),
      prisma.aiAgentEvaluationRun.findMany({ where: { businessId, agentId, createdAt: { gte: from } }, select: { status: true, overallScore: true, criticalFailures: true } }),
      prisma.aiAgentKnowledgeSource.findMany({ where: { businessId, agentId, status: { not: 'ARCHIVED' } }, select: { status: true, freshnessDueAt: true } }),
      prisma.aiAgentRelease.findMany({ where: { businessId, agentId }, select: { status: true } }),
    ]);

    const completed = executions.filter((item) => item.status === 'COMPLETED').length;
    const handedOver = executions.filter((item) => item.status === 'HANDED_OVER').length;
    const failed = executions.filter((item) => item.status === 'FAILED').length;
    const terminal = completed + handedOver + failed;
    const actionCompleted = actions.filter((item) => item.status === 'COMPLETED').length;
    const actionTerminal = actions.filter((item) => ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(item.status)).length;
    const now = new Date();
    const breachedHandoffs = handoffs.filter((item) => (item.acknowledgedAt ?? now) > item.slaDueAt).length;
    const acknowledgedSeconds = handoffs.filter((item) => item.acknowledgedAt).map((item) => (item.acknowledgedAt!.getTime() - item.createdAt.getTime()) / 1000);

    const byDay = new Map<string, { executions: number; completed: number; handedOver: number; failed: number; actions: number }>();
    for (const execution of executions) {
      const key = execution.startedAt.toISOString().slice(0, 10);
      const row = byDay.get(key) ?? { executions: 0, completed: 0, handedOver: 0, failed: 0, actions: 0 };
      row.executions++;
      if (execution.status === 'COMPLETED') row.completed++;
      if (execution.status === 'HANDED_OVER') row.handedOver++;
      if (execution.status === 'FAILED') row.failed++;
      byDay.set(key, row);
    }
    for (const action of actions) {
      const key = action.createdAt.toISOString().slice(0, 10);
      const row = byDay.get(key) ?? { executions: 0, completed: 0, handedOver: 0, failed: 0, actions: 0 };
      row.actions++;
      byDay.set(key, row);
    }

    return {
      period: { days, from, to: now },
      agent,
      runtime: {
        executions: executions.length,
        completed,
        handedOver,
        failed,
        containmentRate: percent(completed, terminal),
        handoffRate: percent(handedOver, terminal),
        failureRate: percent(failed, terminal),
        averageConfidence: average(executions.map((item) => item.confidence == null ? null : item.confidence * 100)),
        averageLatencyMs: average(executions.map((item) => item.latencyMs)),
        tokensUsed: executions.reduce((sum, item) => sum + item.tokensUsed, 0),
        estimatedCost: Math.round(executions.reduce((sum, item) => sum + Number(item.estimatedCost), 0) * 1_000_000) / 1_000_000,
      },
      actions: {
        total: actions.length,
        completed: actionCompleted,
        awaitingConfirmation: actions.filter((item) => item.status === 'AWAITING_CONFIRMATION').length,
        cancelled: actions.filter((item) => item.status === 'CANCELLED').length,
        failed: actions.filter((item) => item.status === 'FAILED').length,
        expired: actions.filter((item) => item.status === 'EXPIRED').length,
        conversionRate: percent(actionCompleted, actionTerminal),
        byType: Object.fromEntries(['APPOINTMENT_CREATE', 'LEAD_CAPTURE', 'ORDER_CREATE'].map((type) => [type, actions.filter((item) => item.type === type).length])),
      },
      handoffs: {
        total: handoffs.length,
        open: handoffs.filter((item) => item.status === 'OPEN').length,
        acknowledged: handoffs.filter((item) => item.status === 'ACKNOWLEDGED').length,
        resolved: handoffs.filter((item) => ['RESOLVED', 'AI_RESUMED'].includes(item.status)).length,
        urgent: handoffs.filter((item) => item.priority === 'URGENT').length,
        slaBreached: breachedHandoffs,
        slaComplianceRate: percent(handoffs.length - breachedHandoffs, handoffs.length),
        averageAcknowledgeSeconds: average(acknowledgedSeconds),
      },
      quality: {
        evaluationRuns: evaluations.length,
        passRate: percent(evaluations.filter((item) => item.status === 'PASSED').length, evaluations.length),
        averageScore: average(evaluations.map((item) => item.overallScore)),
        criticalFailures: evaluations.reduce((sum, item) => sum + item.criticalFailures, 0),
      },
      knowledge: {
        total: knowledge.length,
        approved: knowledge.filter((item) => item.status === 'APPROVED').length,
        pending: knowledge.filter((item) => item.status === 'PENDING_REVIEW').length,
        stale: knowledge.filter((item) => item.status === 'STALE' || (item.freshnessDueAt && item.freshnessDueAt < now)).length,
      },
      releases: Object.fromEntries(['DRAFT', 'FAILED', 'READY_FOR_REVIEW', 'ACTIVE', 'RETIRED'].map((status) => [status, releases.filter((item) => item.status === status).length])),
      timeline: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })),
    };
  }
}

export const agentAnalyticsService = new AgentAnalyticsService();
