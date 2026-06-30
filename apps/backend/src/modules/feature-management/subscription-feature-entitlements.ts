import type { PlanFeatureFlags } from '../subscription/subscription.types';
import { DEFAULT_FEATURE_FLAGS } from '../subscription/subscription.types';
import { prisma } from '../../infrastructure/database/prisma';

const SUBSCRIPTION_FEATURE_MAP: Partial<Record<string, keyof PlanFeatureFlags>> = {
  campaigns: 'campaigns',
  'employee-comms': 'broadcast',
  analytics: 'analytics',
  'business-intelligence': 'analytics',
  'ai-analytics': 'analytics',
  appointments: 'appointments',
  'appointment-automation': 'appointments',
  'ai-training': 'knowledgeBase',
  'enterprise-ai-intelligence': 'knowledgeBase',
};

function parseFeatureFlags(raw: unknown): PlanFeatureFlags {
  if (!raw || typeof raw !== 'object') return DEFAULT_FEATURE_FLAGS;
  return { ...DEFAULT_FEATURE_FLAGS, ...(raw as PlanFeatureFlags) };
}

export async function isSubscriptionFeatureEntitled(
  featureKey: string,
  businessId: string
): Promise<boolean> {
  const flagKey = SUBSCRIPTION_FEATURE_MAP[featureKey];
  if (!flagKey) return false;

  const subscription = await prisma.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });

  if (!subscription?.plan) return false;

  const flags = parseFeatureFlags(subscription.plan.featureFlags);
  if (flags[flagKey]) return true;

  if (featureKey === 'campaigns' && (subscription.plan.campaignLimit ?? 0) > 0) {
    return true;
  }

  return false;
}
