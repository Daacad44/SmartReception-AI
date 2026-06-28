import type { ConversationActivityType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';

export async function logConversationActivity(params: {
  businessId: string;
  conversationId: string;
  type: ConversationActivityType;
  title: string;
  description?: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.conversationActivity.create({
    data: {
      businessId: params.businessId,
      conversationId: params.conversationId,
      type: params.type,
      title: params.title,
      description: params.description,
      actorUserId: params.actorUserId ?? undefined,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'activity',
  }).catch(() => undefined);
}

export async function listConversationActivities(
  businessId: string,
  conversationId: string,
  limit = 100
) {
  return prisma.conversationActivity.findMany({
    where: { businessId, conversationId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      actorUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
