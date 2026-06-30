import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../core/logger';

function getConnection() {
  if (!config.redis.url) return null;
  return {
    connection: {
      url: config.redis.url,
      maxRetriesPerRequest: null,
    },
  };
}

export const QUEUE_NAMES = {
  WHATSAPP_MESSAGE: 'whatsapp-message',
  AI_PROCESSING: 'ai-processing',
  DOCUMENT_PROCESSING: 'document-processing',
  APPOINTMENT_REMINDER: 'appointment-reminder',
  EMAIL: 'email',
  CAMPAIGN: 'campaign',
  CAMPAIGN_BATCH: 'campaign-batch',
  CAMPAIGN_JOURNEY: 'campaign-journey',
  EMPLOYEE_BROADCAST: 'employee-broadcast',
  EMPLOYEE_BROADCAST_BATCH: 'employee-broadcast-batch',
  SUBSCRIPTION_EXPIRATION: 'subscription-expiration',
  SUBSCRIPTION_REMINDER: 'subscription-reminder',
  SUBSCRIPTION_LOCK: 'subscription-lock',
  SUBSCRIPTION_NOTIFICATION: 'subscription-notification',
  AI_TRAINING: 'ai-training',
  AI_EMBEDDING: 'ai-embedding',
  AI_DEPLOYMENT: 'ai-deployment',
} as const;

let whatsappQueue: Queue | null = null;
let aiQueue: Queue | null = null;
let documentQueue: Queue | null = null;
let reminderQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let campaignQueue: Queue | null = null;
let campaignBatchQueue: Queue | null = null;
let campaignJourneyQueue: Queue | null = null;
let employeeBroadcastQueue: Queue | null = null;
let employeeBroadcastBatchQueue: Queue | null = null;
let aiTrainingQueue: Queue | null = null;
let aiEmbeddingQueue: Queue | null = null;
let aiDeploymentQueue: Queue | null = null;

export function getWhatsappQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!whatsappQueue) whatsappQueue = new Queue(QUEUE_NAMES.WHATSAPP_MESSAGE, conn);
  return whatsappQueue;
}

export function getAiQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!aiQueue) aiQueue = new Queue(QUEUE_NAMES.AI_PROCESSING, conn);
  return aiQueue;
}

export function getDocumentQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!documentQueue) documentQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, conn);
  return documentQueue;
}

export function getReminderQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!reminderQueue) reminderQueue = new Queue(QUEUE_NAMES.APPOINTMENT_REMINDER, conn);
  return reminderQueue;
}

export function getEmailQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!emailQueue) emailQueue = new Queue(QUEUE_NAMES.EMAIL, conn);
  return emailQueue;
}

export function getCampaignQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!campaignQueue) campaignQueue = new Queue(QUEUE_NAMES.CAMPAIGN, conn);
  return campaignQueue;
}

export function getCampaignBatchQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!campaignBatchQueue) campaignBatchQueue = new Queue(QUEUE_NAMES.CAMPAIGN_BATCH, conn);
  return campaignBatchQueue;
}

export function getCampaignJourneyQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!campaignJourneyQueue) campaignJourneyQueue = new Queue(QUEUE_NAMES.CAMPAIGN_JOURNEY, conn);
  return campaignJourneyQueue;
}

export function getEmployeeBroadcastQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!employeeBroadcastQueue) employeeBroadcastQueue = new Queue(QUEUE_NAMES.EMPLOYEE_BROADCAST, conn);
  return employeeBroadcastQueue;
}

export function getEmployeeBroadcastBatchQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!employeeBroadcastBatchQueue)
    employeeBroadcastBatchQueue = new Queue(QUEUE_NAMES.EMPLOYEE_BROADCAST_BATCH, conn);
  return employeeBroadcastBatchQueue;
}

export function getAiTrainingQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!aiTrainingQueue) aiTrainingQueue = new Queue(QUEUE_NAMES.AI_TRAINING, conn);
  return aiTrainingQueue;
}

export function getAiEmbeddingQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!aiEmbeddingQueue) aiEmbeddingQueue = new Queue(QUEUE_NAMES.AI_EMBEDDING, conn);
  return aiEmbeddingQueue;
}

export function getAiDeploymentQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!aiDeploymentQueue) aiDeploymentQueue = new Queue(QUEUE_NAMES.AI_DEPLOYMENT, conn);
  return aiDeploymentQueue;
}

export interface WhatsAppJobData {
  businessId: string;
  conversationId: string;
  messageId: string;
  phoneNumber: string;
  content: string;
  type?: string;
  mediaUrl?: string;
  mediaFilename?: string;
}

export interface AIJobData {
  businessId: string;
  conversationId: string;
  messageId: string;
  customerMessage: string;
}

export interface DocumentJobData {
  documentId: string;
  knowledgeBaseId: string;
  businessId: string;
}

export interface ReminderJobData {
  appointmentId: string;
  businessId: string;
  customerPhone: string;
  interval?: '30m' | '20m' | '10m' | 'missed' | 'followup-24h' | 'configurable';
  configId?: string;
  label?: string;
  channels?: Array<'EMAIL' | 'WHATSAPP'>;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export interface CampaignJobData {
  campaignId: string;
  businessId: string;
}

export interface CampaignBatchJobData {
  campaignId: string;
  businessId: string;
  recipientIds: string[];
  runVersion: number;
}

export interface CampaignJourneyJobData {
  enrollmentId: string;
}

export interface EmployeeBroadcastJobData {
  broadcastId: string;
  businessId: string;
}

export interface EmployeeBroadcastBatchJobData {
  broadcastId: string;
  businessId: string;
  recipientIds: string[];
  runVersion: number;
}

export interface SubscriptionScanJobData {
  type: 'expiration' | 'reminders';
}

export interface AiTrainingJobData {
  jobId: string;
  businessId: string;
  jobType?: import('@prisma/client').AiTrainingJobType;
  userId?: string;
  trainerId?: string;
  trainingNotes?: string;
  documentIds?: string[];
}

export interface AiDeploymentJobData {
  requestId: string;
  businessId: string;
  versionId: string;
  userId: string;
}

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 5
): Worker<T> | null {
  const conn = getConnection();
  if (!conn) {
    logger.warn('Redis not configured — workers disabled');
    return null;
  }

  const worker = new Worker<T>(queueName, processor, {
    ...conn,
    concurrency,
  });

  worker.on('completed', (job) => {
    logger.debug(`Job ${job.id} completed in queue ${queueName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error in queue ${queueName}:`, err);
  });

  return worker;
}
