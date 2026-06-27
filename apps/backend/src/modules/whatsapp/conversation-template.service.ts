import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { messageTemplatesService } from '../message-templates/message-templates.service';
import {
  extractTemplateVariables,
  personalizeCampaignMessage,
} from '../campaigns/campaign-personalization.service';
import { getWhatsAppSessionWindow } from './whatsapp-session.service';
import type { OutboundMessageType } from '../../infrastructure/whatsapp/whatsapp.types';

export type ResolvedConversationTemplate = {
  content: string;
  messageType: OutboundMessageType;
  templateId: string;
  templateName: string;
  templateNameMeta?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
};

function buildMetaBodyParameters(
  template: { content: string; variables: string[] },
  customer: { name: string; phone: string; email: string | null; companyName: string | null; city: string | null; country: string | null },
  businessName: string
): Array<{ type: 'text'; text: string }> {
  const variableKeys =
    template.variables.length > 0 ? template.variables : extractTemplateVariables(template.content);

  if (variableKeys.length === 0) {
    const full = personalizeCampaignMessage(template.content, { businessName, customer });
    return [{ type: 'text', text: full.slice(0, 1024) }];
  }

  return variableKeys.map((key) => {
    const personalized = personalizeCampaignMessage(`{{${key}}}`, { businessName, customer });
    const text = personalized.startsWith('{{') ? '' : personalized;
    return { type: 'text' as const, text: text.slice(0, 1024) };
  });
}

export async function resolveConversationTemplateSend(params: {
  businessId: string;
  conversationId: string;
  customerId: string;
  templateId: string;
  whatsappAccountId: string;
}): Promise<ResolvedConversationTemplate> {
  const template = await messageTemplatesService.get(params.businessId, params.templateId);

  const [customer, business, sessionWindow, whatsappAccount] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: params.customerId, businessId: params.businessId },
    }),
    prisma.business.findUnique({
      where: { id: params.businessId },
      select: { name: true },
    }),
    getWhatsAppSessionWindow(params.conversationId, params.customerId),
    prisma.whatsAppAccount.findFirst({
      where: { id: params.whatsappAccountId, businessId: params.businessId },
      select: {
        reengagementTemplateName: true,
        reengagementTemplateLanguage: true,
      },
    }),
  ]);

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const businessName = business?.name ?? '';
  const content = personalizeCampaignMessage(template.content, { businessName, customer });

  if (!sessionWindow.isOpen) {
    const metaTemplateName =
      template.whatsappTemplateName ?? whatsappAccount?.reengagementTemplateName ?? null;
    const metaTemplateLanguage =
      template.whatsappTemplateLanguage ??
      whatsappAccount?.reengagementTemplateLanguage ??
      'en';

    if (!metaTemplateName) {
      throw new ValidationError(
        'Configure a WhatsApp re-engagement template in Settings → WhatsApp. Meta-approved templates can be sent anytime, even after the 24-hour session expires.'
      );
    }

    const templateComponents = template.whatsappTemplateName
      ? [
          {
            type: 'body',
            parameters: buildMetaBodyParameters(template, customer, businessName),
          },
        ]
      : [
          {
            type: 'body',
            parameters: [{ type: 'text', text: content.slice(0, 1024) }],
          },
        ];

    return {
      content,
      messageType: 'TEMPLATE',
      templateId: template.id,
      templateName: template.name,
      templateNameMeta: metaTemplateName,
      templateLanguage: metaTemplateLanguage,
      templateComponents,
    };
  }

  return {
    content,
    messageType: 'TEXT',
    templateId: template.id,
    templateName: template.name,
  };
}
