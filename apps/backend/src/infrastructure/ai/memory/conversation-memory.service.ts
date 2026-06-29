import { config } from '../../../config';
import { prisma } from '../../database/prisma';
import { conversationMessageScope } from '../../database/tenant-query';
import { resolveAiProvider } from '../providers/provider-factory';

export interface ConversationMemoryContext {
  summary: string | null;
  recentExchanges: string;
  usedSummary: boolean;
  summaryChars: number;
  rawMessageCount: number;
}

export async function buildConversationMemory(
  businessId: string,
  conversationId: string
): Promise<ConversationMemoryContext> {
  const rawLimit = config.ai.memoryRawExchanges * 2;
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    select: { memorySummary: true, memoryMessageCount: true },
  });

  const messages = await prisma.message.findMany({
    where: conversationMessageScope(conversationId, businessId),
    orderBy: { createdAt: 'desc' },
    take: rawLimit,
    select: { direction: true, content: true },
  });

  const recentExchanges = messages
    .reverse()
    .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const summary = conversation?.memorySummary ?? null;
  const totalMessages = await prisma.message.count({
    where: conversationMessageScope(conversationId, businessId),
  });

  if (totalMessages > rawLimit + 2) {
    void maybeCompressConversationMemory(businessId, conversationId).catch(() => undefined);
  }

  return {
    summary,
    recentExchanges,
    usedSummary: Boolean(summary),
    summaryChars: summary?.length ?? 0,
    rawMessageCount: messages.length,
  };
}

export async function maybeCompressConversationMemory(
  businessId: string,
  conversationId: string
): Promise<void> {
  const rawLimit = config.ai.memoryRawExchanges * 2;
  const messages = await prisma.message.findMany({
    where: conversationMessageScope(conversationId, businessId),
    orderBy: { createdAt: 'asc' },
    select: { direction: true, content: true, createdAt: true },
  });

  if (messages.length <= rawLimit + 4) return;

  const older = messages.slice(0, -rawLimit);
  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    select: { memorySummary: true },
  });

  const transcript = older
    .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  const provider = resolveAiProvider();
  const response = await provider.chat({
    systemPrompt:
      'Compress this WhatsApp conversation into a concise summary. Preserve: customer name, preferences, products discussed, decisions, pending questions, important facts. Output plain text only.',
    userPrompt: `${existing?.memorySummary ? `Previous summary:\n${existing.memorySummary}\n\n` : ''}New messages to compress:\n${transcript}`,
    temperature: 0.2,
    maxOutputTokens: 400,
  });

  let summary = response.text.trim();
  if (summary.length > config.ai.summaryMaxChars) {
    summary = summary.slice(0, config.ai.summaryMaxChars);
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      memorySummary: summary,
      memorySummaryAt: new Date(),
      memoryMessageCount: messages.length,
    },
  });
}

export function formatMemoryForPrompt(memory: ConversationMemoryContext): string {
  const parts: string[] = [];
  if (memory.summary) {
    parts.push(`CONVERSATION SUMMARY:\n${memory.summary}`);
  }
  if (memory.recentExchanges) {
    parts.push(`RECENT MESSAGES:\n${memory.recentExchanges}`);
  }
  return parts.join('\n\n') || 'No prior context.';
}
