/**
 * One-off: activate a business, assign a paid plan, and set a future expiry so the
 * subscription-license check passes (unblocks login + WhatsApp AI automation).
 *
 * Resolves the business from its OWNER's email. Sets:
 *   Business.isActive = true, licenseStatus = ACTIVE, isLicenseLocked = false
 *   BusinessSubscription -> chosen plan, status ACTIVE, expiresAt = EXPIRES_AT
 *   legacy Subscription  -> same plan, status ACTIVE (keeps the plan label in sync)
 *
 * Usage (run where DATABASE_URL is set):
 *   OWNER_EMAIL='mimafoundation1@gmail.com' PLAN_CODE='BUSINESS' \
 *     EXPIRES_AT='2026-12-31T23:59:59Z' npx tsx scripts/activate-business.ts
 *
 * PLAN_CODE is one of: STARTER ($49), BUSINESS ($79), PROFESSIONAL ($129),
 *                      ENTERPRISE, FREE, CUSTOM. Defaults to BUSINESS.
 * EXPIRES_AT is any ISO-8601 timestamp. Defaults to 2026-12-31T23:59:59Z.
 */
import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../src/infrastructure/database/prisma';

async function main() {
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
  const planCode = (process.env.PLAN_CODE ?? 'BUSINESS') as SubscriptionPlan;
  const expiresAt = new Date(process.env.EXPIRES_AT ?? '2026-12-31T23:59:59Z');

  if (!email) throw new Error('Set OWNER_EMAIL');
  if (Number.isNaN(expiresAt.getTime())) throw new Error('EXPIRES_AT is not a valid date');
  if (expiresAt.getTime() <= Date.now()) throw new Error('EXPIRES_AT must be in the future');

  const member = await prisma.businessMember.findFirst({
    where: { user: { email }, role: 'OWNER', isActive: true },
    select: { businessId: true, business: { select: { name: true } } },
  });
  if (!member) throw new Error(`No active OWNER membership found for ${email}`);

  const plan = await prisma.subscriptionPlanCatalog.findUnique({ where: { code: planCode } });
  if (!plan) {
    throw new Error(
      `Plan '${planCode}' not found in subscription_plans. ` +
        'Run the plan-price migration first (20260816000000_plan_price_points).'
    );
  }

  const activatedAt = new Date();

  await prisma.$transaction([
    prisma.business.update({
      where: { id: member.businessId },
      data: { isActive: true, licenseStatus: 'ACTIVE', isLicenseLocked: false },
    }),
    prisma.businessSubscription.upsert({
      where: { businessId: member.businessId },
      create: {
        businessId: member.businessId,
        planId: plan.id,
        status: 'ACTIVE',
        durationPreset: 'CUSTOM',
        activatedAt,
        expiresAt,
        isPaused: false,
        isTrial: false,
        pausedAt: null,
        cancelledAt: null,
        lockedAt: null,
        paymentStatus: 'PAID',
        nextRenewalAt: expiresAt,
      },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        activatedAt,
        expiresAt,
        isPaused: false,
        isTrial: false,
        pausedAt: null,
        cancelledAt: null,
        lockedAt: null,
        paymentStatus: 'PAID',
        nextRenewalAt: expiresAt,
      },
    }),
    prisma.subscription.upsert({
      where: { businessId: member.businessId },
      create: {
        businessId: member.businessId,
        plan: planCode,
        status: 'ACTIVE',
        currentPeriodStart: activatedAt,
        currentPeriodEnd: expiresAt,
      },
      update: {
        plan: planCode,
        status: 'ACTIVE',
        currentPeriodStart: activatedAt,
        currentPeriodEnd: expiresAt,
      },
    }),
  ]);

  console.log(`✅ Activated "${member.business?.name}" (${member.businessId})`);
  console.log(`   plan=${planCode}  price=$${plan.monthlyPrice}/mo  status=ACTIVE`);
  console.log(`   expiresAt=${expiresAt.toISOString()}`);
  console.log('   The subscription-license check now passes for this business.');
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
