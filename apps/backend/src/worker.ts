import { Job } from 'bullmq';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import {
  createWorker,
  QUEUE_NAMES,
  AIJobData,
  DocumentJobData,
  ReminderJobData,
  WhatsAppJobData,
} from './infrastructure/queue/queues';
import { connectDatabase, disconnectDatabase, prisma } from './infrastructure/database/prisma';
import { aiService } from './infrastructure/ai/openai.service';
import { whatsappService } from './infrastructure/whatsapp/whatsapp.service';
import { logger } from './core/logger';

async function processAIJob(job: Job<AIJobData>): Promise<void> {
  const { businessId, conversationId, messageId, customerMessage } = job.data;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    include: {
      customer: true,
      whatsappAccount: true,
    },
  });

  if (!conversation || !conversation.isAiEnabled) {
    logger.debug(`Skipping AI job for conversation ${conversationId}`);
    return;
  }

  const aiResponse = await aiService.generateResponse(
    businessId,
    conversationId,
    customerMessage
  );

  const outboundMessage = await prisma.message.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content: aiResponse.content,
      type: 'TEXT',
      isAiGenerated: true,
      status: 'PENDING',
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  if (conversation.whatsappAccount) {
    const whatsappMsgId = await whatsappService.sendMessage({
      phoneNumberId: conversation.whatsappAccount.phoneNumberId,
      to: conversation.customer.phone,
      message: aiResponse.content,
      accessToken: conversation.whatsappAccount.accessToken || undefined,
    });

    await prisma.message.update({
      where: { id: outboundMessage.id },
      data: {
        status: whatsappMsgId ? 'SENT' : 'FAILED',
        whatsappMsgId,
      },
    });
  } else {
    await prisma.message.update({
      where: { id: outboundMessage.id },
      data: { status: 'SENT' },
    });
  }

  if (aiResponse.actions.some((a) => a.type === 'escalate')) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { isAiEnabled: false, status: 'PENDING' },
    });
  }

  logger.info(`AI response sent for conversation ${conversationId}, inbound message ${messageId}`);
}

async function processWhatsAppJob(job: Job<WhatsAppJobData>): Promise<void> {
  const { businessId, conversationId, messageId, phoneNumber, content } = job.data;

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

  const whatsappMsgId = await whatsappService.sendMessage({
    phoneNumberId: conversation.whatsappAccount.phoneNumberId,
    to: phoneNumber,
    message: content,
    accessToken: conversation.whatsappAccount.accessToken || undefined,
  });

  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: whatsappMsgId ? 'SENT' : 'FAILED',
      whatsappMsgId,
    },
  });
}

async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, businessId } = job.data;

  const document = await prisma.knowledgeDocument.findFirst({
    where: {
      id: documentId,
      knowledgeBase: { businessId },
    },
  });

  if (!document) {
    logger.warn(`Document ${documentId} not found`);
    return;
  }

  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'PROCESSING' },
  });

  try {
    let content = document.content || '';

    if (!content && document.fileUrl) {
      const response = await fetch(document.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      switch (document.type) {
        case 'PDF': {
          const parsed = await pdfParse(buffer);
          content = parsed.text;
          break;
        }
        case 'DOCX': {
          const result = await mammoth.extractRawText({ buffer });
          content = result.value;
          break;
        }
        case 'TXT':
          content = buffer.toString('utf-8');
          break;
        default:
          throw new Error(`Unsupported document type: ${document.type}`);
      }
    }

    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        content: content.slice(0, 50000),
        status: 'INDEXED',
      },
    });

    logger.info(`Document ${documentId} processed and indexed`);
  } catch (error) {
    logger.error(`Document processing failed for ${documentId}:`, error);
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'FAILED' },
    });
  }
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

  const whatsappMsgId = await whatsappService.sendMessage({
    phoneNumberId: whatsappAccount.phoneNumberId,
    to: customerPhone,
    message,
    accessToken: whatsappAccount.accessToken || undefined,
  });

  if (whatsappMsgId) {
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
