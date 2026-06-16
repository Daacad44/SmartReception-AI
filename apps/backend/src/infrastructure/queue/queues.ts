import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../core/logger';

const connection = {
  connection: {
    url: config.redis.url,
    maxRetriesPerRequest: null,
  },
};

export const QUEUE_NAMES = {
  WHATSAPP_MESSAGE: 'whatsapp-message',
  AI_PROCESSING: 'ai-processing',
  DOCUMENT_PROCESSING: 'document-processing',
  APPOINTMENT_REMINDER: 'appointment-reminder',
  EMAIL: 'email',
} as const;

export const whatsappQueue = new Queue(QUEUE_NAMES.WHATSAPP_MESSAGE, connection);
export const aiQueue = new Queue(QUEUE_NAMES.AI_PROCESSING, connection);
export const documentQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, connection);
export const reminderQueue = new Queue(QUEUE_NAMES.APPOINTMENT_REMINDER, connection);
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, connection);

export interface WhatsAppJobData {
  businessId: string;
  conversationId: string;
  messageId: string;
  phoneNumber: string;
  content: string;
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
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 5
): Worker<T> {
  const worker = new Worker<T>(queueName, processor, {
    ...connection,
    concurrency,
  });

  worker.on('completed', (job) => {
    logger.debug(`Job ${job.id} completed in queue ${queueName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
  });

  return worker;
}
