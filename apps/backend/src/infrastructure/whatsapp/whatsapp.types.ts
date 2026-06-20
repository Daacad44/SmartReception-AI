export interface WhatsAppWebhookText {
  body: string;
}

export interface WhatsAppWebhookMedia {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface WhatsAppWebhookLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppWebhookContact {
  name?: { formatted_name?: string; first_name?: string };
  phones?: Array<{ phone?: string; type?: string }>;
}

export interface WhatsAppWebhookInteractive {
  type: string;
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: WhatsAppWebhookText;
  image?: WhatsAppWebhookMedia;
  video?: WhatsAppWebhookMedia;
  audio?: WhatsAppWebhookMedia;
  document?: WhatsAppWebhookMedia;
  sticker?: WhatsAppWebhookMedia;
  location?: WhatsAppWebhookLocation;
  contacts?: WhatsAppWebhookContact[];
  interactive?: WhatsAppWebhookInteractive;
  button?: { text: string; payload: string };
}

export interface WhatsAppWebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

export interface ParsedWebhookPayload {
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  messages: WhatsAppWebhookMessage[];
  statuses: WhatsAppWebhookStatus[];
}

export type OutboundMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'AUDIO'
  | 'VIDEO'
  | 'TEMPLATE'
  | 'INTERACTIVE';

export interface SendOutboundParams {
  phoneNumberId: string;
  to: string;
  accessToken?: string;
  type: OutboundMessageType;
  content: string;
  mediaUrl?: string;
  mediaFilename?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
  interactiveBody?: string;
  interactiveButtons?: Array<{ id: string; title: string }>;
  interactiveListSections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}
