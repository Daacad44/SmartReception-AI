import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import type { ReviewAgentReleaseInput, UpdateAgentGovernanceInput } from './ai-agent-studio.schemas';

const json = (value: unknown) => value as Prisma.InputJsonValue;

export class AgentGovernanceService {
  async get(businessId: string, agentId: string) {
    await this.assertAgent(businessId, agentId);
    return prisma.aiAgentGovernancePolicy.upsert({
      where: { agentId },
      create: { businessId, agentId },
      update: {},
    });
  }

  async update(businessId: string, agentId: string, input: UpdateAgentGovernanceInput, userId: string) {
    await this.get(businessId, agentId);
    const { expectedRevision, ...changes } = input;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.aiAgentGovernancePolicy.updateMany({
        where: { businessId, agentId, revision: expectedRevision },
        data: { ...changes, revision: { increment: 1 }, updatedByUserId: userId },
      });
      if (updated.count !== 1) throw new ValidationError('Governance policy changed; refresh and try again');
      const policy = await tx.aiAgentGovernancePolicy.findUniqueOrThrow({ where: { agentId } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentGovernancePolicy', entityId: policy.id, newData: json({ revision: policy.revision, ...changes }) } });
      return policy;
    });
  }

  async requestReleaseApproval(businessId: string, agentId: string, releaseId: string, userId: string) {
    const policy = await this.get(businessId, agentId);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-approval:${releaseId}`}))`;
      const release = await tx.aiAgentRelease.findFirst({ where: { id: releaseId, agentId, businessId }, include: { evaluationRuns: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      if (!release) throw new NotFoundError('Agent release not found');
      if (!['READY_FOR_REVIEW', 'APPROVED'].includes(release.status)) throw new ValidationError('Release must pass evaluation before approval');
      if (release.status === 'APPROVED') return tx.aiAgentReleaseApproval.findFirst({ where: { releaseId, status: 'APPROVED' }, orderBy: { requestedAt: 'desc' } });
      if (policy.requireHumanReleaseApproval && release.evaluationRuns[0]?.status !== 'PASSED') throw new ValidationError('A passing evaluation is required before approval');
      const existing = await tx.aiAgentReleaseApproval.findFirst({ where: { releaseId, status: 'PENDING' } });
      if (existing) return existing;
      const approval = await tx.aiAgentReleaseApproval.create({ data: { releaseId, requestedById: userId } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'CREATE', entity: 'AiAgentReleaseApproval', entityId: approval.id, newData: json({ releaseId, status: 'PENDING' }) } });
      return approval;
    });
  }

  async reviewRelease(businessId: string, agentId: string, releaseId: string, input: ReviewAgentReleaseInput, userId: string) {
    const policy = await this.get(businessId, agentId);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-approval:${releaseId}`}))`;
      const request = await tx.aiAgentReleaseApproval.findFirst({ where: { releaseId, release: { agentId, businessId }, status: 'PENDING' }, orderBy: { requestedAt: 'desc' } });
      if (!request) throw new NotFoundError('Pending release approval not found');
      if (policy.requireSeparateApprover && request.requestedById === userId) throw new ValidationError('Release requester cannot approve their own release');
      const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const approval = await tx.aiAgentReleaseApproval.update({ where: { id: request.id }, data: { status, reviewedById: userId, reviewedAt: new Date(), reviewNotes: input.reviewNotes, rejectionReason: input.decision === 'REJECT' ? input.reviewNotes : null } });
      await tx.aiAgentRelease.update({ where: { id: releaseId }, data: { status: input.decision === 'APPROVE' ? 'APPROVED' : 'FAILED' } });
      await tx.auditLog.create({ data: { businessId, userId, action: input.decision === 'APPROVE' ? 'GOVERNANCE_APPROVE' : 'GOVERNANCE_REJECT', entity: 'AiAgentReleaseApproval', entityId: approval.id, newData: json({ decision: input.decision, reviewNotes: input.reviewNotes }) } });
      return approval;
    });
  }

  async activateRelease(businessId: string, agentId: string, releaseId: string, userId: string) {
    await this.get(businessId, agentId);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-activate:${agentId}`}))`;
      const release = await tx.aiAgentRelease.findFirst({ where: { id: releaseId, agentId, businessId }, include: { approvals: { where: { status: 'APPROVED' }, take: 1 } } });
      if (!release) throw new NotFoundError('Agent release not found');
      if (release.status !== 'APPROVED' || !release.approvals.length) throw new ValidationError('Only an approved release can be activated');
      await tx.aiAgentRelease.updateMany({ where: { agentId, status: 'ACTIVE', id: { not: releaseId } }, data: { status: 'RETIRED', retiredAt: new Date() } });
      const active = await tx.aiAgentRelease.update({ where: { id: releaseId }, data: { status: 'ACTIVE', activatedAt: new Date(), retiredAt: null } });
      await tx.aiAgent.update({ where: { id: agentId }, data: { activeReleaseId: releaseId, status: 'ACTIVE' } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentRelease', entityId: releaseId, newData: json({ status: 'ACTIVE' }) } });
      return active;
    });
  }

  async exportEvidence(businessId: string, agentId: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, include: { governancePolicy: true, releases: { include: { approvals: true, evaluationRuns: { include: { cases: true } } }, orderBy: { releaseNumber: 'desc' } } } });
    if (!agent) throw new NotFoundError('AI agent not found');
    const audit = await prisma.auditLog.findMany({ where: { businessId, entity: { in: ['AiAgentGovernancePolicy', 'AiAgentRelease', 'AiAgentReleaseApproval'] } }, orderBy: { createdAt: 'desc' }, take: 1000 });
    return { schemaVersion: 1, exportedAt: new Date(), agent, audit };
  }

  private async assertAgent(businessId: string, agentId: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, businessId }, select: { id: true } });
    if (!agent) throw new NotFoundError('AI agent not found');
  }
}

export const agentGovernanceService = new AgentGovernanceService();
