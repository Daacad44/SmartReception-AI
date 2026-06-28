import { prisma } from '../../infrastructure/database/prisma';
import type { GovernanceCapabilities } from '@smartreception/shared';
import { DEFAULT_FEATURE_FLAGS, type PlanFeatureFlags } from '../subscription/subscription.types';
import type { SubscriptionPlan } from '@prisma/client';

function parseFeatureFlags(raw: unknown): PlanFeatureFlags {
  if (!raw || typeof raw !== 'object') return DEFAULT_FEATURE_FLAGS;
  return { ...DEFAULT_FEATURE_FLAGS, ...(raw as PlanFeatureFlags) };
}

function isEnterprisePlan(planCode: SubscriptionPlan | string): boolean {
  return planCode === 'ENTERPRISE' || planCode === 'CUSTOM';
}

export async function getGovernanceCapabilities(
  businessId: string
): Promise<GovernanceCapabilities> {
  const sub = await prisma.businessSubscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });

  const planCode = sub?.plan?.code ?? 'STARTER';
  const flags = parseFeatureFlags(sub?.plan?.featureFlags);
  const enterprise = isEnterprisePlan(planCode) && flags.aiTrainingManage;

  return {
    planCode,
    aiTrainingAccess: enterprise ? 'approval_required' : 'readonly',
    whatsappAccess:
      enterprise && flags.whatsappSelfService ? 'approval_required' : 'hidden',
    canRequestAiChanges: enterprise,
    canRequestWhatsAppConnect: enterprise && flags.whatsappSelfService,
    requiresSuperAdminForAi: !enterprise,
  };
}
