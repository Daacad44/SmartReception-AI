import { config } from '../../config';
import { logger } from '../../core/logger';
import { normalizeWhatsAppTemplateLanguage } from './whatsapp-template-language.util';

export interface MetaMessageTemplate {
  name: string;
  language: string;
  status: string;
  category?: string;
}

export interface MetaTemplateLookupResult {
  found: boolean;
  match?: MetaMessageTemplate;
  availableLanguages?: string[];
  approvedOnWaba: boolean;
}

export async function fetchMetaMessageTemplates(
  wabaId: string,
  accessToken: string
): Promise<MetaMessageTemplate[]> {
  const templates: MetaMessageTemplate[] = [];
  let url: string | null =
    `${config.whatsapp.apiUrl}/${wabaId}/message_templates?fields=name,language,status,category&limit=100`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn('[WhatsApp] Failed to list Meta message templates', {
        wabaId,
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new Error(`Could not load templates from Meta (HTTP ${response.status})`);
    }

    const data = (await response.json()) as {
      data?: MetaMessageTemplate[];
      paging?: { next?: string };
    };

    templates.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }

  return templates;
}

export function findMetaTemplateOnWaba(
  templates: MetaMessageTemplate[],
  templateName: string,
  templateLanguage: string
): MetaTemplateLookupResult {
  const name = templateName.trim();
  const normalizedLang = normalizeWhatsAppTemplateLanguage(templateLanguage);
  const sameName = templates.filter((template) => template.name === name);

  if (sameName.length === 0) {
    return { found: false, approvedOnWaba: false };
  }

  const approved = sameName.filter((template) => template.status === 'APPROVED');
  if (approved.length === 0) {
    return {
      found: false,
      approvedOnWaba: false,
      availableLanguages: sameName.map((template) => template.language),
    };
  }

  const exact = approved.find((template) => template.language === normalizedLang);
  if (exact) {
    return { found: true, match: exact, approvedOnWaba: true };
  }

  const langPrefix = normalizedLang.split('_')[0];
  const prefixMatch = approved.find((template) => template.language.startsWith(`${langPrefix}_`));
  if (prefixMatch) {
    return { found: true, match: prefixMatch, approvedOnWaba: true };
  }

  return {
    found: false,
    approvedOnWaba: true,
    availableLanguages: approved.map((template) => template.language),
  };
}

export function formatMetaTemplateValidationError(params: {
  templateName: string;
  templateLanguage: string;
  wabaId?: string | null;
  lookup: MetaTemplateLookupResult;
  approvedTemplates?: MetaMessageTemplate[];
}): string {
  const { templateName, templateLanguage, wabaId, lookup, approvedTemplates } = params;
  const lang = normalizeWhatsAppTemplateLanguage(templateLanguage);
  const wabaHint = wabaId ? ` (WABA ${wabaId})` : '';

  if (!lookup.approvedOnWaba) {
    const approvedList = (approvedTemplates ?? [])
      .filter((template) => template.status === 'APPROVED')
      .slice(0, 8)
      .map((template) => `${template.name} (${template.language})`)
      .join(', ');

    const suffix = approvedList
      ? ` Approved templates on this account: ${approvedList}.`
      : ' No approved templates were found on this WhatsApp account.';

    return (
      `Template "${templateName}" is not registered on your connected WhatsApp Business Account${wabaHint}. ` +
      `Create and approve it in Meta WhatsApp Manager under the same account as your sending phone number, ` +
      `or pick a template that already exists there.${suffix}`
    );
  }

  if (lookup.availableLanguages?.length) {
    return (
      `Template "${templateName}" exists on your WhatsApp account${wabaHint}, but language "${lang}" was not found. ` +
      `Use one of these Meta language codes instead: ${lookup.availableLanguages.join(', ')}.`
    );
  }

  return (
    `Template "${templateName}" (${lang}) was not found on your connected WhatsApp Business Account${wabaHint}. ` +
    'Check the exact template name and language in Meta WhatsApp Manager.'
  );
}

export function formatMetaTemplateDeliveryError(params: {
  templateName?: string;
  templateLanguage?: string;
  wabaId?: string | null;
}): string {
  const name = params.templateName ?? 'this template';
  const lang = params.templateLanguage
    ? normalizeWhatsAppTemplateLanguage(params.templateLanguage)
    : 'en';
  const wabaHint = params.wabaId ? ` WABA ${params.wabaId}` : '';

  return (
    `Meta rejected template "${name}" (${lang}): it does not exist on your connected WhatsApp account${wabaHint ? ` (${wabaHint.trim()})` : ''}. ` +
    'This usually means the template was created under a different Meta Business / WhatsApp account than the phone number sending messages. ' +
    'Open Settings → WhatsApp, confirm the WABA ID matches WhatsApp Manager, and use a template approved on that same account.'
  );
}
