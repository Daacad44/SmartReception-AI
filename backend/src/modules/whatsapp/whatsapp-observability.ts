import { logger } from '../../core/logger';

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

function safeValue(value: LogValue): string | number | boolean {
  if (value === null || value === undefined || value === '') return 'N/A';
  return value;
}

export function formatLifecycleMessage(scope: 'WhatsApp' | 'Campaign', event: string, fields: LogFields): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${String(safeValue(value))}`);
  return `[${scope}] ${event}${lines.length ? `\n${lines.join('\n')}` : ''}`;
}

/**
 * Emit one operator-friendly multiline message while retaining scalar structured
 * metadata for log processors. The deliberately narrow value type prevents
 * request objects, headers, credentials, and payload bodies from being logged.
 */
function lifecycleLog(
  scope: 'WhatsApp' | 'Campaign',
  event: string,
  fields: LogFields,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const metadata = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, safeValue(value)])
  );
  logger[level](formatLifecycleMessage(scope, event, fields), metadata);
}

export function logWhatsAppEvent(
  event: string,
  fields: LogFields,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  lifecycleLog('WhatsApp', event, fields, level);
}

export function logCampaignEvent(
  event: string,
  fields: LogFields,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  lifecycleLog('Campaign', event, fields, level);
}

export function webhookEventId(
  kind: 'message' | 'status',
  messageId: string,
  discriminator?: string
): string {
  return [kind, messageId, discriminator?.toLowerCase()].filter(Boolean).join(':');
}
