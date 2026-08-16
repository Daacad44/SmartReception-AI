import { prisma } from '../../infrastructure/database/prisma';
import { emailService } from '../../infrastructure/email/email.service';
import { createNotification } from '../../infrastructure/notifications/notification-helper';
import { config } from '../../config';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import * as templates from '../../infrastructure/email/templates';
import type { WhatsAppConnectionRequest, WhatsAppConnectionRequestStatus } from '@prisma/client';

// Presets the Super Admin can approve with, plus custom exact datetime support.
const MAX_WINDOW_MINUTES = 60 * 24 * 30; // 30 days ceiling as a sanity bound
const MIN_WINDOW_MINUTES = 5;

export interface ApproveWindowInput {
  windowMinutes?: number;
  windowExpiresAt?: string | Date;
}

function isWindowOpen(request: {
  status: WhatsAppConnectionRequestStatus;
  windowExpiresAt: Date | null;
  connectedAt: Date | null;
}): boolean {
  return (
    request.status === 'APPROVED' &&
    request.connectedAt === null &&
    request.windowExpiresAt !== null &&
    request.windowExpiresAt.getTime() > Date.now()
  );
}

function serialize(request: WhatsAppConnectionRequest) {
  return {
    id: request.id,
    businessId: request.businessId,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    approvedAt: request.approvedAt ? request.approvedAt.toISOString() : null,
    windowExpiresAt: request.windowExpiresAt ? request.windowExpiresAt.toISOString() : null,
    rejectionReason: request.rejectionReason,
    connectedAt: request.connectedAt ? request.connectedAt.toISOString() : null,
    windowOpen: isWindowOpen(request),
  };
}

export class WhatsAppConnectionRequestService {
  /**
   * Business self-service: submit a request for a WhatsApp connection window.
   * One open request at a time; a business already connected does not need one.
   */
  async submitRequest(businessId: string, userId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, whatsappStatus: true },
    });
    if (!business) throw new NotFoundError('Business not found');
    if (business.whatsappStatus === 'CONNECTED') {
      throw new ConflictError('WhatsApp is already connected for this business.');
    }

    // Lazily settle any stale window before deciding whether a request is open.
    await this.expireStaleWindows(businessId);

    const open = await prisma.whatsAppConnectionRequest.findFirst({
      where: { businessId, status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (open) {
      if (open.status === 'PENDING') {
        throw new ConflictError('You already have a pending connection request awaiting review.');
      }
      if (isWindowOpen(open)) {
        throw new ConflictError('Your connection window is already open. Connect WhatsApp now.');
      }
    }

    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const request = await prisma.whatsAppConnectionRequest.create({
      data: { businessId, requesterUserId: userId },
    });

    await this.notifySuperAdmins(businessId, business.name, requester);

    return serialize(request);
  }

  private async notifySuperAdmins(
    businessId: string,
    businessName: string,
    requester: { firstName: string; lastName: string } | null
  ) {
    const superAdmins = await prisma.user.findMany({
      where: { isSuperAdmin: true, isActive: true },
      select: { id: true, email: true, firstName: true },
    });
    const requesterName = requester
      ? `${requester.firstName} ${requester.lastName}`.trim()
      : 'A business user';

    for (const admin of superAdmins) {
      await createNotification({
        businessId,
        userId: admin.id,
        type: 'GOVERNANCE_APPROVAL',
        title: 'WhatsApp connection request',
        message: `${businessName}: ${requesterName} requested a WhatsApp connection window`,
        data: { kind: 'WHATSAPP_CONNECTION_REQUEST', businessId },
      });

      const { subject, html } = templates.whatsappConnectionRequestEmail({
        firstName: admin.firstName,
        businessName,
        requesterName,
        reviewUrl: `${config.frontendUrl}/admin/whatsapp-requests`,
      });
      await emailService.send(admin.email, subject, html).catch(() => undefined);
    }
  }

  /** Business: latest request (used for the status panel). Settles stale first. */
  async getOwnLatest(businessId: string) {
    await this.expireStaleWindows(businessId);
    const request = await prisma.whatsAppConnectionRequest.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return request ? serialize(request) : null;
  }

  /**
   * Effective-access helper consumed by plan-capabilities. Returns whether the
   * full self-serve WhatsApp UI should be unlocked and the latest window snapshot.
   * `effectiveFull` is true when the business already self-connected (permanent)
   * or when an APPROVED window is currently open.
   */
  async getConnectionWindowState(
    businessId: string
  ): Promise<{ effectiveFull: boolean; window: ReturnType<typeof serialize> | null }> {
    await this.expireStaleWindows(businessId);

    const connected = await prisma.whatsAppConnectionRequest.findFirst({
      where: { businessId, status: 'CONNECTED' },
      orderBy: { connectedAt: 'desc' },
    });
    if (connected) {
      return { effectiveFull: true, window: serialize(connected) };
    }

    const latest = await prisma.whatsAppConnectionRequest.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return { effectiveFull: false, window: null };

    return { effectiveFull: isWindowOpen(latest), window: serialize(latest) };
  }

  /**
   * Called from whatsappModuleService.connectAccount once a business successfully
   * connects. Flips an open APPROVED window to CONNECTED (permanent). No-op when
   * there is no open window (e.g. admin/env connect).
   */
  async markConnected(businessId: string): Promise<void> {
    const open = await prisma.whatsAppConnectionRequest.findFirst({
      where: { businessId, status: 'APPROVED', connectedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!open) return;
    await prisma.whatsAppConnectionRequest.update({
      where: { id: open.id },
      data: { status: 'CONNECTED', connectedAt: new Date() },
    });
  }

  /** Super Admin: list requests, optionally filtered by status. */
  async listForAdmin(params: { status?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    // Best-effort settle before listing so admins see accurate EXPIRED states.
    await this.expireStaleWindows();

    const where = params.status
      ? { status: params.status as WhatsAppConnectionRequestStatus }
      : {};

    const [requests, total] = await Promise.all([
      prisma.whatsAppConnectionRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { firstName: true, lastName: true, email: true } },
          business: { select: { id: true, name: true } },
          approver: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.whatsAppConnectionRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => ({
        ...serialize(r),
        businessName: r.business?.name,
        requester: r.requester,
        approver: r.approver,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private resolveWindowExpiry(input: ApproveWindowInput): Date {
    if (input.windowExpiresAt) {
      const at = new Date(input.windowExpiresAt);
      if (Number.isNaN(at.getTime())) {
        throw new ValidationError('Invalid window expiry datetime');
      }
      const minutes = (at.getTime() - Date.now()) / 60000;
      if (minutes < MIN_WINDOW_MINUTES) {
        throw new ValidationError('Window expiry must be at least 5 minutes in the future');
      }
      if (minutes > MAX_WINDOW_MINUTES) {
        throw new ValidationError('Window expiry is too far in the future (max 30 days)');
      }
      return at;
    }
    const minutes = input.windowMinutes ?? 0;
    if (!Number.isFinite(minutes) || minutes < MIN_WINDOW_MINUTES) {
      throw new ValidationError('Provide windowMinutes (>= 5) or a windowExpiresAt datetime');
    }
    if (minutes > MAX_WINDOW_MINUTES) {
      throw new ValidationError('Window duration is too long (max 30 days)');
    }
    return new Date(Date.now() + minutes * 60000);
  }

  /** Super Admin: approve a PENDING request and open a time-boxed window. */
  async approve(requestId: string, superAdminId: string, input: ApproveWindowInput) {
    const request = await prisma.whatsAppConnectionRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { firstName: true, email: true } },
        business: { select: { name: true } },
      },
    });
    if (!request) throw new NotFoundError('Connection request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictError('Only pending requests can be approved');
    }

    const windowExpiresAt = this.resolveWindowExpiry(input);

    const updated = await prisma.whatsAppConnectionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByUserId: superAdminId,
        approvedAt: new Date(),
        windowExpiresAt,
      },
    });

    await createNotification({
      businessId: request.businessId,
      userId: request.requesterUserId,
      type: 'GOVERNANCE_APPROVAL',
      title: 'WhatsApp connection window open',
      message: `Your WhatsApp connection window is open until ${windowExpiresAt.toUTCString()}. Connect now to keep it permanently.`,
      data: { kind: 'WHATSAPP_CONNECTION_APPROVED', windowExpiresAt: windowExpiresAt.toISOString() },
    });

    const { subject, html } = templates.whatsappConnectionApprovedEmail({
      firstName: request.requester.firstName,
      businessName: request.business.name,
      windowExpiresAt,
      connectUrl: `${config.frontendUrl}/settings?tab=whatsapp`,
    });
    await emailService.send(request.requester.email, subject, html).catch(() => undefined);

    return serialize(updated);
  }

  /** Super Admin: reject a PENDING request with an optional reason. */
  async reject(requestId: string, superAdminId: string, reason?: string) {
    const request = await prisma.whatsAppConnectionRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { firstName: true, email: true } },
        business: { select: { name: true } },
      },
    });
    if (!request) throw new NotFoundError('Connection request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictError('Only pending requests can be rejected');
    }

    const rejectionReason = reason?.trim() || 'Rejected by administrator';

    const updated = await prisma.whatsAppConnectionRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedByUserId: superAdminId,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    await createNotification({
      businessId: request.businessId,
      userId: request.requesterUserId,
      type: 'GOVERNANCE_APPROVAL',
      title: 'WhatsApp connection request rejected',
      message: `Your WhatsApp connection request was rejected: ${rejectionReason}`,
      data: { kind: 'WHATSAPP_CONNECTION_REJECTED', reason: rejectionReason },
    });

    const { subject, html } = templates.whatsappConnectionRejectedEmail({
      firstName: request.requester.firstName,
      businessName: request.business.name,
      reason: rejectionReason,
      requestUrl: `${config.frontendUrl}/settings?tab=whatsapp`,
    });
    await emailService.send(request.requester.email, subject, html).catch(() => undefined);

    return serialize(updated);
  }

  /**
   * Flip APPROVED windows that have passed their expiry without connecting to
   * EXPIRED. Scoped to a single business when an id is given; otherwise global
   * (used by the worker sweep). Safe to call frequently.
   */
  async expireStaleWindows(businessId?: string): Promise<number> {
    const result = await prisma.whatsAppConnectionRequest.updateMany({
      where: {
        ...(businessId ? { businessId } : {}),
        status: 'APPROVED',
        connectedAt: null,
        windowExpiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }
}

export const whatsappConnectionRequestService = new WhatsAppConnectionRequestService();
