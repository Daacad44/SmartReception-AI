import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { emailService } from '../../infrastructure/email/email.service';
import { createNotification } from '../../infrastructure/notifications/notification-helper';
import { NotFoundError, ValidationError, ForbiddenError } from '../../core/errors';
import { workspaceService } from './workspace.service';
import { recordAiTrainingAudit, type AuditContext } from './audit.service';
import { invalidateKnowledgeCache } from '../../infrastructure/ai/knowledge-search.service';
import { sandboxService } from './sandbox.service';
import { VALIDATION_THRESHOLD } from './ai-knowledge.constants';
import { config } from '../../config';

export interface DeploymentReadiness {
  ready: boolean;
  blockers: string[];
  checklist: Awaited<ReturnType<typeof sandboxService.getReadinessChecklist>>;
  threshold: number;
}

export class DeploymentService {
  /**
   * Deployment gate (Phase 13). Approval is blocked unless every hard
   * requirement is satisfied: knowledge approved & indexed, training completed,
   * sandbox tested, AI quality above threshold, and no failed checklist items.
   */
  async evaluateDeploymentReadiness(
    businessId: string,
    versionId: string
  ): Promise<DeploymentReadiness> {
    const checklist = await sandboxService.getReadinessChecklist(businessId, versionId);
    const byKey = new Map(checklist.items.map((i) => [i.key, i]));
    const blockers: string[] = [];

    const requireComplete = (key: string, message: string) => {
      const item = byKey.get(key);
      if (!item || item.state !== 'COMPLETE') blockers.push(message);
    };

    requireComplete('knowledge_approved', 'Knowledge must be approved and indexed');
    requireComplete('training_completed', 'Training must be completed');
    requireComplete('embeddings_generated', 'Embeddings must be generated');
    requireComplete('knowledge_indexed', 'Knowledge must be indexed');
    requireComplete('sandbox_tested', 'Sandbox testing must be run');

    const evaluation = byKey.get('evaluation_passed');
    if (evaluation?.state === 'FAILED') {
      blockers.push(`AI quality is below the ${VALIDATION_THRESHOLD}% threshold`);
    } else if (evaluation?.state === 'PENDING') {
      blockers.push('AI evaluation has not produced a readiness score yet');
    }

    if (checklist.failed > 0) {
      blockers.push('One or more readiness checks have failed');
    }

    return { ready: blockers.length === 0, blockers, checklist, threshold: VALIDATION_THRESHOLD };
  }

  async requestDeployment(
    businessId: string,
    versionId: string,
    audit: AuditContext & { deploymentSummary?: string; sandboxTestSummary?: Record<string, unknown> }
  ) {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId, status: 'SANDBOX' },
    });
    if (!version) {
      throw new ValidationError('Only sandbox versions can be submitted for deployment');
    }

    const pending = await prisma.aiDeploymentRequest.findFirst({
      where: { businessId, versionId, status: 'PENDING' },
    });
    if (pending) {
      return pending;
    }

    const request = await prisma.aiDeploymentRequest.create({
      data: {
        businessId,
        versionId,
        status: 'PENDING',
        requestedByUserId: audit.userId,
        requestedByTrainerId: audit.trainerId,
        knowledgeScore: version.knowledgeScore,
        confidenceScore: version.confidenceScore,
        readinessScore: version.readinessScore,
        sandboxTestSummary: audit.sandboxTestSummary as Prisma.InputJsonValue | undefined,
        deploymentSummary: audit.deploymentSummary,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      },
      include: {
        business: { select: { id: true, name: true } },
        version: { select: { versionNumber: true } },
        requestedByTrainer: { select: { firstName: true, lastName: true, username: true } },
        requestedByUser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    await prisma.aiTrainingVersion.update({
      where: { id: versionId },
      data: { status: 'PENDING_APPROVAL' },
    });

    await recordAiTrainingAudit(
      { ...audit, businessId, versionId },
      'DEPLOYMENT_REQUESTED',
      { entity: 'AiDeploymentRequest', entityId: request.id }
    );

    const fullRequest = await prisma.aiDeploymentRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: {
        business: { select: { id: true, name: true } },
        version: { select: { versionNumber: true } },
        requestedByTrainer: { select: { firstName: true, lastName: true, username: true } },
        requestedByUser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    await this.notifySuperAdmins(fullRequest);
    return request;
  }

  private async notifySuperAdmins(request: {
    id: string;
    businessId: string;
    business: { name: string };
    version: { versionNumber: number };
    knowledgeScore: number | null;
    confidenceScore: number | null;
    readinessScore: number | null;
    requestedByTrainer: { firstName: string; lastName: string } | null;
    requestedByUser: { firstName: string; lastName: string } | null;
    deploymentSummary: string | null;
  }) {
    const superAdmins = await prisma.user.findMany({
      where: { isSuperAdmin: true, isActive: true },
      select: { id: true, email: true, firstName: true },
    });

    const trainerName = request.requestedByTrainer
      ? `${request.requestedByTrainer.firstName} ${request.requestedByTrainer.lastName}`
      : request.requestedByUser
        ? `${request.requestedByUser.firstName} ${request.requestedByUser.lastName}`
        : 'Unknown';

    const message = `AI deployment request for ${request.business.name} — Version ${request.version.versionNumber}`;

    for (const admin of superAdmins) {
      await createNotification({
        businessId: request.businessId,
        userId: admin.id,
        type: 'AI_DEPLOYMENT_REQUEST',
        title: 'AI Deployment Approval Required',
        message,
        data: {
          requestId: request.id,
          businessName: request.business.name,
          versionNumber: request.version.versionNumber,
          knowledgeScore: request.knowledgeScore,
          confidenceScore: request.confidenceScore,
          readinessScore: request.readinessScore,
          trainerName,
        },
      }).catch(() => undefined);

      if (admin.email) {
        await emailService.send(
          admin.email,
          `AI Deployment Approval — ${request.business.name}`,
          `<p>A new AI version requires your approval.</p>
          <ul>
            <li><strong>Business:</strong> ${request.business.name}</li>
            <li><strong>Trainer:</strong> ${trainerName}</li>
            <li><strong>Version:</strong> ${request.version.versionNumber}</li>
            <li><strong>Knowledge Score:</strong> ${request.knowledgeScore ?? 'N/A'}</li>
            <li><strong>Confidence Score:</strong> ${request.confidenceScore ?? 'N/A'}</li>
            <li><strong>AI Readiness:</strong> ${request.readinessScore ?? 'N/A'}</li>
          </ul>
          <p><a href="${config.frontendUrl}/admin/ai-deployments">Review in Dashboard</a></p>`
        );
      }
    }
  }

  async listRequests(businessId?: string, status?: string) {
    return prisma.aiDeploymentRequest.findMany({
      where: {
        ...(businessId ? { businessId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        business: { select: { id: true, name: true } },
        version: { select: { id: true, versionNumber: true, status: true } },
        requestedByTrainer: { select: { firstName: true, lastName: true } },
        requestedByUser: { select: { firstName: true, lastName: true } },
        approvedByUser: { select: { firstName: true, lastName: true } },
        rejectedByUser: { select: { firstName: true, lastName: true } },
      },
      take: 50,
    });
  }

  async getRequest(requestId: string) {
    const request = await prisma.aiDeploymentRequest.findUnique({
      where: { id: requestId },
      include: {
        business: true,
        version: true,
        requestedByTrainer: true,
        requestedByUser: true,
      },
    });
    if (!request) throw new NotFoundError('Deployment request not found');
    return request;
  }

  async approve(
    requestId: string,
    userId: string,
    audit: AuditContext,
    opts: { override?: boolean } = {}
  ) {
    const request = await this.getRequest(requestId);
    if (request.status !== 'PENDING' && request.status !== 'CHANGES_REQUESTED') {
      throw new ValidationError('Request is not pending approval');
    }

    if (!opts.override) {
      const readiness = await this.evaluateDeploymentReadiness(request.businessId, request.versionId);
      if (!readiness.ready) {
        throw new ValidationError(
          `Deployment blocked — resolve the following before approving: ${readiness.blockers.join('; ')}`
        );
      }
    }

    return prisma.aiDeploymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(requestId: string, userId: string, reason: string, audit: AuditContext) {
    const request = await this.getRequest(requestId);
    if (request.status !== 'PENDING') {
      throw new ValidationError('Request is not pending');
    }

    await prisma.aiTrainingVersion.update({
      where: { id: request.versionId },
      data: { status: 'SANDBOX' },
    });

    await recordAiTrainingAudit(
      { ...audit, businessId: request.businessId, versionId: request.versionId, userId },
      'DEPLOYMENT_REJECTED',
      { entity: 'AiDeploymentRequest', entityId: requestId, newData: { reason } }
    );

    return prisma.aiDeploymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedByUserId: userId,
        rejectionReason: reason,
        reviewedAt: new Date(),
      },
    });
  }

  async requestChanges(requestId: string, userId: string, notes: string) {
    const request = await this.getRequest(requestId);
    if (request.status !== 'PENDING') {
      throw new ValidationError('Request is not pending');
    }

    await prisma.aiTrainingVersion.update({
      where: { id: request.versionId },
      data: { status: 'SANDBOX' },
    });

    return prisma.aiDeploymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'CHANGES_REQUESTED',
        changeRequestNotes: notes,
        reviewedAt: new Date(),
      },
    });
  }

  async publishToProduction(requestId: string, userId: string, audit: AuditContext) {
    const request = await this.getRequest(requestId);
    if (request.status !== 'APPROVED') {
      throw new ForbiddenError('Deployment must be approved before publishing');
    }

    const workspace = await workspaceService.getWorkspace(request.businessId);
    const previousProductionId = workspace.productionVersionId;

    if (previousProductionId) {
      await prisma.aiTrainingVersion.update({
        where: { id: previousProductionId },
        data: { status: 'ARCHIVED' },
      });
    }

    await prisma.aiTrainingVersion.update({
      where: { id: request.versionId },
      data: { status: 'PRODUCTION' },
    });

    await workspaceService.updateWorkspaceMetrics(request.businessId, {
      productionVersionId: request.versionId,
      sandboxVersionId: request.versionId,
      aiReadinessScore: request.readinessScore ?? undefined,
      knowledgeScore: request.knowledgeScore ?? undefined,
      confidenceScore: request.confidenceScore ?? undefined,
    });

    invalidateKnowledgeCache(request.businessId);

    const deployed = await prisma.aiDeploymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'DEPLOYED',
        deployedAt: new Date(),
      },
      include: {
        business: { select: { name: true } },
        version: { select: { versionNumber: true } },
      },
    });

    await recordAiTrainingAudit(
      { ...audit, businessId: request.businessId, versionId: request.versionId, userId },
      'DEPLOYMENT_PUBLISHED',
      {
        entity: 'AiDeploymentRequest',
        entityId: requestId,
        oldData: { productionVersionId: previousProductionId },
        newData: { productionVersionId: request.versionId },
      }
    );

    if (request.requestedByTrainerId) {
      const trainer = await prisma.aiTrainer.findUnique({
        where: { id: request.requestedByTrainerId },
        select: { email: true, firstName: true },
      });
      if (trainer?.email) {
        await emailService.send(
          trainer.email,
          `AI Version ${deployed.version.versionNumber} Published`,
          `<p>Your AI training version for ${deployed.business.name} has been published to production.</p>`
        );
      }
    }

    return deployed;
  }

  async autoDeployValidatedVersion(
    businessId: string,
    versionId: string,
    audit: AuditContext & { validationScore?: number }
  ) {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId, status: { in: ['SANDBOX', 'DRAFT'] } },
    });
    if (!version) {
      throw new ValidationError('Version not available for auto-deployment');
    }

    const workspace = await workspaceService.getWorkspace(businessId);
    const previousProductionId = workspace.productionVersionId;

    if (previousProductionId) {
      await prisma.aiTrainingVersion.update({
        where: { id: previousProductionId },
        data: { status: 'ARCHIVED' },
      });
    }

    await prisma.aiTrainingVersion.update({
      where: { id: versionId },
      data: { status: 'PRODUCTION' },
    });

    await workspaceService.updateWorkspaceMetrics(businessId, {
      productionVersionId: versionId,
      sandboxVersionId: versionId,
      aiReadinessScore: audit.validationScore ?? version.readinessScore ?? undefined,
      knowledgeScore: version.knowledgeScore ?? undefined,
      confidenceScore: version.confidenceScore ?? undefined,
    });

    invalidateKnowledgeCache(businessId);

    const request = await prisma.aiDeploymentRequest.create({
      data: {
        businessId,
        versionId,
        status: 'DEPLOYED',
        requestedByUserId: audit.userId,
        approvedByUserId: audit.userId,
        deployedAt: new Date(),
        reviewedAt: new Date(),
        knowledgeScore: version.knowledgeScore,
        confidenceScore: version.confidenceScore,
        readinessScore: version.readinessScore,
        deploymentSummary: `Auto-deployed after validation score ${audit.validationScore ?? 'N/A'}`,
      },
    });

    await recordAiTrainingAudit(
      { ...audit, businessId, versionId },
      'DEPLOYMENT_PUBLISHED',
      {
        entity: 'AiDeploymentRequest',
        entityId: request.id,
        oldData: { productionVersionId: previousProductionId },
        newData: { productionVersionId: versionId, autoDeployed: true },
      }
    );

    await createNotification({
      businessId,
      userId: audit.userId ?? undefined,
      type: 'AI_TRAINING_COMPLETE',
      title: 'AI deployed to production',
      message: `Version ${version.versionNumber} passed validation and was automatically deployed.`,
      data: { versionId, versionNumber: version.versionNumber },
    });

    return request;
  }
}

export const deploymentService = new DeploymentService();
