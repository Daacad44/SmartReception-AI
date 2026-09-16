import type { CampaignMessageType } from '@prisma/client';
import type { OutboundMessageType } from '../../infrastructure/whatsapp/whatsapp.types';
import {
  isMetaTemplateSlug,
  normalizeWhatsAppTemplateLanguage,
} from '../../infrastructure/whatsapp/whatsapp-template-language.util';
import {
  extractTemplateVariables,
  personalizeCampaignMessage,
  type PersonalizationContext,
} from './campaign-personalization.service';

export type CampaignSessionTemplate = {
  name: string;
  content: string;
  variables: string[];
  whatsappTemplateName: string | null;
  whatsappTemplateLanguage: string | null;
};

export type CampaignReengagementTemplate = {
  name: string | null;
  language: string | null;
  hasBodyVariable: boolean;
};

export type ResolvedCampaignOutbound = {
  type: OutboundMessageType;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
  skipReason?: string;
};

const MEDIA_TYPES = new Set<CampaignMessageType>(['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO']);

function buildMetaBodyParameters(
  template: { content: string; variables: string[] },
  ctx: PersonalizationContext
): Array<{ type: 'text'; text: string }> {
  const variableKeys =
    template.variables.length > 0 ? template.variables : extractTemplateVariables(template.content);

  if (variableKeys.length === 0) {
    const full = personalizeCampaignMessage(template.content, ctx);
    return [{ type: 'text', text: full.slice(0, 1024) }];
  }

  return variableKeys.map((key) => {
    const personalized = personalizeCampaignMessage(`{{${key}}}`, ctx);
    const text = personalized.startsWith('{{') ? '' : personalized;
    return { type: 'text' as const, text: text.slice(0, 1024) };
  });
}

function templateUsesBodyVariables(template: { variables: string[]; content: string }): boolean {
  if (template.variables.length > 0) return true;
  return extractTemplateVariables(template.content).length > 0;
}

/**
 * Open 24h session (or media campaigns) keep the original type.
 * Closed session TEXT/TEMPLATE falls back to a Meta template; otherwise skip.
 */
export function resolveCampaignSessionSend(input: {
  messageType: CampaignMessageType;
  sessionOpen: boolean;
  template: CampaignSessionTemplate | null;
  reengagement: CampaignReengagementTemplate | null;
  personalization: PersonalizationContext;
}): ResolvedCampaignOutbound {
  if (MEDIA_TYPES.has(input.messageType)) {
    return { type: input.messageType as OutboundMessageType };
  }

  if (input.sessionOpen) {
    return { type: 'TEXT' };
  }

  const metaTemplateName =
    input.template?.whatsappTemplateName ??
    (input.template && isMetaTemplateSlug(input.template.name) ? input.template.name.trim() : null) ??
    input.reengagement?.name ??
    null;

  if (!metaTemplateName) {
    return {
      type: 'TEXT',
      skipReason:
        'WhatsApp 24-hour session expired. Link a Meta template or configure Settings → WhatsApp → Re-engagement Template.',
    };
  }

  const language = normalizeWhatsAppTemplateLanguage(
    input.template?.whatsappTemplateLanguage ?? input.reengagement?.language ?? 'en'
  );

  const useBodyVariable = input.template?.whatsappTemplateName
    ? templateUsesBodyVariables(input.template)
    : (input.reengagement?.hasBodyVariable ?? false);

  const templateForParams = input.template ?? {
    content: input.personalization.customer.name,
    variables: [] as string[],
  };

  return {
    type: 'TEMPLATE',
    templateName: metaTemplateName,
    templateLanguage: language,
    templateComponents: useBodyVariable
      ? [{ type: 'body', parameters: buildMetaBodyParameters(templateForParams, input.personalization) }]
      : undefined,
  };
}
