import type {
  ParsedWebhookPayload,
  WhatsAppWebhookContact,
  WhatsAppWebhookMessage,
  WhatsAppWebhookStatus,
} from './whatsapp.types';

export function parseWebhookBody(body: Record<string, unknown>): ParsedWebhookPayload {
  const result: ParsedWebhookPayload = {
    contacts: [],
    messages: [],
    statuses: [],
  };

  const entries = (body.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    for (const change of changes) {
      const value = (change.value as Record<string, unknown>) ?? {};
      const metadata = value.metadata as Record<string, string> | undefined;

      if (metadata?.phone_number_id) {
        result.phoneNumberId = metadata.phone_number_id;
        result.displayPhoneNumber = metadata.display_phone_number;
      }

      const incomingContacts = value.contacts as WhatsAppWebhookContact[] | undefined;
      if (incomingContacts?.length) {
        result.contacts.push(...incomingContacts);
      }

      const incomingMessages = value.messages as WhatsAppWebhookMessage[] | undefined;
      if (incomingMessages?.length) {
        result.messages.push(...incomingMessages);
      }

      const statuses = value.statuses as WhatsAppWebhookStatus[] | undefined;
      if (statuses?.length) {
        result.statuses.push(...statuses);
      }
    }
  }

  return result;
}

export function resolveContactName(
  contacts: WhatsAppWebhookContact[],
  senderPhone: string
): string | undefined {
  const normalizedSender = senderPhone.replace(/\D/g, '');
  const match = contacts.find((contact) => {
    const waId = contact.wa_id?.replace(/\D/g, '');
    return waId === normalizedSender;
  });

  return (
    match?.profile?.name ??
    match?.name?.formatted_name ??
    match?.name?.first_name ??
    undefined
  );
}

export function extractMessageContent(msg: WhatsAppWebhookMessage): {
  content: string;
  type: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  metadata?: Record<string, unknown>;
} {
  switch (msg.type) {
    case 'text':
      return { content: msg.text?.body ?? '', type: 'TEXT' };
    case 'image':
      return {
        content: msg.image?.caption ?? '[Image]',
        type: 'IMAGE',
        mediaId: msg.image?.id,
        mimeType: msg.image?.mime_type,
        caption: msg.image?.caption,
      };
    case 'video':
      return {
        content: msg.video?.caption ?? '[Video]',
        type: 'VIDEO',
        mediaId: msg.video?.id,
        mimeType: msg.video?.mime_type,
        caption: msg.video?.caption,
      };
    case 'audio':
      return {
        content: '[Audio message]',
        type: 'AUDIO',
        mediaId: msg.audio?.id,
        mimeType: msg.audio?.mime_type,
      };
    case 'document':
      return {
        content: msg.document?.caption ?? msg.document?.filename ?? '[Document]',
        type: 'DOCUMENT',
        mediaId: msg.document?.id,
        mimeType: msg.document?.mime_type,
        filename: msg.document?.filename,
        caption: msg.document?.caption,
      };
    case 'sticker':
      return {
        content: '[Sticker]',
        type: 'IMAGE',
        mediaId: msg.sticker?.id,
        mimeType: msg.sticker?.mime_type,
      };
    case 'location':
      return {
        content: msg.location?.name ?? msg.location?.address ?? 'Shared location',
        type: 'TEXT',
        metadata: {
          latitude: msg.location?.latitude,
          longitude: msg.location?.longitude,
          locationName: msg.location?.name,
          locationAddress: msg.location?.address,
        },
      };
    case 'contacts':
      return {
        content: formatContacts(msg.contacts ?? []),
        type: 'TEXT',
        metadata: { contacts: msg.contacts },
      };
    case 'interactive':
      if (msg.interactive?.button_reply) {
        return {
          content: msg.interactive.button_reply.title,
          type: 'INTERACTIVE',
          metadata: { buttonReply: msg.interactive.button_reply },
        };
      }
      if (msg.interactive?.list_reply) {
        return {
          content: msg.interactive.list_reply.title,
          type: 'INTERACTIVE',
          metadata: { listReply: msg.interactive.list_reply },
        };
      }
      return { content: '[Interactive message]', type: 'INTERACTIVE' };
    case 'button':
      return {
        content: msg.button?.text ?? msg.button?.payload ?? '[Button reply]',
        type: 'INTERACTIVE',
        metadata: { button: msg.button },
      };
    default:
      return { content: `[${msg.type} message]`, type: 'TEXT', metadata: { rawType: msg.type } };
  }
}

function formatContacts(contacts: WhatsAppWebhookMessage['contacts']): string {
  if (!contacts?.length) return '[Contact]';
  return contacts
    .map((c) => c.name?.formatted_name ?? c.name?.first_name ?? 'Contact')
    .join(', ');
}
