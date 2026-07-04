import type { AIConfiguration, Business, KnowledgeBase, WhatsAppAccount } from '@prisma/client';

export interface WebhookMetadata {
  phone_number_id?: string;
  display_phone_number?: string;
}

export interface InboundWhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

/** Fully resolved tenant context for a single incoming WhatsApp webhook. */
export interface WhatsAppTenantContext {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  senderPhone: string;
  account: WhatsAppAccount & { business: Business };
  business: Business;
  businessId: string;
  accessToken: string;
  aiConfiguration: AIConfiguration;
  knowledgeBase: KnowledgeBase | null;
}

export type WebhookProcessResult =
  | { status: 'processed'; messagesHandled: number }
  | { status: 'ignored'; reason: string }
  | { status: 'not_found'; phoneNumberId: string };
