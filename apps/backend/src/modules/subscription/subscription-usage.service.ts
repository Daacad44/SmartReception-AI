import { prisma } from '../../infrastructure/database/prisma';
import type { PlanFeatureFlags } from './subscription.types';
import { DEFAULT_FEATURE_FLAGS } from './subscription.types';

export interface UsageMetric {
  used: number;
  limit: number;
  percent: number;
}

export interface BusinessUsageSnapshot {
  conversations: UsageMetric;
  customers: UsageMetric;
  users: UsageMetric;
  knowledgeBases: UsageMetric;
  appointments: UsageMetric;
  campaigns: UsageMetric;
  broadcasts: UsageMetric;
  storageMb: UsageMetric;
  whatsappNumbers: UsageMetric;
  featureFlags: PlanFeatureFlags;
}

function metric(used: number, limit: number): UsageMetric {
  const safeLimit = limit > 0 ? limit : 1;
  return {
    used,
    limit,
    percent: Math.min(100, Math.round((used / safeLimit) * 100)),
  };
}

function parseFeatureFlags(raw: unknown): PlanFeatureFlags {
  if (!raw || typeof raw !== 'object') return DEFAULT_FEATURE_FLAGS;
  return { ...DEFAULT_FEATURE_FLAGS, ...(raw as PlanFeatureFlags) };
}

export async function getBusinessUsageSnapshot(businessId: string): Promise<BusinessUsageSnapshot> {
  const sub = await prisma.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });

  const plan = sub?.plan;
  const limits = {
    conversations: plan?.maxConversations ?? 100,
    customers: plan?.maxConversations ?? 100,
    users: plan?.maxUsers ?? 1,
    knowledgeBases: plan?.knowledgeBaseLimit ?? 1,
    appointments: plan?.appointmentLimit ?? 50,
    campaigns: plan?.campaignLimit ?? 0,
    storageMb: plan?.storageLimitMb ?? 512,
    whatsappNumbers: plan?.maxWhatsappNumbers ?? 1,
  };

  const [
    conversations,
    customers,
    users,
    knowledgeBases,
    appointments,
    campaigns,
    broadcasts,
    whatsappNumbers,
    docBytes,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId } }),
    prisma.customer.count({ where: { businessId, isActive: true } }),
    prisma.businessMember.count({ where: { businessId, isActive: true } }),
    prisma.knowledgeBase.count({ where: { businessId } }),
    prisma.appointment.count({ where: { businessId } }),
    prisma.campaign.count({ where: { businessId } }),
    prisma.employeeBroadcast.count({ where: { businessId } }),
    prisma.whatsAppAccount.count({ where: { businessId, isActive: true } }),
    prisma.knowledgeDocument.aggregate({
      where: { knowledgeBase: { businessId } },
      _sum: { fileSize: true },
    }),
  ]);

  const storageMb = Math.ceil((docBytes._sum.fileSize ?? 0) / (1024 * 1024));

  return {
    conversations: metric(conversations, limits.conversations),
    customers: metric(customers, limits.customers),
    users: metric(users, limits.users),
    knowledgeBases: metric(knowledgeBases, limits.knowledgeBases),
    appointments: metric(appointments, limits.appointments),
    campaigns: metric(campaigns, limits.campaigns),
    broadcasts: metric(broadcasts, limits.campaigns),
    storageMb: metric(storageMb, limits.storageMb),
    whatsappNumbers: metric(whatsappNumbers, limits.whatsappNumbers),
    featureFlags: parseFeatureFlags(plan?.featureFlags),
  };
}
