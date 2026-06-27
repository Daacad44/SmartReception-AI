import { prisma } from '../../infrastructure/database/prisma';

/** WhatsApp Cloud API customer care session window (free-form messages). */
export const WHATSAPP_SESSION_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppSessionWindow {
  isOpen: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
  remainingHours: number;
}

export async function getWhatsAppSessionWindow(
  conversationId: string,
  customerId?: string
): Promise<WhatsAppSessionWindow> {
  // Session is per customer phone on WhatsApp — use latest inbound across all
  // conversations for this customer (handles duplicate customer/conversation records).
  const lastInbound = await prisma.message.findFirst({
    where: customerId
      ? { direction: 'INBOUND', conversation: { customerId } }
      : { conversationId, direction: 'INBOUND' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (!lastInbound) {
    return {
      isOpen: false,
      lastInboundAt: null,
      expiresAt: null,
      remainingMs: 0,
      remainingHours: 0,
    };
  }

  const lastInboundAt = lastInbound.createdAt;
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
