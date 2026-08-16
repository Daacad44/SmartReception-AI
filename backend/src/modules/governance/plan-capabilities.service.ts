import { prisma } from '../../infrastructure/database/prisma';
import type { GovernanceCapabilities } from '@smartreception/shared';
import { DEFAULT_FEATURE_FLAGS, type PlanFeatureFlags } from '../subscription/subscription.types';
import type { SubscriptionPlan } from '@prisma/client';
import { whatsappConnectionRequestService } from '../whatsapp/whatsapp-connection-request.service';

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

  const planWhatsappAccess: GovernanceCapabilities['whatsappAccess'] =
    enterprise && flags.whatsappSelfService ? 'approval_required' : 'hidden';

  // A time-boxed connection window (or a completed self-serve connection) widens
  // the plan-derived access to 'full' — never narrows it. This single override
  // both unlocks the business self-serve UI and lets the WhatsApp connect guard
  // proceed, because everything keys off `whatsappAccess`.
  const { effectiveFull, window } =
    await whatsappConnectionRequestService.getConnectionWindowState(businessId);
  const whatsappAccess: GovernanceCapabilities['whatsappAccess'] = effectiveFull
    ? 'full'
    : planWhatsappAccess;

  return {
    planCode,
    aiTrainingAccess: enterprise ? 'approval_required' : 'readonly',
    whatsappAccess,
    canRequestAiChanges: enterprise,
    canRequestWhatsAppConnect: enterprise && flags.whatsappSelfService,
    requiresSuperAdminForAi: !enterprise,
    whatsappConnectionWindow: window,
  };
}
