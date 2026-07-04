import crypto from 'crypto';
import { prisma } from '../../infrastructure/database/prisma';
import { storageService } from '../../infrastructure/storage';
import { emailService } from '../../infrastructure/email/email.service';
import { createNotification } from '../../infrastructure/notifications/notification-helper';
import { config } from '../../config';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors';
import type { Prisma, GovernanceActionType as PrismaGovernanceActionType } from '@prisma/client';
import {
  GOVERNANCE_ACTIVATION_TTL_MS,
} from '@smartreception/shared';
import type { GovernanceActionType } from '@smartreception/shared';
import { getGovernanceCapabilities } from './plan-capabilities.service';
import {
  executeGovernanceAction,
  sanitizePayloadForStorage,
} from './governance-executor.service';
import { parseDeviceLabel, recordGovernanceAudit } from './governance-audit.service';
import * as templates from '../../infrastructure/email/templates';

const ACTION_LABELS: Record<string, string> = {
  AI_UPLOAD_DOCUMENT: 'Upload AI document',
  AI_DELETE_DOCUMENT: 'Delete AI document',
  AI_CREATE_FAQ: 'Create FAQ',
  AI_UPDATE_FAQ: 'Update FAQ',
  AI_DELETE_FAQ: 'Delete FAQ',
  AI_CLEAR_KNOWLEDGE: 'Clear AI knowledge base',
  AI_UPDATE_PROFILE: 'Update business profile',
  AI_UPLOAD_PROFILE_PDF: 'Upload business profile PDF',
  AI_DELETE_PROFILE_PDF: 'Delete business profile PDF',
  AI_CLEAR_PROFILE: 'Clear business profile',
  AI_REINDEX: 'Re-index AI knowledge',
  AI_RESET_MEMORY: 'Reset AI memory',
  AI_DELETE_EMBEDDINGS: 'Delete AI embeddings',
  WHATSAPP_CONNECT: 'Connect WhatsApp',
  WHATSAPP_DISCONNECT: 'Disconnect WhatsApp',
};

function generateActivationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashActivationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function isAiAction(actionType: GovernanceActionType): boolean {
  return actionType.startsWith('AI_');
}

function isWhatsAppAction(actionType: GovernanceActionType): boolean {
  return actionType.startsWith('WHATSAPP_');
}

export interface GovernanceContext {
  businessId: string;
  userId: string;
  isSuperAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateGovernanceRequestInput {
  actionType: GovernanceActionType;
  payload: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  file?: Express.Multer.File;
}

function serializeRequest(request: {
  id: string;
  businessId: string;
  actionType: string;
  status: string;
  payload: unknown;
  createdAt: Date;
  approvedAt: Date | null;
  activationCodeExpiresAt: Date | null;
  executedAt: Date | null;
  rejectionReason: string | null;
  requester?: { id: string; email: string; firstName: string; lastName: string };
  business?: { id: string; name: string };
}) {
  return {
    id: request.id,
    businessId: request.businessId,
    businessName: request.business?.name,
    actionType: request.actionType,
    actionLabel: ACTION_LABELS[request.actionType] ?? request.actionType,
    status: request.status,
    payload:
      request.actionType === 'WHATSAPP_CONNECT'
        ? { ...(request.payload as object), accessToken: '[REDACTED]' }
        : request.payload,
    createdAt: request.createdAt,
    approvedAt: request.approvedAt,
    activationCodeExpiresAt: request.activationCodeExpiresAt,
    executedAt: request.executedAt,
    rejectionReason: request.rejectionReason,
    requester: request.requester,
  };
}

export class GovernanceService {
  async getCapabilities(businessId: string) {
    return getGovernanceCapabilities(businessId);
  }

  async guardAction(
    ctx: GovernanceContext,
    input: CreateGovernanceRequestInput
  ): Promise<{ proceed: true } | { proceed: false; request: ReturnType<typeof serializeRequest> }> {
    if (ctx.isSuperAdmin) {
      return { proceed: true };
    }

    const caps = await getGovernanceCapabilities(ctx.businessId);

    if (isAiAction(input.actionType) && caps.aiTrainingAccess === 'readonly') {
      throw new ForbiddenError(
        'AI Training is read-only on your plan. Contact your Super Administrator to make changes.'
      );
    }

    if (isWhatsAppAction(input.actionType) && caps.whatsappAccess === 'hidden') {
      throw new ForbiddenError(
        'WhatsApp configuration is managed by your Super Administrator on your plan.'
      );
    }

    if (
      (isAiAction(input.actionType) && caps.aiTrainingAccess === 'approval_required') ||
      (isWhatsAppAction(input.actionType) && caps.whatsappAccess === 'approval_required')
    ) {
      const request = await this.createRequest(ctx, input);
      return { proceed: false, request };
    }

    return { proceed: true };
  }

  async createRequest(ctx: GovernanceContext, input: CreateGovernanceRequestInput) {
    const pending = await prisma.governanceApprovalRequest.findFirst({
      where: {
        businessId: ctx.businessId,
        requesterUserId: ctx.userId,
        actionType: input.actionType as PrismaGovernanceActionType,
        status: 'PENDING',
      },
    });

    if (pending) {
      throw new ConflictError(
        'You already have a pending approval request for this action. Wait for administrator review.'
      );
    }

    let stagingStorageKey: string | undefined;
    let stagingMimeType: string | undefined;
    let stagingFilename: string | undefined;

    if (input.file?.buffer?.length) {
      const staged = await storageService.upload(
        input.file.buffer,
        input.file.originalname,
        input.file.mimetype || 'application/octet-stream',
        `governance-staging/${ctx.businessId}`
      );
      stagingStorageKey = staged.url.includes('http') ? staged.url : staged.key;
      stagingMimeType = input.file.mimetype;
      stagingFilename = input.file.originalname;
    }

    const request = await prisma.governanceApprovalRequest.create({
      data: {
        businessId: ctx.businessId,
        requesterUserId: ctx.userId,
        actionType: input.actionType as PrismaGovernanceActionType,
        payload: sanitizePayloadForStorage(
          input.actionType as PrismaGovernanceActionType,
          input.payload
        ) as Prisma.InputJsonValue,
        previousData: input.previousData as Prisma.InputJsonValue | undefined,
        stagingStorageKey,
        stagingMimeType,
        stagingFilename,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        deviceLabel: parseDeviceLabel(ctx.userAgent),
      },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    await recordGovernanceAudit({
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: 'GOVERNANCE_REQUEST',
      entity: 'GovernanceApprovalRequest',
      entityId: request.id,
      newData: {
        actionType: input.actionType,
        status: 'PENDING',
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      approvalStatus: 'PENDING',
    });

    await this.notifySuperAdminsOfNewRequest({
      id: request.id,
      businessId: request.businessId,
      actionType: request.actionType,
      business: request.business,
      requester: request.requester,
    });

    return serializeRequest(request);
  }

  private async notifySuperAdminsOfNewRequest(request: {
    id: string;
    businessId: string;
    actionType: string;
    business: { name: string };
    requester: { firstName: string; lastName: string; email: string };
  }) {
    const superAdmins = await prisma.user.findMany({
      where: { isSuperAdmin: true, isActive: true },
      select: { id: true, email: true, firstName: true },
    });

    const actionLabel = ACTION_LABELS[request.actionType] ?? request.actionType;
    const requesterName = `${request.requester.firstName} ${request.requester.lastName}`.trim();

    for (const admin of superAdmins) {
      await createNotification({
        businessId: request.businessId,
        userId: admin.id,
        type: 'GOVERNANCE_APPROVAL',
        title: 'Governance approval required',
        message: `${request.business.name}: ${requesterName} requested "${actionLabel}"`,
        data: { requestId: request.id, actionType: request.actionType },
      });

      const { subject, html } = templates.governanceApprovalRequestEmail({
        firstName: admin.firstName,
        businessName: request.business.name,
        requesterName,
        actionLabel,
        reviewUrl: `${config.frontendUrl}/admin/governance`,
      });
      await emailService.send(admin.email, subject, html).catch(() => undefined);
    }
  }

  async listBusinessRequests(businessId: string, userId: string) {
    const requests = await prisma.governanceApprovalRequest.findMany({
      where: { businessId, requesterUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    return requests.map(serializeRequest);
  }

  async getRequest(businessId: string, requestId: string, userId: string) {
    const request = await prisma.governanceApprovalRequest.findFirst({
      where: { id: requestId, businessId },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    if (!request) throw new NotFoundError('Approval request not found');
    if (request.requesterUserId !== userId) {
      throw new ForbiddenError('You can only view your own approval requests');
    }

    return serializeRequest(request);
  }

  async activateRequest(
    businessId: string,
    requestId: string,
    userId: string,
    code: string,
    ctx: Pick<GovernanceContext, 'ipAddress' | 'userAgent'>
  ) {
    const request = await prisma.governanceApprovalRequest.findFirst({
      where: { id: requestId, businessId },
    });

    if (!request) throw new NotFoundError('Approval request not found');
    if (request.requesterUserId !== userId) {
      throw new ForbiddenError('You can only activate your own approval requests');
    }
    if (request.status !== 'APPROVED') {
      throw new ValidationError('This request is not approved yet');
    }
    if (request.activationCodeUsedAt) {
      throw new ValidationError('This activation code has already been used');
    }
    if (!request.activationCodeHash || !request.activationCodeExpiresAt) {
      throw new ValidationError('No activation code is available for this request');
    }
    if (request.activationCodeExpiresAt.getTime() < Date.now()) {
      await prisma.governanceApprovalRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('Activation code has expired. Submit a new request.');
    }

    const codeHash = hashActivationCode(code.trim());
    if (codeHash !== request.activationCodeHash) {
      throw new ValidationError('Invalid activation code');
    }

    const executionResult = await executeGovernanceAction(request, userId);

    const updated = await prisma.governanceApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACTIVATED',
        activationCodeUsedAt: new Date(),
        executedAt: new Date(),
        executionResult: executionResult as object,
      },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    await recordGovernanceAudit({
      businessId,
      userId,
      action: 'GOVERNANCE_ACTIVATE',
      entity: 'GovernanceApprovalRequest',
      entityId: requestId,
      newData: {
        actionType: request.actionType,
        status: 'ACTIVATED',
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      approvalCode: code,
      approvalStatus: 'ACTIVATED',
    });

    return { request: serializeRequest(updated), result: executionResult };
  }

  async listAllRequests(params: {
    status?: string;
    businessId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.status ? { status: params.status as 'PENDING' } : {}),
      ...(params.businessId ? { businessId: params.businessId } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.governanceApprovalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          business: { select: { id: true, name: true } },
          approver: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.governanceApprovalRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => ({
        ...serializeRequest(r),
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        deviceLabel: r.deviceLabel,
        approver: r.approver,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async approveRequest(
    requestId: string,
    superAdminId: string,
    ctx: Pick<GovernanceContext, 'ipAddress' | 'userAgent'>
  ) {
    const request = await prisma.governanceApprovalRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    if (!request) throw new NotFoundError('Approval request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictError('Only pending requests can be approved');
    }

    const activationCode = generateActivationCode();
    const expiresAt = new Date(Date.now() + GOVERNANCE_ACTIVATION_TTL_MS);

    const updated = await prisma.governanceApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByUserId: superAdminId,
        approvedAt: new Date(),
        activationCodeHash: hashActivationCode(activationCode),
        activationCodeExpiresAt: expiresAt,
      },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    await recordGovernanceAudit({
      businessId: request.businessId,
      userId: superAdminId,
      action: 'GOVERNANCE_APPROVE',
      entity: 'GovernanceApprovalRequest',
      entityId: requestId,
      newData: { status: 'APPROVED', actionType: request.actionType },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      approvalStatus: 'APPROVED',
    });

    await createNotification({
      businessId: request.businessId,
      userId: request.requesterUserId,
      type: 'GOVERNANCE_APPROVAL',
      title: 'Approval granted',
      message: `Your "${ACTION_LABELS[request.actionType] ?? request.actionType}" request was approved. Enter your activation code to continue.`,
      data: { requestId, status: 'APPROVED' },
    });

    const { subject, html } = templates.governanceActivationCodeEmail({
      firstName: request.requester.firstName,
      businessName: request.business.name,
      actionLabel: ACTION_LABELS[request.actionType] ?? request.actionType,
      code: activationCode,
      expiryMinutes: 10,
      activateUrl: `${config.frontendUrl}/ai-training?request=${requestId}`,
    });
    await emailService.send(request.requester.email, subject, html).catch(() => undefined);

    return serializeRequest(updated);
  }

  async rejectRequest(
    requestId: string,
    superAdminId: string,
    reason: string | undefined,
    ctx: Pick<GovernanceContext, 'ipAddress' | 'userAgent'>
  ) {
    const request = await prisma.governanceApprovalRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    if (!request) throw new NotFoundError('Approval request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictError('Only pending requests can be rejected');
    }

    if (request.stagingStorageKey) {
      try {
        await storageService.delete(request.stagingStorageKey);
      } catch {
        // Best-effort cleanup
      }
    }

    const updated = await prisma.governanceApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedByUserId: superAdminId,
        rejectedAt: new Date(),
        rejectionReason: reason ?? 'Rejected by administrator',
      },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        business: { select: { id: true, name: true } },
      },
    });

    await recordGovernanceAudit({
      businessId: request.businessId,
      userId: superAdminId,
      action: 'GOVERNANCE_REJECT',
      entity: 'GovernanceApprovalRequest',
      entityId: requestId,
      newData: { status: 'REJECTED', reason },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      approvalStatus: 'REJECTED',
    });

    await createNotification({
      businessId: request.businessId,
      userId: request.requesterUserId,
      type: 'GOVERNANCE_APPROVAL',
      title: 'Request rejected',
      message: `Your "${ACTION_LABELS[request.actionType] ?? request.actionType}" request was rejected.`,
      data: { requestId, status: 'REJECTED', reason },
    });

    return serializeRequest(updated);
  }

  async expireStaleApprovals(): Promise<number> {
    const result = await prisma.governanceApprovalRequest.updateMany({
      where: {
        status: 'APPROVED',
        activationCodeExpiresAt: { lt: new Date() },
        activationCodeUsedAt: null,
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }
}

export const governanceService = new GovernanceService();

export function buildGovernanceContext(req: {
  user?: { businessId?: string; userId: string; isSuperAdmin?: boolean };
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): GovernanceContext {
  return {
    businessId: req.user!.businessId!,
    userId: req.user!.userId,
    isSuperAdmin: req.user!.isSuperAdmin ?? false,
    ipAddress: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}
