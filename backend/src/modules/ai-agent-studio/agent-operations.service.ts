import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import { agentRolloutService } from './agent-rollout.service';
import type { ResolveIncidentInput, UpsertChannelBindingInput } from './ai-agent-studio.schemas';

const json = (value: unknown) => value as Prisma.InputJsonValue;
export const CHANNEL_CAPABILITIES = {
  WHATSAPP: { text: true, media: true, interactive: true, templates: true },
  INSTAGRAM: { text: true, media: true, interactive: false, templates: false },
  MESSENGER: { text: true, media: true, interactive: true, templates: false },
  TIKTOK: { text: true, media: false, interactive: false, templates: false },
  WEBCHAT: { text: true, media: true, interactive: true, templates: false },
} as const;

export function normalizeChannelMessage(channel: keyof typeof CHANNEL_CAPABILITIES, externalMessageId: string, text: string) {
  return { channel, externalMessageId, type: 'TEXT' as const, text: text.trim(), receivedAt: new Date().toISOString() };
}

export class AgentOperationsService {
  listIncidents(businessId: string, agentId: string) { return prisma.aiAgentIncident.findMany({ where: { businessId, agentId }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async scan(businessId: string, agentId: string, userId: string) {
    const rollout = await prisma.aiAgentRolloutConfig.findFirst({ where: { businessId, agentId } });
    if (!rollout) throw new NotFoundError('Rollout configuration not found');
    const health = await agentRolloutService.health(businessId, agentId, rollout.observationWindowMins, rollout);
    if (health.healthy) return { health, incident: null };
    const type = health.alerts.join('+');
    const incident = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-incident:${agentId}:${type}`}))`;
      const existing = await tx.aiAgentIncident.findFirst({ where: { businessId, agentId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, type } });
      if (existing) return existing;
      const created = await tx.aiAgentIncident.create({ data: { businessId, agentId, severity: health.failureRate > 25 ? 'CRITICAL' : 'HIGH', type, summary: `Agent health threshold breached: ${health.alerts.join(', ')}`, evidence: json(health) } });
      await tx.aiAgentRolloutConfig.update({ where: { agentId }, data: { killSwitch: true, updatedByUserId: userId } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'CREATE', entity: 'AiAgentIncident', entityId: created.id, newData: json({ type, automaticKillSwitch: true }) } });
      return created;
    });
    return { health, incident };
  }
  async resolveIncident(businessId: string, incidentId: string, input: ResolveIncidentInput, userId: string) {
    const incident = await prisma.aiAgentIncident.findFirst({ where: { id: incidentId, businessId } });
    if (!incident) throw new NotFoundError('Incident not found');
    return prisma.aiAgentIncident.update({ where: { id: incidentId }, data: input.action === 'ACKNOWLEDGE' ? { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedById: userId } : { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: userId, resolutionNotes: input.notes } });
  }
  listChannels(businessId: string, agentId: string) { return prisma.aiChannelBinding.findMany({ where: { businessId, agentId }, orderBy: { channel: 'asc' } }); }
  async upsertChannel(businessId: string, agentId: string, input: UpsertChannelBindingInput, userId: string) {
    if (!await prisma.aiAgent.findFirst({ where: { id: agentId, businessId } })) throw new NotFoundError('AI agent not found');
    if (input.status === 'ACTIVE' && input.channel !== 'WHATSAPP') throw new ValidationError(`${input.channel} activation is reserved for its future connector rollout`);
    const binding = await prisma.aiChannelBinding.upsert({ where: { businessId_channel_externalRef: { businessId, channel: input.channel, externalRef: input.externalRef } }, create: { businessId, agentId, ...input, configuration: json(input.configuration), capabilities: json(CHANNEL_CAPABILITIES[input.channel]), lastHealthAt: input.status === 'ACTIVE' ? new Date() : null }, update: { agentId, status: input.status, configuration: json(input.configuration), capabilities: json(CHANNEL_CAPABILITIES[input.channel]), lastHealthAt: input.status === 'ACTIVE' ? new Date() : undefined, lastError: null } });
    await prisma.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiChannelBinding', entityId: binding.id, newData: json({ channel: input.channel, status: input.status }) } });
    return binding;
  }
}
export const agentOperationsService = new AgentOperationsService();
