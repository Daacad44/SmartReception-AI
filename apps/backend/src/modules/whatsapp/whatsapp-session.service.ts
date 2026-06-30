import { prisma } from '../../infrastructure/database/prisma';
import { findCustomerIdsByPhoneDigits } from '../../core/utils/customer-phone';

/** WhatsApp Cloud API customer care session window (free-form messages). */
export const WHATSAPP_SESSION_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppSessionWindow {
  isOpen: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
  remainingHours: number;
}

type InboundAnchor = {
  at: Date;
  source: 'customer_field' | 'message_meta' | 'message_created';
};

/** Resolve inbound time from Meta webhook metadata or DB timestamps. */
export function resolveInboundTimestamp(
  metadata: unknown,
  createdAt: Date = new Date()
): Date {
  if (!metadata || typeof metadata !== 'object') return createdAt;
  const raw = (metadata as Record<string, unknown>).whatsappTimestamp;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    return new Date(Number(raw) * 1000);
  }
  if (typeof raw === 'number' && raw > 0) {
    return new Date(raw > 1e12 ? raw : raw * 1000);
  }
  return createdAt;
}

export function buildWhatsAppSessionWindow(lastInboundAt: Date | null): WhatsAppSessionWindow {
  if (!lastInboundAt) {
    return {
      isOpen: false,
      lastInboundAt: null,
      expiresAt: null,
      remainingMs: 0,
      remainingHours: 0,
    };
  }

  const expiresAt = new Date(lastInboundAt.getTime() + WHATSAPP_SESSION_MS);
  const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());

  return {
    isOpen: remainingMs > 0,
    lastInboundAt: lastInboundAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remainingMs,
    remainingHours: Math.ceil(remainingMs / (60 * 60 * 1000)),
  };
}

function pickLatestAnchor(anchors: InboundAnchor[]): Date | null {
  if (!anchors.length) return null;
  return anchors.reduce(
    (latest, anchor) => (anchor.at > latest ? anchor.at : latest),
    anchors[0].at
  );
}

async function resolveLatestInboundAnchor(
  conversationId: string,
  customerId?: string
): Promise<Date | null> {
  const anchors: InboundAnchor[] = [];

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
      select: { lastCustomerMessageAt: true, businessId: true, phone: true },
    });

    if (customer?.lastCustomerMessageAt) {
      anchors.push({ at: customer.lastCustomerMessageAt, source: 'customer_field' });
    }

    if (customer) {
      const relatedCustomerIds = await findCustomerIdsByPhoneDigits(
        customer.businessId,
        customer.phone
      );
      const customerIds = relatedCustomerIds.length ? relatedCustomerIds : [customerId];

      const relatedCustomers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { lastCustomerMessageAt: true },
      });
      for (const related of relatedCustomers) {
        if (related.lastCustomerMessageAt) {
          anchors.push({ at: related.lastCustomerMessageAt, source: 'customer_field' });
        }
      }

      const lastInbound = await prisma.message.findFirst({
        where: { direction: 'INBOUND', conversation: { customerId: { in: customerIds } } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, metadata: true },
      });

      if (lastInbound) {
        const metaAt = resolveInboundTimestamp(lastInbound.metadata, lastInbound.createdAt);
        anchors.push({
          at: metaAt,
          source:
            metaAt.getTime() !== lastInbound.createdAt.getTime()
              ? 'message_meta'
              : 'message_created',
        });
      }
    }
  } else {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastCustomerMessageAt: true },
    });
    if (conversation?.lastCustomerMessageAt) {
      anchors.push({ at: conversation.lastCustomerMessageAt, source: 'customer_field' });
    }

    const lastInbound = await prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true },
    });

    if (lastInbound) {
      const metaAt = resolveInboundTimestamp(lastInbound.metadata, lastInbound.createdAt);
      anchors.push({
        at: metaAt,
        source:
          metaAt.getTime() !== lastInbound.createdAt.getTime() ? 'message_meta' : 'message_created',
      });
    }
  }

  return pickLatestAnchor(anchors);
}

export async function getWhatsAppSessionWindow(
  conversationId: string,
  customerId?: string
): Promise<WhatsAppSessionWindow> {
  const lastInboundAt = await resolveLatestInboundAnchor(conversationId, customerId);
  return buildWhatsAppSessionWindow(lastInboundAt);
}

export function formatSessionExpiryMessage(window: WhatsAppSessionWindow): string {
  if (!window.lastInboundAt) {
    return 'This customer has not sent a WhatsApp message yet. They must message you first before you can send free-form replies.';
  }
  if (window.isOpen) {
    return '';
  }
  const expiredAt = window.expiresAt
    ? new Date(window.expiresAt).toLocaleString()
    : 'over 24 hours ago';
  return `The 24-hour WhatsApp session has expired (last customer message was before ${expiredAt}). The customer must send a new message before you can reply with free-form text, or use an approved template message.`;
}

/** Meta error codes that indicate session / re-engagement issues. */
export const WHATSAPP_SESSION_ERROR_CODES = new Set([131047, 131026]);

export function parseWhatsAppDeliveryError(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const meta = metadata as Record<string, unknown>;

  const graphError = meta.graphApiError as { code?: number | string; message?: string } | undefined;
  if (graphError?.code && WHATSAPP_SESSION_ERROR_CODES.has(Number(graphError.code))) {
    return graphError.message ?? 'WhatsApp session expired (24-hour window)';
  }

  const deliveryErrors = meta.deliveryErrors as
    | Array<{ code?: number; message?: string; error_data?: { details?: string } }>
    | undefined;
  const first = deliveryErrors?.[0];
  if (first?.code && WHATSAPP_SESSION_ERROR_CODES.has(first.code)) {
    return (
      first.error_data?.details ??
      first.message ??
      'WhatsApp session expired (24-hour window)'
    );
  }

  if (graphError?.message) return graphError.message;
  if (first?.error_data?.details) return first.error_data.details;
  if (first?.message) return first.message;

  return null;
}
