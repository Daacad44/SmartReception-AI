import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { messageTemplatesService } from '../message-templates/message-templates.service';
import {
  extractTemplateVariables,
  personalizeCampaignMessage,
} from '../campaigns/campaign-personalization.service';
import { getWhatsAppSessionWindow } from './whatsapp-session.service';
import type { OutboundMessageType } from '../../infrastructure/whatsapp/whatsapp.types';
import {
  isMetaTemplateSlug,
  normalizeWhatsAppTemplateLanguage,
} from '../../infrastructure/whatsapp/whatsapp-template-language.util';
import {
  fetchMetaMessageTemplates,
  findMetaTemplateOnWaba,
  formatMetaTemplateValidationError,
} from '../../infrastructure/whatsapp/whatsapp-meta-templates.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';

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
  customer: {
    name: string;
    phone: string;
    email: string | null;
    companyName: string | null;
    city: string | null;
    country: string | null;
  },
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

function templateUsesBodyVariables(template: {
  variables: string[];
  content: string;
}): boolean {
  if (template.variables.length > 0) return true;
  return extractTemplateVariables(template.content).length > 0;
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
        wabaId: true,
        accessToken: true,
        reengagementTemplateName: true,
        reengagementTemplateLanguage: true,
        reengagementTemplateHasBodyVariable: true,
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
      template.whatsappTemplateName ??
      (isMetaTemplateSlug(template.name) ? template.name.trim() : null) ??
      whatsappAccount?.reengagementTemplateName ??
      null;
    let metaTemplateLanguage = normalizeWhatsAppTemplateLanguage(
      template.whatsappTemplateLanguage ??
        whatsappAccount?.reengagementTemplateLanguage ??
        'en'
    );

    if (!metaTemplateName) {
      throw new ValidationError(
        'Link this template to a Meta template name, or configure Settings → WhatsApp → Re-engagement Template.'
      );
    }

    const useBodyVariable = template.whatsappTemplateName
      ? templateUsesBodyVariables(template)
      : (whatsappAccount?.reengagementTemplateHasBodyVariable ?? false);

    const templateComponents = useBodyVariable
      ? [
          {
            type: 'body',
            parameters: buildMetaBodyParameters(template, customer, businessName),
          },
        ]
      : undefined;

    const accessToken = resolveStoredToken(whatsappAccount?.accessToken);
    const wabaId = whatsappAccount?.wabaId?.trim();
    if (accessToken && wabaId) {
      try {
        const metaTemplates = await fetchMetaMessageTemplates(wabaId, accessToken);
        const lookup = findMetaTemplateOnWaba(metaTemplates, metaTemplateName, metaTemplateLanguage);
        if (!lookup.found) {
          throw new ValidationError(
            formatMetaTemplateValidationError({
              templateName: metaTemplateName,
              templateLanguage: metaTemplateLanguage,
              wabaId,
              lookup,
              approvedTemplates: metaTemplates,
            })
          );
        }
        if (lookup.match && lookup.match.language !== metaTemplateLanguage) {
          metaTemplateLanguage = lookup.match.language;
        }
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        // If Meta template list is unavailable, still attempt send and surface Graph API error.
      }
    }

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
