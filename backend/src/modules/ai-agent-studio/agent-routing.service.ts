import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import type { UpsertAgentRoutingRuleInput } from './ai-agent-studio.schemas';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function matchRoutingRule<T extends { keywords: string[]; intents: string[]; isFallback: boolean }>(rules: T[], message: string, intent?: string) {
  const normalizedMessage = normalize(message);
  const normalizedIntent = intent ? normalize(intent) : undefined;
  return rules.find((rule) => !rule.isFallback && (
    rule.keywords.some((keyword) => normalizedMessage.includes(normalize(keyword))) ||
    Boolean(normalizedIntent && rule.intents.some((candidate) => normalize(candidate) === normalizedIntent))
  )) ?? rules.find((rule) => rule.isFallback);
}

export class AgentRoutingService {
  list(businessId: string) {
    return prisma.aiAgentRoutingRule.findMany({ where: { businessId }, include: { agent: { select: { id: true, name: true, status: true, activeReleaseId: true } } }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
  }

  async upsert(businessId: string, ruleId: string | undefined, input: UpsertAgentRoutingRuleInput, userId: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: input.agentId, businessId }, select: { id: true } });
    if (!agent) throw new NotFoundError('Routing target agent not found');
    if (!input.isFallback && input.keywords.length === 0 && input.intents.length === 0) throw new ValidationError('A routing rule requires keywords or intents');
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-routing:${businessId}`}))`;
      if (input.isFallback && input.enabled) {
        await tx.aiAgentRoutingRule.updateMany({ where: { businessId, isFallback: true, enabled: true, ...(ruleId ? { id: { not: ruleId } } : {}) }, data: { enabled: false } });
      }
      const rule = ruleId
        ? await tx.aiAgentRoutingRule.update({ where: { id: ruleId, businessId }, data: { ...input, keywords: [...new Set(input.keywords.map(normalize))], intents: [...new Set(input.intents.map(normalize))] } })
        : await tx.aiAgentRoutingRule.create({ data: { businessId, ...input, keywords: [...new Set(input.keywords.map(normalize))], intents: [...new Set(input.intents.map(normalize))], createdByUserId: userId } });
      await tx.auditLog.create({ data: { businessId, userId, action: ruleId ? 'UPDATE' : 'CREATE', entity: 'AiAgentRoutingRule', entityId: rule.id, newData: json(input) } });
      return rule;
    });
  }

  async remove(businessId: string, ruleId: string, userId: string) {
    const rule = await prisma.aiAgentRoutingRule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundError('Routing rule not found');
    return prisma.$transaction(async (tx) => {
      await tx.aiAgentRoutingRule.delete({ where: { id: ruleId } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'DELETE', entity: 'AiAgentRoutingRule', entityId: ruleId, oldData: json({ name: rule.name, agentId: rule.agentId, priority: rule.priority, intents: rule.intents, keywords: rule.keywords, isFallback: rule.isFallback, enabled: rule.enabled }) } });
      return { id: ruleId };
    });
  }

  async resolve(businessId: string, message: string) {
    const rules = await prisma.aiAgentRoutingRule.findMany({ where: { businessId, enabled: true, agent: { status: 'ACTIVE', activeReleaseId: { not: null } } }, include: { agent: { include: { activeRelease: true, skills: true, governancePolicy: true, rolloutConfig: true } } }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
    return matchRoutingRule(rules, message)?.agent;
  }
}

export const agentRoutingService = new AgentRoutingService();
