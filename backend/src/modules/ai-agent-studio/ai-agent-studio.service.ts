import type { AiAgentReleaseStatus, AiTrainingVersionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import type {
  CreateAgentReleaseInput,
  UpdateAgentDraftInput,
  UpdateAgentInput,
  UpsertAgentSkillInput,
} from './ai-agent-studio.schemas';

const DEFAULT_AGENT_SLUG = 'whatsapp-agent';

function releaseStatus(status: AiTrainingVersionStatus): AiAgentReleaseStatus {
  switch (status) {
    case 'PRODUCTION': return 'ACTIVE';
    case 'ARCHIVED': return 'RETIRED';
    case 'PENDING_APPROVAL':
    case 'SANDBOX': return 'READY_FOR_REVIEW';
    default: return 'DRAFT';
  }
}

export function buildLegacyReleaseSnapshot(version: {
  id: string;
  snapshotData: Prisma.JsonValue | null;
}) {
  return {
    schemaVersion: 1,
    channel: 'WHATSAPP',
    legacyTrainingVersionId: version.id,
    knowledgeSnapshot: version.snapshotData ?? {},
  };
}

function inputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class AiAgentStudioService {
  async ensureDefaultAgent(businessId: string, userId?: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    if (!business) throw new NotFoundError('Business not found');

    const agent = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-agent-default:${businessId}`}))`;
      const existing = await tx.aiAgent.findUnique({
        where: { businessId_slug: { businessId, slug: DEFAULT_AGENT_SLUG } },
      });
      if (existing) return existing;

      return tx.aiAgent.create({
        data: {
          businessId,
          name: `${business.name} WhatsApp Agent`,
          slug: DEFAULT_AGENT_SLUG,
          type: 'MIXED',
          description: 'Professional WhatsApp reception, sales, support and booking agent',
          channel: 'WHATSAPP',
          createdByUserId: userId,
          draft: {
            create: {
              instructions: { role: 'WhatsApp business assistant', schemaVersion: 1 },
              behaviorConfig: { channel: 'WHATSAPP', defaultLanguage: 'so' },
              escalationPolicy: {
                handoverOnMissingKnowledge: true,
                handoverOnLowConfidence: true,
              },
              modelConfig: { provider: 'configured-default' },
              updatedByUserId: userId,
            },
          },
          skills: {
            create: [
              { skillKey: 'knowledge.search', enabled: true, riskLevel: 'READ_ONLY' },
              { skillKey: 'appointment.check_availability', enabled: true, riskLevel: 'READ_ONLY' },
              { skillKey: 'human.handover', enabled: true, riskLevel: 'LOW' },
              {
                skillKey: 'appointment.create',
                enabled: false,
                riskLevel: 'MEDIUM',
                requiresConfirmation: true,
              },
            ],
          },
        },
      });
    });

    await this.syncLegacyReleases(businessId, agent.id);
    return this.getAgent(businessId, agent.id);
  }

  async syncLegacyReleases(businessId: string, agentId: string) {
    const versions = await prisma.aiTrainingVersion.findMany({
      where: { businessId },
      orderBy: { versionNumber: 'asc' },
    });
    if (!versions.length) return { synced: 0 };

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-agent-sync:${businessId}`}))`;
      let synced = 0;
      let activeReleaseId: string | null = null;
      for (const version of versions) {
        const existing = await tx.aiAgentRelease.findUnique({
          where: { sourceTrainingVersionId: version.id },
          select: { id: true },
        });
        const release = existing
          ? await tx.aiAgentRelease.update({
              where: { id: existing.id },
              data: {
                status: releaseStatus(version.status),
                snapshotData: buildLegacyReleaseSnapshot(version),
                evaluationSummary: {
                  knowledgeScore: version.knowledgeScore,
                  confidenceScore: version.confidenceScore,
                  readinessScore: version.readinessScore,
                  hallucinationRisk: version.hallucinationRisk,
                },
                activatedAt: version.status === 'PRODUCTION' ? version.updatedAt : undefined,
                retiredAt: version.status === 'ARCHIVED' ? version.updatedAt : undefined,
              },
            })
          : await tx.aiAgentRelease.create({
              data: {
                agentId,
                businessId,
                releaseNumber:
                  ((
                    await tx.aiAgentRelease.aggregate({
                      where: { agentId },
                      _max: { releaseNumber: true },
                    })
                  )._max.releaseNumber ?? 0) + 1,
                status: releaseStatus(version.status),
                sourceTrainingVersionId: version.id,
                snapshotData: buildLegacyReleaseSnapshot(version),
                evaluationSummary: {
                  knowledgeScore: version.knowledgeScore,
                  confidenceScore: version.confidenceScore,
                  readinessScore: version.readinessScore,
                  hallucinationRisk: version.hallucinationRisk,
                },
                changeSummary: `Imported training version ${version.versionNumber}`,
                createdByUserId: version.trainedByUserId,
                activatedAt: version.status === 'PRODUCTION' ? version.updatedAt : undefined,
                retiredAt: version.status === 'ARCHIVED' ? version.updatedAt : undefined,
              },
            });
        synced++;
        if (version.status === 'PRODUCTION') activeReleaseId = release.id;
      }
      if (activeReleaseId) {
        await tx.aiAgent.update({
          where: { id: agentId },
          data: { activeReleaseId, status: 'ACTIVE' },
        });
      }
      return { synced };
    });
  }

  async listAgents(businessId: string, userId?: string) {
    await this.ensureDefaultAgent(businessId, userId);
    return prisma.aiAgent.findMany({
      where: { businessId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'asc' },
      include: {
        activeRelease: true,
        draft: true,
        skills: { orderBy: { skillKey: 'asc' } },
        _count: { select: { releases: true, executions: true } },
      },
    });
  }

  async getAgent(businessId: string, agentId: string) {
    const agent = await prisma.aiAgent.findFirst({
      where: { id: agentId, businessId },
      include: {
        activeRelease: true,
        draft: true,
        skills: { orderBy: { skillKey: 'asc' } },
        releases: { orderBy: { releaseNumber: 'desc' }, take: 20 },
        _count: { select: { executions: true, evaluations: true } },
      },
    });
    if (!agent) throw new NotFoundError('AI agent not found');
    return agent;
  }

  async updateAgent(businessId: string, agentId: string, input: UpdateAgentInput, userId?: string) {
    const current = await this.getAgent(businessId, agentId);
    if (input.status === 'ACTIVE' && !current.activeReleaseId) {
      throw new ValidationError('An agent requires an active release before activation');
    }
    const defaultLanguage = input.defaultLanguage ?? current.defaultLanguage;
    const supportedLanguages = input.supportedLanguages ?? current.supportedLanguages;
    if (!supportedLanguages.includes(defaultLanguage)) {
      throw new ValidationError('Default language must be included in supported languages');
    }
    if (input.supportedLanguages) {
      input.supportedLanguages = [...new Set(input.supportedLanguages)];
    }
    return prisma.$transaction(async (tx) => {
      const agent = await tx.aiAgent.update({ where: { id: agentId }, data: input });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'UPDATE',
          entity: 'AiAgent',
          entityId: agentId,
          newData: inputJson(input),
        },
      });
      return agent;
    });
  }

  async updateDraft(
    businessId: string,
    agentId: string,
    input: UpdateAgentDraftInput,
    userId?: string
  ) {
    const agent = await this.getAgent(businessId, agentId);
    if (agent.status === 'ARCHIVED') throw new ValidationError('Archived agents cannot be edited');
    if (!agent.draft) throw new ValidationError('Agent draft is not configured');
    const { expectedRevision, ...changes } = input;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.aiAgentDraft.updateMany({
        where: { agentId, revision: expectedRevision },
        data: {
          ...(changes.instructions ? { instructions: inputJson(changes.instructions) } : {}),
          ...(changes.behaviorConfig ? { behaviorConfig: inputJson(changes.behaviorConfig) } : {}),
          ...(changes.knowledgeConfig ? { knowledgeConfig: inputJson(changes.knowledgeConfig) } : {}),
          ...(changes.escalationPolicy ? { escalationPolicy: inputJson(changes.escalationPolicy) } : {}),
          ...(changes.modelConfig ? { modelConfig: inputJson(changes.modelConfig) } : {}),
          revision: { increment: 1 },
          updatedByUserId: userId,
        },
      });
      if (updated.count !== 1) {
        throw new ValidationError('Agent draft changed since it was loaded; refresh and try again');
      }
      const draft = await tx.aiAgentDraft.findUniqueOrThrow({ where: { agentId } });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'UPDATE',
          entity: 'AiAgentDraft',
          entityId: draft.id,
          newData: inputJson({ revision: draft.revision, changedSections: Object.keys(changes) }),
        },
      });
      return draft;
    });
  }

  async createRelease(
    businessId: string,
    agentId: string,
    input: CreateAgentReleaseInput,
    userId?: string
  ) {
    const agent = await this.getAgent(businessId, agentId);
    if (agent.status === 'ARCHIVED') throw new ValidationError('Archived agents cannot create releases');
    if (!agent.draft) throw new ValidationError('Agent draft is not configured');
    const draft = agent.draft;

    const release = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-agent-release:${agentId}`}))`;
      const latest = await tx.aiAgentRelease.findFirst({
        where: { agentId },
        orderBy: { releaseNumber: 'desc' },
        select: { releaseNumber: true },
      });
      const sourceVersion = await tx.aiTrainingVersion.findFirst({
        where: { businessId, status: { in: ['SANDBOX', 'PENDING_APPROVAL', 'PRODUCTION'] } },
        orderBy: { versionNumber: 'desc' },
      });
      const release = await tx.aiAgentRelease.create({
        data: {
          agentId,
          businessId,
          releaseNumber: (latest?.releaseNumber ?? 0) + 1,
          status: 'DRAFT',
          snapshotData: {
            schemaVersion: 1,
            channel: agent.channel,
            agent: {
              name: agent.name,
              type: agent.type,
              defaultLanguage: agent.defaultLanguage,
              supportedLanguages: agent.supportedLanguages,
            },
            draft: {
              revision: draft.revision,
              instructions: draft.instructions,
              behaviorConfig: draft.behaviorConfig,
              knowledgeConfig: draft.knowledgeConfig,
              escalationPolicy: draft.escalationPolicy,
              modelConfig: draft.modelConfig,
            },
            skills: agent.skills.map((skill) => ({
              skillKey: skill.skillKey,
              enabled: skill.enabled,
              riskLevel: skill.riskLevel,
              requiresConfirmation: skill.requiresConfirmation,
              configuration: skill.configuration,
            })),
            knowledgeSnapshot: sourceVersion?.snapshotData ?? {},
          },
          changeSummary: input.changeSummary,
          createdByUserId: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'CREATE',
          entity: 'AiAgentRelease',
          entityId: release.id,
          newData: inputJson({
            releaseNumber: release.releaseNumber,
            changeSummary: input.changeSummary,
          }),
        },
      });
      return release;
    });
    return release;
  }

  async upsertSkill(
    businessId: string,
    agentId: string,
    skillKey: string,
    input: UpsertAgentSkillInput,
    userId?: string
  ) {
    const agent = await this.getAgent(businessId, agentId);
    if (agent.status === 'ARCHIVED') throw new ValidationError('Archived agents cannot change skills');
    if (input.riskLevel === 'CRITICAL' && input.enabled) {
      throw new ValidationError('Critical skills cannot be enabled for autonomous execution');
    }
    if (['HIGH', 'CRITICAL'].includes(input.riskLevel) && !input.requiresConfirmation) {
      throw new ValidationError('High-risk skills require confirmation');
    }
    return prisma.$transaction(async (tx) => {
      const skill = await tx.aiAgentSkillConfiguration.upsert({
        where: { agentId_skillKey: { agentId, skillKey } },
        update: { ...input, configuration: inputJson(input.configuration) },
        create: { agentId, skillKey, ...input, configuration: inputJson(input.configuration) },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'UPDATE',
          entity: 'AiAgentSkillConfiguration',
          entityId: skill.id,
          newData: inputJson({ skillKey, enabled: skill.enabled, riskLevel: skill.riskLevel }),
        },
      });
      return skill;
    });
  }
}

export const aiAgentStudioService = new AiAgentStudioService();
