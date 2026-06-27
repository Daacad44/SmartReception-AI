import { Job } from 'bullmq';
import {
  createWorker,
  QUEUE_NAMES,
  AIJobData,
  DocumentJobData,
  ReminderJobData,
  WhatsAppJobData,
  CampaignJobData,
  CampaignBatchJobData,
  CampaignJourneyJobData,
  EmployeeBroadcastJobData,
  EmployeeBroadcastBatchJobData,
} from './infrastructure/queue/queues';
import { processDocumentById } from './infrastructure/documents/document-processing.service';
import { connectDatabase, disconnectDatabase, prisma } from './infrastructure/database/prisma';
import { resolveStoredToken } from './infrastructure/crypto/token-crypto';
import {
  processReminderJob,
  processMissedAppointments,
} from './infrastructure/appointments/appointment-notification.service';
import { processAndSendAiReply } from './modules/ai/ai-reply.service';
import { sendConversationMessage } from './modules/whatsapp/whatsapp-outbound.service';
import { executeCampaignSend } from './modules/campaigns/campaigns.service';
import { sendCampaignBatch } from './modules/campaigns/campaign-batch.service';
import { scheduleJourneyStep } from './modules/campaigns/campaign-journey.service';
import { executeEmployeeBroadcastSend } from './modules/employee-comms/employee-broadcasts.service';
import { sendEmployeeBroadcastBatch } from './modules/employee-comms/employee-broadcast-batch.service';
import { logger } from './core/logger';

async function processAIJob(job: Job<AIJobData>): Promise<void> {
  const { businessId, conversationId, messageId, customerMessage } = job.data;

  const { isWhatsAppAutomationAllowed } = await import('./modules/subscription/subscription-license.service');
  if (!(await isWhatsAppAutomationAllowed(businessId))) {
    logger.debug(`Skipping AI job — subscription invalid for business ${businessId}`);
    return;
  }

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
    accessToken: resolveStoredToken(conversation.whatsappAccount.accessToken),
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
    accessToken: resolveStoredToken(conversation.whatsappAccount.accessToken),
  });
}

async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, businessId } = job.data;
  await processDocumentById(documentId, businessId);
}

async function processReminderJobHandler(job: Job<ReminderJobData>): Promise<void> {
  const { appointmentId, businessId, interval = '30m' } = job.data;
  await processReminderJob(appointmentId, businessId, interval);
}

async function processCampaignJob(job: Job<CampaignJobData>): Promise<void> {
  const { campaignId, businessId } = job.data;
  await executeCampaignSend(campaignId, businessId);
}

async function processCampaignBatchJob(job: Job<CampaignBatchJobData>): Promise<void> {
  await sendCampaignBatch(job.data);
}

async function processCampaignJourneyJob(job: Job<CampaignJourneyJobData>): Promise<void> {
  await scheduleJourneyStep(job.data.enrollmentId);
}

async function processEmployeeBroadcastJob(job: Job<EmployeeBroadcastJobData>): Promise<void> {
  const { broadcastId, businessId } = job.data;
  await executeEmployeeBroadcastSend(broadcastId, businessId);
}

async function processEmployeeBroadcastBatchJob(job: Job<EmployeeBroadcastBatchJobData>): Promise<void> {
  await sendEmployeeBroadcastBatch(job.data);
}

async function startWorkers(): Promise<void> {
  await connectDatabase();

  const workers = [
    createWorker<AIJobData>(QUEUE_NAMES.AI_PROCESSING, processAIJob, 3),
    createWorker<WhatsAppJobData>(QUEUE_NAMES.WHATSAPP_MESSAGE, processWhatsAppJob, 5),
    createWorker<DocumentJobData>(QUEUE_NAMES.DOCUMENT_PROCESSING, processDocumentJob, 2),
    createWorker<ReminderJobData>(QUEUE_NAMES.APPOINTMENT_REMINDER, processReminderJobHandler, 3),
    createWorker<CampaignJobData>(QUEUE_NAMES.CAMPAIGN, processCampaignJob, 2),
    createWorker<CampaignBatchJobData>(QUEUE_NAMES.CAMPAIGN_BATCH, processCampaignBatchJob, 5),
    createWorker<CampaignJourneyJobData>(QUEUE_NAMES.CAMPAIGN_JOURNEY, processCampaignJourneyJob, 3),
    createWorker<EmployeeBroadcastJobData>(QUEUE_NAMES.EMPLOYEE_BROADCAST, processEmployeeBroadcastJob, 2),
    createWorker<EmployeeBroadcastBatchJobData>(
      QUEUE_NAMES.EMPLOYEE_BROADCAST_BATCH,
      processEmployeeBroadcastBatchJob,
      5
    ),
  ].filter(Boolean);

  if (workers.length === 0) {
    logger.error('No workers started — REDIS_URL is not configured');
    process.exit(1);
  }

  // Retry failed jobs on startup (stale failures from crashed workers).
  const {
    getAiQueue,
    getWhatsappQueue,
    getCampaignQueue,
    getCampaignBatchQueue,
    getCampaignJourneyQueue,
    getEmployeeBroadcastQueue,
    getEmployeeBroadcastBatchQueue,
  } = await import('./infrastructure/queue/queues');
  for (const queue of [
    getAiQueue(),
    getWhatsappQueue(),
    getCampaignQueue(),
    getCampaignBatchQueue(),
    getCampaignJourneyQueue(),
    getEmployeeBroadcastQueue(),
    getEmployeeBroadcastBatchQueue(),
  ]) {
    if (!queue) continue;
    try {
      const failed = await queue.getJobs(['failed'], 0, 50);
      for (const job of failed) {
        await job.retry().catch((error) => {
          logger.warn('Failed to retry job on worker startup', { jobId: job.id, error });
        });
      }
      if (failed.length > 0) {
        logger.info(`Retried ${failed.length} failed jobs in queue ${queue.name}`);
      }
    } catch (error) {
      logger.warn('Failed to recover failed jobs on startup', { error, queue: queue.name });
    }
  }

  logger.info('BullMQ workers started', { count: workers.length });

  // Fallback missed-appointment scan when delayed jobs were lost (every 5 minutes).
  const MISSED_SCAN_MS = 5 * 60 * 1000;
  setInterval(() => {
    void processMissedAppointments().catch((error) => {
      logger.warn('Periodic missed appointment scan failed', { error });
    });
  }, MISSED_SCAN_MS);
  void processMissedAppointments().catch(() => undefined);

  const {
    processDueReminders,
    processExpiredSubscriptions,
  } = await import('./modules/subscription/subscription-scheduler.service');

  const SUBSCRIPTION_SCAN_MS = 60 * 1000;
  setInterval(() => {
    void processExpiredSubscriptions().catch((error) => {
      logger.warn('Subscription expiration scan failed', { error });
    });
    void processDueReminders().catch((error) => {
      logger.warn('Subscription reminder scan failed', { error });
    });
  }, SUBSCRIPTION_SCAN_MS);
  void processExpiredSubscriptions().catch(() => undefined);
  void processDueReminders().catch(() => undefined);
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
