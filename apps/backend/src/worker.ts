import { Job } from 'bullmq';
import {
  createWorker,
  QUEUE_NAMES,
  AIJobData,
  DocumentJobData,
  ReminderJobData,
  WhatsAppJobData,
} from './infrastructure/queue/queues';
import { processDocumentById } from './infrastructure/documents/document-processing.service';
import { connectDatabase, disconnectDatabase, prisma } from './infrastructure/database/prisma';
import { whatsappService } from './infrastructure/whatsapp/whatsapp.service';
import { processAndSendAiReply } from './modules/ai/ai-reply.service';
import { sendConversationMessage } from './modules/whatsapp/whatsapp-outbound.service';
import { logger } from './core/logger';

async function processAIJob(job: Job<AIJobData>): Promise<void> {
  const { businessId, conversationId, messageId, customerMessage } = job.data;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    include: { customer: true, whatsappAccount: true },
  });

  if (!conversation?.whatsappAccount) {
    logger.debug(`Skipping AI job for conversation ${conversationId}`);
    return;
  }

  await processAndSendAiReply({
    businessId,
    conversationId,
    inboundMessageId: messageId,
    customerMessage,
    phoneNumberId: conversation.whatsappAccount.phoneNumberId,
    customerPhone: conversation.customer.phone,
    accessToken: conversation.whatsappAccount.accessToken || undefined,
  });
}

async function processWhatsAppJob(job: Job<WhatsAppJobData>): Promise<void> {
  const { businessId, conversationId, messageId, phoneNumber, content, type, mediaUrl, mediaFilename } =
    job.data;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    include: { whatsappAccount: true },
  });

  if (!conversation?.whatsappAccount) {
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED' },
    });
    return;
  }

  await sendConversationMessage({
    businessId,
    conversationId,
    messageId,
    phoneNumber,
    phoneNumberId: conversation.whatsappAccount.phoneNumberId,
    content,
    type,
    mediaUrl,
    mediaFilename,
    accessToken: conversation.whatsappAccount.accessToken || undefined,
  });
}

async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, businessId } = job.data;
  await processDocumentById(documentId, businessId);
}

async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { appointmentId, businessId, customerPhone } = job.data;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: {
      customer: true,
      service: true,
      business: {
        include: { whatsappAccounts: { where: { isActive: true }, take: 1 } },
      },
    },
  });

  if (!appointment || appointment.status === 'CANCELLED' || appointment.reminderSent) {
    return;
  }

  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (!whatsappAccount) {
    logger.warn(`No WhatsApp account for reminder on appointment ${appointmentId}`);
    return;
  }

  const startTime = appointment.startTime.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const message = `Reminder: You have an appointment "${appointment.title}"${
    appointment.service ? ` for ${appointment.service.name}` : ''
  } scheduled on ${startTime}. Reply to confirm or reschedule.`;

  const result = await whatsappService.sendOutbound({
    phoneNumberId: whatsappAccount.phoneNumberId,
    to: customerPhone,
    accessToken: whatsappAccount.accessToken || undefined,
    type: 'TEXT',
    content: message,
  });

  if (result.success) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSent: true },
    });
    logger.info(`Reminder sent for appointment ${appointmentId}`);
  }
}

async function startWorkers(): Promise<void> {
  await connectDatabase();

  createWorker<AIJobData>(QUEUE_NAMES.AI_PROCESSING, processAIJob, 3);
  createWorker<WhatsAppJobData>(QUEUE_NAMES.WHATSAPP_MESSAGE, processWhatsAppJob, 5);
  createWorker<DocumentJobData>(QUEUE_NAMES.DOCUMENT_PROCESSING, processDocumentJob, 2);
  createWorker<ReminderJobData>(QUEUE_NAMES.APPOINTMENT_REMINDER, processReminderJob, 3);

  logger.info('BullMQ workers started');
}

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down workers`);
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorkers().catch((error) => {
  logger.error('Failed to start workers:', error);
  process.exit(1);
});
