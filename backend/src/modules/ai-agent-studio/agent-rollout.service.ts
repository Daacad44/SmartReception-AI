import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import type { UpdateAgentRolloutInput } from './ai-agent-studio.schemas';
import { percent } from './agent-analytics.service';

const json = (value: unknown) => value as Prisma.InputJsonValue;

export function rolloutBucket(stableKey: string) {
  return createHash('sha256').update(stableKey).digest().readUInt32BE(0) % 100;
}

export function isIncludedInRollout(stableKey: string, trafficPercentage: number) {
  return trafficPercentage >= 100 || (trafficPercentage > 0 && rolloutBucket(stableKey) < trafficPercentage);
}

export class AgentRolloutService {
  async get(businessId: string, agentId: string) {
    await this.assertAgent(businessId, agentId);
    const config = await prisma.aiAgentRolloutConfig.upsert({ where: { agentId }, create: { businessId, agentId }, update: {} });
    return { ...config, health: await this.health(businessId, agentId, config.observationWindowMins, config) };
  }

  async update(businessId: string, agentId: string, input: UpdateAgentRolloutInput, userId: string) {
    await this.assertAgent(businessId, agentId);
    if (input.enabled && input.trafficPercentage > 0) {
      const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, select: { status: true, activeReleaseId: true } });
      if (agent?.status !== 'ACTIVE' || !agent.activeReleaseId) throw new ValidationError('An active approved release is required before rollout');
    }
    return prisma.$transaction(async (tx) => {
      const config = await tx.aiAgentRolloutConfig.upsert({ where: { agentId }, create: { businessId, agentId, ...input, updatedByUserId: userId }, update: { ...input, updatedByUserId: userId } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentRolloutConfig', entityId: config.id, newData: json(input) } });
      return config;
    });
  }

  async health(businessId: string, agentId: string, windowMinutes: number, thresholds?: { maxFailureRate: number; maxHandoffRate: number; minConfidence: number }) {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const executions = await prisma.aiAgentExecution.findMany({ where: { businessId, agentId, startedAt: { gte: since } }, select: { status: true, confidence: true } });
    const terminal = executions.filter((item) => item.status !== 'RUNNING' && item.status !== 'CANCELLED');
    const failureRate = percent(terminal.filter((item) => item.status === 'FAILED').length, terminal.length);
    const handoffRate = percent(terminal.filter((item) => item.status === 'HANDED_OVER').length, terminal.length);
    const confidenceValues = terminal.flatMap((item) => item.confidence == null ? [] : [item.confidence * 100]);
    const averageConfidence = confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length * 100) / 100 : 0;
    const alerts = thresholds && terminal.length ? [
      failureRate > thresholds.maxFailureRate ? 'FAILURE_RATE' : null,
      handoffRate > thresholds.maxHandoffRate ? 'HANDOFF_RATE' : null,
      averageConfidence < thresholds.minConfidence ? 'LOW_CONFIDENCE' : null,
    ].filter((alert): alert is string => Boolean(alert)) : [];
    return { windowMinutes, sampleSize: terminal.length, failureRate, handoffRate, averageConfidence, healthy: alerts.length === 0, alerts };
  }

  private async assertAgent(businessId: string, agentId: string) {
    if (!await prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, select: { id: true } })) throw new NotFoundError('AI agent not found');
  }
}

export const agentRolloutService = new AgentRolloutService();
