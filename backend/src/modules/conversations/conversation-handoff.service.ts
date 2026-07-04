import type { ConversationStatus, ConversationTeam, UserRole } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { conversationScope } from '../../infrastructure/database/tenant-query';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import { emailService } from '../../infrastructure/email/email.service';
import {
  notifyHumanHandoff,
  notifyConversationAssignment,
} from '../../infrastructure/notifications/notification-helper';
import { logConversationActivity } from './conversation-activity.service';
import { logger } from '../../core/logger';

const ACTIVE_STATUSES: ConversationStatus[] = [
  'AI_HANDLING',
  'HUMAN_NEEDED',
  'HUMAN_HANDLING',
  'WAITING_FOR_CUSTOMER',
  'OPEN',
  'PENDING',
  'ESCALATED',
  'TRANSFERRED',
];

const ROLE_PRIORITY: UserRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'RECEPTIONIST', 'STAFF'];

export function isAiHandlingStatus(status: ConversationStatus): boolean {
  return status === 'AI_HANDLING' || status === 'OPEN';
}

export function shouldAiReply(params: {
  status: ConversationStatus;
  isAiEnabled: boolean;
}): boolean {
  if (!params.isAiEnabled) return false;
  return isAiHandlingStatus(params.status);
}

export async function findBestAssignee(businessId: string): Promise<string | null> {
  const members = await prisma.businessMember.findMany({
    where: {
      businessId,
      isActive: true,
      role: { in: ROLE_PRIORITY },
      user: { isActive: true },
    },
    include: {
      user: { select: { id: true, lastLoginAt: true, firstName: true, lastName: true } },
    },
  });

  if (!members.length) return null;

  const onlineThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sorted = [...members].sort((a, b) => {
    const roleDiff = ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role);
    if (roleDiff !== 0) return roleDiff;

    const aOnline = a.user.lastLoginAt && a.user.lastLoginAt >= onlineThreshold ? 1 : 0;
    const bOnline = b.user.lastLoginAt && b.user.lastLoginAt >= onlineThreshold ? 1 : 0;
    return bOnline - aOnline;
  });

  return sorted[0]?.user.id ?? null;
}

async function notifyAssigneeEmail(params: {
  email: string;
  firstName: string;
  customerName: string;
  conversationId: string;
  title: string;
}): Promise<void> {
  try {
    await emailService.send(
      params.email,
      params.title,
      `<p>Hi ${params.firstName},</p>
       <p><strong>${params.customerName}</strong> needs your attention in SmartReception.</p>
       <p>Open the conversation in your inbox to respond.</p>`
    );
  } catch (error) {
    logger.warn('Failed to email assignee for handoff', { error });
  }
}

async function notifyTeamMembers(params: {
  businessId: string;
  conversationId: string;
  customerName: string;
  title: string;
  message: string;
  assigneeId?: string | null;
  urgent?: boolean;
}): Promise<void> {
  const members = await prisma.businessMember.findMany({
    where: { businessId: params.businessId, isActive: true },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });

  await notifyHumanHandoff({
    businessId: params.businessId,
    conversationId: params.conversationId,
    customerName: params.customerName,
    title: params.title,
    message: params.message,
    urgent: params.urgent,
  });

  const targets = params.assigneeId
    ? members.filter((member) => member.userId === params.assigneeId)
    : members;

  await Promise.all(
    targets.map((member) =>
      notifyConversationAssignment({
        businessId: params.businessId,
        userId: member.userId,
        conversationId: params.conversationId,
        customerName: params.customerName,
        title: params.title,
        message: params.message,
      })
    )
  );

  await Promise.all(
    targets.map((member) =>
      notifyAssigneeEmail({
        email: member.user.email,
        firstName: member.user.firstName,
        customerName: params.customerName,
        conversationId: params.conversationId,
        title: params.title,
      })
    )
  );
}

export async function initiateHumanHandoff(params: {
  businessId: string;
  conversationId: string;
  reason: string;
  assigneeId?: string | null;
  team?: ConversationTeam | null;
  actorUserId?: string | null;
  immediateHumanHandling?: boolean;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, businessId: params.businessId },
    include: { customer: { select: { name: true } } },
  });
  if (!conversation) return null;

  const assigneeId = params.assigneeId ?? (await findBestAssignee(params.businessId));
  const now = new Date();
  const status: ConversationStatus = params.immediateHumanHandling
    ? 'HUMAN_HANDLING'
    : 'HUMAN_NEEDED';

  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      status,
      isAiEnabled: false,
      assignedToId: assigneeId,
      assignedTeam: params.team ?? 'SUPPORT',
      transferTime: now,
      humanStartTime: status === 'HUMAN_HANDLING' ? now : conversation.humanStartTime,
      awaitingFeedback: false,
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'CUSTOMER_REQUESTED_HUMAN',
    title: 'Customer requested human support',
    description: params.reason,
    actorUserId: params.actorUserId,
  });

  if (assigneeId) {
    const assignee = updated.assignedTo;
    await logConversationActivity({
      businessId: params.businessId,
      conversationId: params.conversationId,
      type: 'ASSIGNED',
      title: assignee
        ? `Assigned to ${assignee.firstName} ${assignee.lastName}`
        : 'Assigned to team member',
      actorUserId: params.actorUserId,
      metadata: { assigneeId, team: params.team ?? 'SUPPORT' },
    });
  }

  await notifyTeamMembers({
    businessId: params.businessId,
    conversationId: params.conversationId,
    customerName: conversation.customer.name,
    title: 'Human support needed',
    message: params.reason,
    assigneeId,
    urgent: true,
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'handoff',
  }).catch(() => undefined);

  return updated;
}

export async function takeOverConversation(params: {
  businessId: string;
  conversationId: string;
  userId: string;
}) {
  const now = new Date();
  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      assignedToId: params.userId,
      isAiEnabled: false,
      status: 'HUMAN_HANDLING',
      humanStartTime: now,
      awaitingFeedback: false,
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const actor = updated.assignedTo;
  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'TAKEOVER',
    title: actor ? `${actor.firstName} ${actor.lastName} took over` : 'Conversation taken over',
    actorUserId: params.userId,
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'takeover',
  }).catch(() => undefined);

  return updated;
}

export async function returnConversationToAi(params: {
  businessId: string;
  conversationId: string;
  actorUserId: string;
}) {
  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      assignedToId: null,
      isAiEnabled: true,
      status: 'AI_HANDLING',
      assignedTeam: null,
      awaitingFeedback: false,
      aiStartTime: new Date(),
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'RETURNED_TO_AI',
    title: 'Returned to AI',
    actorUserId: params.actorUserId,
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'return_to_ai',
  }).catch(() => undefined);

  return updated;
}

export async function assignConversation(params: {
  businessId: string;
  conversationId: string;
  assigneeId: string;
  team?: ConversationTeam | null;
  actorUserId: string;
}) {
  const assignee = await prisma.user.findFirst({
    where: {
      id: params.assigneeId,
      businessMemberships: { some: { businessId: params.businessId, isActive: true } },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!assignee) return null;

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, businessId: params.businessId },
    include: { customer: { select: { name: true } } },
  });
  if (!conversation) return null;

  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      assignedToId: params.assigneeId,
      assignedTeam: params.team ?? conversation.assignedTeam,
      status: conversation.status === 'AI_HANDLING' ? 'HUMAN_HANDLING' : conversation.status,
      isAiEnabled: false,
      humanStartTime: conversation.humanStartTime ?? new Date(),
      transferTime: new Date(),
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'ASSIGNED',
    title: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
    actorUserId: params.actorUserId,
    metadata: { assigneeId: params.assigneeId, team: params.team },
  });

  await notifyConversationAssignment({
    businessId: params.businessId,
    userId: params.assigneeId,
    conversationId: params.conversationId,
    customerName: conversation.customer.name,
    title: 'Conversation assigned to you',
    message: `${conversation.customer.name} was assigned to you`,
  });

  await notifyAssigneeEmail({
    email: assignee.email,
    firstName: assignee.firstName,
    customerName: conversation.customer.name,
    conversationId: params.conversationId,
    title: 'Conversation assigned to you',
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'assigned',
  }).catch(() => undefined);

  return updated;
}

export async function transferConversation(params: {
  businessId: string;
  conversationId: string;
  assigneeId?: string | null;
  team?: ConversationTeam | null;
  actorUserId: string;
}) {
  const result = params.assigneeId
    ? await assignConversation({
        businessId: params.businessId,
        conversationId: params.conversationId,
        assigneeId: params.assigneeId,
        team: params.team,
        actorUserId: params.actorUserId,
      })
    : await initiateHumanHandoff({
        businessId: params.businessId,
        conversationId: params.conversationId,
        reason: 'Transferred by team member',
        team: params.team,
        actorUserId: params.actorUserId,
      });

  if (!result) return null;

  await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: { status: 'TRANSFERRED' },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'TRANSFERRED',
    title: 'Conversation transferred',
    actorUserId: params.actorUserId,
    metadata: { team: params.team, assigneeId: params.assigneeId },
  });

  return prisma.conversation.findFirst({
    where: { id: params.conversationId, businessId: params.businessId },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });
}

export async function resolveConversation(params: {
  businessId: string;
  conversationId: string;
  actorUserId?: string | null;
  resolutionMethod: 'AI' | 'HUMAN';
}) {
  const now = new Date();
  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      status: 'RESOLVED',
      resolvedAt: now,
      resolutionMethod: params.resolutionMethod,
      awaitingFeedback: false,
      isAiEnabled: false,
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'RESOLVED',
    title: `Conversation resolved (${params.resolutionMethod === 'AI' ? 'AI' : 'Human'})`,
    actorUserId: params.actorUserId,
    metadata: { resolutionMethod: params.resolutionMethod },
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'resolved',
  }).catch(() => undefined);

  return updated;
}

export async function closeConversation(params: {
  businessId: string;
  conversationId: string;
  actorUserId: string;
}) {
  const updated = await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      status: 'CLOSED',
      isAiEnabled: false,
      awaitingFeedback: false,
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'CLOSED',
    title: 'Conversation closed',
    actorUserId: params.actorUserId,
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'closed',
  }).catch(() => undefined);

  return updated;
}

export async function markConversationCreated(params: {
  businessId: string;
  conversationId: string;
  isNew: boolean;
}) {
  if (!params.isNew) return;

  await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      status: 'AI_HANDLING',
      isAiEnabled: true,
      aiStartTime: new Date(),
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'CREATED',
    title: 'Conversation created',
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'AI_STARTED',
    title: 'AI started handling conversation',
  });
}

export { ACTIVE_STATUSES };
