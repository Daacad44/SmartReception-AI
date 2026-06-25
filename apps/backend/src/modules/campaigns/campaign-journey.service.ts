import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { enqueueCampaignSend } from './campaign-queue.utils';
import { getCampaignPlanLimits } from './campaign-limits.service';

export type CreateJourneyInput = {
  name: string;
  description?: string;
  triggerType?: string;
  steps: Array<{
    delayMinutes: number;
    message: string;
    messageType?: string;
    mediaUrl?: string;
    templateId?: string;
  }>;
};

export class CampaignJourneyService {
  async list(businessId: string) {
    return prisma.campaignJourney.findMany({
      where: { businessId },
      include: { steps: { orderBy: { orderIndex: 'asc' } }, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(businessId: string, id: string) {
    const journey = await prisma.campaignJourney.findFirst({
      where: { id, businessId },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        enrollments: {
          take: 50,
          orderBy: { startedAt: 'desc' },
          include: { customer: { select: { id: true, name: true, phone: true } } },
        },
      },
    });
    if (!journey) throw new NotFoundError('Journey not found');
    return journey;
  }

  async create(businessId: string, input: CreateJourneyInput) {
    const limits = await getCampaignPlanLimits(businessId);
    if (!limits.journeys) {
      throw new ValidationError('Customer journeys require Business plan or higher');
    }
    if (!input.steps.length) throw new ValidationError('Journey must have at least one step');

    return prisma.campaignJourney.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType ?? 'MANUAL',
        steps: {
          create: input.steps.map((step, index) => ({
            orderIndex: index,
            delayMinutes: step.delayMinutes,
            message: step.message,
            messageType: (step.messageType as 'TEXT') ?? 'TEXT',
            mediaUrl: step.mediaUrl,
            templateId: step.templateId,
          })),
        },
      },
      include: { steps: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async activate(businessId: string, id: string) {
    const journey = await prisma.campaignJourney.findFirst({ where: { id, businessId } });
    if (!journey) throw new NotFoundError('Journey not found');
    return prisma.campaignJourney.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async pause(businessId: string, id: string) {
    const journey = await prisma.campaignJourney.findFirst({ where: { id, businessId } });
    if (!journey) throw new NotFoundError('Journey not found');
    return prisma.campaignJourney.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  async enrollCustomer(businessId: string, journeyId: string, customerId: string) {
    const journey = await prisma.campaignJourney.findFirst({
      where: { id: journeyId, businessId, status: 'ACTIVE' },
      include: { steps: { orderBy: { orderIndex: 'asc' }, take: 1 } },
    });
    if (!journey) throw new NotFoundError('Active journey not found');
    if (!journey.steps[0]) throw new ValidationError('Journey has no steps');

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer not found');

    const firstStep = journey.steps[0]!;
    const nextStepAt = new Date(Date.now() + firstStep.delayMinutes * 60_000);

    const enrollment = await prisma.campaignJourneyEnrollment.upsert({
      where: { journeyId_customerId: { journeyId, customerId } },
      create: {
        journeyId,
        businessId,
        customerId,
        currentStep: 0,
        status: 'ACTIVE',
        nextStepAt,
      },
      update: { status: 'ACTIVE', currentStep: 0, nextStepAt },
    });

    await scheduleJourneyStep(enrollment.id);
    return enrollment;
  }
}

export async function scheduleJourneyStep(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.campaignJourneyEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      journey: { include: { steps: { orderBy: { orderIndex: 'asc' } } } },
      customer: true,
    },
  });
  if (!enrollment || enrollment.status !== 'ACTIVE') return;

  const step = enrollment.journey.steps[enrollment.currentStep];
  if (!step) {
    await prisma.campaignJourneyEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'COMPLETED', completedAt: new Date(), nextStepAt: null },
    });
    return;
  }

  const runAt = enrollment.nextStepAt ?? new Date();
  const campaign = await prisma.campaign.create({
    data: {
      businessId: enrollment.businessId,
      name: `${enrollment.journey.name} — Step ${enrollment.currentStep + 1}`,
      message: step.message,
      type: 'FOLLOW_UP',
      schedule: 'ONE_TIME',
      status: 'SCHEDULED',
      messageType: step.messageType,
      mediaUrl: step.mediaUrl,
      journeyId: enrollment.journeyId,
      targetCustomerId: enrollment.customerId,
      scheduledAt: runAt,
      nextRunAt: runAt,
      recipients: {
        create: [{
          customerId: enrollment.customerId,
          phone: enrollment.customer.whatsappNumber || enrollment.customer.phone,
          runVersion: 0,
        }],
      },
    },
  });

  await enqueueCampaignSend(campaign.id, enrollment.businessId, runAt, `journey-${enrollmentId}-${enrollment.currentStep}`);
}

export async function advanceJourneyAfterStep(
  businessId: string,
  journeyId: string,
  customerId: string
): Promise<void> {
  const enrollment = await prisma.campaignJourneyEnrollment.findUnique({
    where: { journeyId_customerId: { journeyId, customerId } },
    include: { journey: { include: { steps: { orderBy: { orderIndex: 'asc' } } } } },
  });
  if (!enrollment || enrollment.status !== 'ACTIVE') return;

  const nextIndex = enrollment.currentStep + 1;
  const nextStep = enrollment.journey.steps[nextIndex];
  if (!nextStep) {
    await prisma.campaignJourneyEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'COMPLETED', completedAt: new Date(), nextStepAt: null },
    });
    return;
  }

  const nextStepAt = new Date(Date.now() + nextStep.delayMinutes * 60_000);
  await prisma.campaignJourneyEnrollment.update({
    where: { id: enrollment.id },
    data: { currentStep: nextIndex, nextStepAt },
  });
  await scheduleJourneyStep(enrollment.id);
}

/** Auto-enroll new customers into journeys with CUSTOMER_CREATED trigger. */
export async function triggerJourneyOnCustomerCreated(
  businessId: string,
  customerId: string
): Promise<void> {
  const journeys = await prisma.campaignJourney.findMany({
    where: { businessId, status: 'ACTIVE', triggerType: 'CUSTOMER_CREATED' },
    select: { id: true },
  });
  for (const journey of journeys) {
    await campaignJourneyService.enrollCustomer(businessId, journey.id, customerId).catch(() => undefined);
  }
}

export const campaignJourneyService = new CampaignJourneyService();
