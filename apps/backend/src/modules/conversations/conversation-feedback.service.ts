import { prisma } from '../../infrastructure/database/prisma';
import { conversationScope } from '../../infrastructure/database/tenant-query';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { logConversationActivity } from './conversation-activity.service';
import {
  initiateHumanHandoff,
  resolveConversation,
} from './conversation-handoff.service';
import { parseFeedbackResponse } from './human-request-detection.service';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';

export const FEEDBACK_PROMPT_EN = `Was I able to help you today?

You can reply:
✅ Yes
❌ No
👤 Talk to Human`;

export const FEEDBACK_PROMPT_SO = `Ma ku caawiyay maanta?

Waxaad dooran kartaa:
✅ Haa
❌ Maya
👤 Waxaan rabaa inaan la hadlo qof`;

export async function sendFeedbackPrompt(params: {
  businessId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  preferSomali?: boolean;
}): Promise<void> {
  const content = params.preferSomali ? FEEDBACK_PROMPT_SO : FEEDBACK_PROMPT_EN;

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId: params.phoneNumberId,
    to: params.customerPhone,
    accessToken: params.accessToken,
    type: 'TEXT',
    content,
  });

  await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      direction: 'OUTBOUND',
      content,
      type: 'TEXT',
      isAiGenerated: true,
      status: sendResult.success ? 'SENT' : 'FAILED',
      whatsappMsgId: sendResult.whatsappMsgId,
      metadata: sendResult.error ? { graphApiError: sendResult.error as object } : undefined,
    },
  });

  await prisma.conversation.update({
    where: conversationScope(params.conversationId, params.businessId),
    data: {
      awaitingFeedback: true,
      feedbackPromptedAt: new Date(),
      status: 'WAITING_FOR_CUSTOMER',
    },
  });

  await logConversationActivity({
    businessId: params.businessId,
    conversationId: params.conversationId,
    type: 'FEEDBACK_PROMPTED',
    title: 'Satisfaction feedback requested',
  });

  void broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'feedback_prompt',
  }).catch(() => undefined);
}

export async function handleFeedbackInbound(params: {
  businessId: string;
  conversationId: string;
  message: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
}): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, businessId: params.businessId },
    include: { customer: true, whatsappAccount: true, assignedTo: true },
  });

  if (!conversation?.awaitingFeedback) return false;

  const choice = parseFeedbackResponse(params.message);
  if (!choice) return false;

  const aiStart = conversation.aiStartTime ?? conversation.createdAt;
  const resolutionTimeMs = Date.now() - aiStart.getTime();
  const token =
    params.accessToken ??
    resolveStoredToken(conversation.whatsappAccount?.accessToken ?? undefined) ??
    undefined;

  if (choice === 'yes') {
    await prisma.conversationFeedback.create({
      data: {
        businessId: params.businessId,
        conversationId: params.conversationId,
        helpful: true,
        rating: 5,
        resolutionMethod: 'AI',
        resolutionTimeMs,
        aiConfidenceScore: conversation.aiConfidenceScore,
      },
    });

    await resolveConversation({
      businessId: params.businessId,
      conversationId: params.conversationId,
      resolutionMethod: 'AI',
    });

    await logConversationActivity({
      businessId: params.businessId,
      conversationId: params.conversationId,
      type: 'FEEDBACK_SUBMITTED',
      title: 'Customer confirmed issue resolved',
      metadata: { helpful: true, rating: 5 },
    });

    const thankYou = /so|haa|maya|waxaan/i.test(params.message)
      ? 'Waad ku mahadsan tahay jawaabtaada!'
      : 'Thank you for your feedback!';

    await whatsappService.sendOutbound({
      phoneNumberId: params.phoneNumberId,
      to: params.customerPhone,
      accessToken: token,
      type: 'TEXT',
      content: thankYou,
    });

    return true;
  }

  if (choice === 'no') {
    const followUp =
      /so|haa|maya|waxaan/i.test(params.message)
        ? 'Ma rabtaa inaad la hadasho wakiil shaqaale? Jawaab Haa ama Maya.'
        : 'Would you like to speak with a human representative? Reply Yes or No.';

    await prisma.conversation.update({
      where: conversationScope(params.conversationId, params.businessId),
      data: { awaitingFeedback: false, status: 'WAITING_FOR_CUSTOMER' },
    });

    await prisma.conversationFeedback.create({
      data: {
        businessId: params.businessId,
        conversationId: params.conversationId,
        helpful: false,
        rating: 2,
        resolutionMethod: 'AI',
        resolutionTimeMs,
        aiConfidenceScore: conversation.aiConfidenceScore,
      },
    });

    await whatsappService.sendOutbound({
      phoneNumberId: params.phoneNumberId,
      to: params.customerPhone,
      accessToken: token,
      type: 'TEXT',
      content: followUp,
    });

    await logConversationActivity({
      businessId: params.businessId,
      conversationId: params.conversationId,
      type: 'FEEDBACK_SUBMITTED',
      title: 'Customer was not satisfied',
      metadata: { helpful: false },
    });

    return true;
  }

  await prisma.conversationFeedback.create({
    data: {
      businessId: params.businessId,
      conversationId: params.conversationId,
      helpful: false,
      rating: 1,
      resolutionMethod: 'HUMAN',
      resolutionTimeMs,
      employeeName: conversation.assignedTo
        ? `${conversation.assignedTo.firstName} ${conversation.assignedTo.lastName}`
        : undefined,
      aiConfidenceScore: conversation.aiConfidenceScore,
    },
  });

  await initiateHumanHandoff({
    businessId: params.businessId,
    conversationId: params.conversationId,
    reason: 'Customer requested human via satisfaction prompt',
    immediateHumanHandling: true,
  });

  return true;
}

export async function handlePostFeedbackHumanOffer(params: {
  businessId: string;
  conversationId: string;
  message: string;
}): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      businessId: params.businessId,
      status: 'WAITING_FOR_CUSTOMER',
      awaitingFeedback: false,
    },
  });
  if (!conversation) return false;

  const text = params.message.trim().toLowerCase();
  const wantsHuman = /^(yes|yep|yeah|haa|sure|ok)\.?$/i.test(text);
  const declines = /^(no|nope|maya)\.?$/i.test(text);
  if (!wantsHuman && !declines) return false;

  if (wantsHuman) {
    await initiateHumanHandoff({
      businessId: params.businessId,
      conversationId: params.conversationId,
      reason: 'Customer accepted human transfer after negative feedback',
      immediateHumanHandling: true,
    });
    return true;
  }

  await resolveConversation({
    businessId: params.businessId,
    conversationId: params.conversationId,
    resolutionMethod: 'AI',
  });
  return true;
}

export async function getConversationFeedback(businessId: string, conversationId: string) {
  return prisma.conversationFeedback.findMany({
    where: { businessId, conversationId },
    orderBy: { createdAt: 'desc' },
  });
}
