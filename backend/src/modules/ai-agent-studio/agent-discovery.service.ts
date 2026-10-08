import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import type { ApplyAgentDiscoveryInput } from './ai-agent-studio.schemas';
import { AGENT_DISCOVERY_TEMPLATES, templateForIndustry } from './agent-discovery.templates';

const json = (value: Record<string, unknown>): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export class AgentDiscoveryService {
  listTemplates() {
    return AGENT_DISCOVERY_TEMPLATES;
  }

  async getDiscovery(businessId: string, agentId: string) {
    const [agent, business, profile, documentCount] = await Promise.all([
      prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, include: { draft: true, skills: true } }),
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.businessProfile.findUnique({ where: { businessId } }),
      prisma.knowledgeDocument.count({ where: { knowledgeBase: { businessId } } }),
    ]);
    if (!agent || !business) throw new NotFoundError('AI agent not found');

    const recommended = templateForIndustry(business.industry);
    const checks = [
      { key: 'business_identity', label: 'Business identity', complete: Boolean(profile?.businessName || business.name) },
      { key: 'business_overview', label: 'Business overview', complete: Boolean(profile?.companyOverview || profile?.businessDescription || business.description) },
      { key: 'contact_details', label: 'Contact details', complete: Boolean(profile?.phone || profile?.whatsapp || business.phone || business.whatsappNumber) },
      { key: 'working_hours', label: 'Working hours', complete: Boolean(profile?.workingHours) },
      { key: 'approved_knowledge', label: 'Approved knowledge', complete: documentCount > 0 },
      { key: 'handover', label: 'Human handover', complete: agent.skills.some((skill) => skill.skillKey === 'human.handover' && skill.enabled) },
      { key: 'discovery', label: 'Business discovery interview', complete: Boolean((agent.draft?.behaviorConfig as Record<string, unknown> | null)?.discoveryCompletedAt) },
    ];

    return {
      recommendedTemplateId: recommended.id,
      business: { name: business.name, industry: business.industry, businessType: business.businessType },
      profile,
      documentCount,
      checks,
      readinessPercent: Math.round((checks.filter((check) => check.complete).length / checks.length) * 100),
    };
  }

  async apply(businessId: string, agentId: string, input: ApplyAgentDiscoveryInput, userId?: string) {
    const template = AGENT_DISCOVERY_TEMPLATES.find((item) => item.id === input.templateId);
    if (!template) throw new ValidationError('Unknown agent template');

    return prisma.$transaction(async (tx) => {
      const agent = await tx.aiAgent.findFirst({ where: { id: agentId, businessId }, include: { draft: true } });
      if (!agent?.draft) throw new NotFoundError('AI agent draft not found');
      if (agent.status === 'ARCHIVED') throw new ValidationError('Archived agents cannot run discovery');

      const instructions = {
        role: template.role,
        primaryGoal: input.answers.primaryGoal,
        objectives: template.objectives,
        customerTypes: input.answers.customerTypes,
        commonQuestions: input.answers.commonQuestions,
        boundaries: [...template.boundaries, ...input.answers.prohibitedTopics],
        operatingNotes: input.answers.operatingNotes,
        source: 'structured-business-discovery',
      };
      const behaviorConfig = {
        ...(agent.draft.behaviorConfig as Record<string, unknown>),
        tone: input.answers.tone,
        channel: 'WHATSAPP',
        discoveryTemplateId: template.id,
        discoveryCompletedAt: new Date().toISOString(),
      };
      const escalationPolicy = {
        ...(agent.draft.escalationPolicy as Record<string, unknown>),
        handoverOnMissingKnowledge: true,
        handoverOnLowConfidence: true,
        rules: input.answers.handoverRules,
      };

      const updated = await tx.aiAgentDraft.updateMany({
        where: { agentId, revision: input.expectedRevision },
        data: {
          instructions: json(instructions),
          behaviorConfig: json(behaviorConfig),
          escalationPolicy: json(escalationPolicy),
          revision: { increment: 1 },
          updatedByUserId: userId,
        },
      });
      if (updated.count !== 1) throw new ValidationError('Agent draft changed; refresh before applying discovery');

      await tx.aiAgent.update({
        where: { id: agentId },
        data: { type: template.agentType, defaultLanguage: input.answers.languages[0], supportedLanguages: [...new Set(input.answers.languages)] },
      });
      for (const skillKey of template.suggestedSkills) {
        await tx.aiAgentSkillConfiguration.upsert({
          where: { agentId_skillKey: { agentId, skillKey } },
          create: { agentId, skillKey, enabled: true, riskLevel: 'READ_ONLY' },
          update: { enabled: true },
        });
      }
      await tx.auditLog.create({
        data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentDiscovery', entityId: agentId, newData: json({ templateId: template.id, draftRevision: input.expectedRevision + 1 }) },
      });
      return tx.aiAgent.findUniqueOrThrow({ where: { id: agentId }, include: { draft: true, skills: true } });
    });
  }
}

export const agentDiscoveryService = new AgentDiscoveryService();
