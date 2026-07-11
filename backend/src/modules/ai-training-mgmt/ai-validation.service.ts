import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { sandboxService } from './sandbox.service';
import { knowledgeGapService } from './knowledge-gap.service';
import { VALIDATION_THRESHOLD } from './ai-knowledge.constants';

type CoverageStatus = 'GOOD' | 'WEAK' | 'MISSING';

interface CoverageCategory {
  key: string;
  label: string;
  coverage: number;
  status: CoverageStatus;
  count: number;
}

function statusFor(coverage: number): CoverageStatus {
  if (coverage >= 70) return 'GOOD';
  if (coverage >= 40) return 'WEAK';
  return 'MISSING';
}

/** 0 chunks → 0; otherwise a graded score that rewards depth up to a cap. */
function depthScore(count: number): number {
  if (count <= 0) return 0;
  return Math.min(100, 40 + count * 15);
}

const PROFILE_FIELDS = [
  'businessName',
  'businessDescription',
  'companyOverview',
  'workingHours',
  'phone',
  'email',
  'website',
  'address',
  'mission',
  'brandTone',
] as const;

/**
 * Enterprise AI validation analytics — all derived from real tenant data.
 *
 * Powers the Knowledge Coverage dashboard (Part 10), pre-test Business
 * Validation (Part 12), the AI Memory Inspector (Part 7) and the final
 * Validation Report (Part 20). Every figure is computed live from PostgreSQL;
 * nothing here is mocked.
 */
export class AiValidationService {
  private profileFill(profile: Prisma.BusinessProfileGetPayload<object> | null): number {
    if (!profile) return 0;
    const filled = PROFILE_FIELDS.filter((f) => {
      const v = (profile as Record<string, unknown>)[f];
      return v != null && String(v).trim() !== '';
    }).length;
    return Math.round((filled / PROFILE_FIELDS.length) * 100);
  }

  private weeklyHoursHasOpenDay(weeklyHours: unknown): boolean {
    if (!weeklyHours || typeof weeklyHours !== 'object') return false;
    const days = Object.values(weeklyHours as Record<string, unknown>);
    return days.some((d) => {
      if (!d || typeof d !== 'object') return false;
      const day = d as Record<string, unknown>;
      return day.enabled === true || day.isOpen === true || day.open != null;
    });
  }

  private async categoryDocCount(businessId: string, needles: string[]): Promise<number> {
    return prisma.knowledgeDocument.count({
      where: {
        status: 'INDEXED',
        knowledgeBase: { businessId },
        OR: needles.map((n) => ({ category: { contains: n, mode: 'insensitive' as const } })),
      },
    });
  }

  async getKnowledgeCoverage(businessId: string) {
    const [profile, serviceCount, pricedServiceCount, settings, faqCount, chunkCount, docTotals] =
      await Promise.all([
        prisma.businessProfile.findUnique({ where: { businessId } }),
        prisma.service.count({ where: { businessId, isActive: true } }),
        prisma.service.count({ where: { businessId, isActive: true, NOT: { price: null } } }),
        prisma.appointmentSettings.findUnique({ where: { businessId } }),
        prisma.knowledgeDocument.count({
          where: { type: 'FAQ', status: 'INDEXED', knowledgeBase: { businessId } },
        }),
        prisma.knowledgeChunk.count({ where: { businessId, isActive: true, status: 'ACTIVE' } }),
        this.categoryDocCount(businessId, ['product']),
      ]);

    const [policyDocs, pricingDocs, supportDocs] = await Promise.all([
      this.categoryDocCount(businessId, ['policy', 'policies', 'refund', 'cancel']),
      this.categoryDocCount(businessId, ['pric', 'cost', 'fee']),
      this.categoryDocCount(businessId, ['support', 'help', 'complaint']),
    ]);

    const profileCoverage = this.profileFill(profile);
    const hasWorkingHours =
      this.weeklyHoursHasOpenDay(settings?.weeklyHours) ||
      (profile?.workingHours != null && String(profile.workingHours).trim() !== '');
    const hasContact = Boolean(profile?.phone || profile?.email || profile?.website);
    const pricingCoverage = depthScore(pricingDocs + (pricedServiceCount > 0 ? 1 : 0));

    const categories: CoverageCategory[] = [
      { key: 'business_profile', label: 'Business Profile', coverage: profileCoverage, status: statusFor(profileCoverage), count: 1 },
      { key: 'products', label: 'Products', coverage: depthScore(docTotals), status: statusFor(depthScore(docTotals)), count: docTotals },
      { key: 'services', label: 'Services', coverage: depthScore(serviceCount), status: statusFor(depthScore(serviceCount)), count: serviceCount },
      { key: 'faqs', label: 'FAQs', coverage: depthScore(faqCount), status: statusFor(depthScore(faqCount)), count: faqCount },
      { key: 'policies', label: 'Policies', coverage: depthScore(policyDocs), status: statusFor(depthScore(policyDocs)), count: policyDocs },
      { key: 'pricing', label: 'Pricing', coverage: pricingCoverage, status: statusFor(pricingCoverage), count: pricingDocs + pricedServiceCount },
      { key: 'appointments', label: 'Appointments', coverage: settings ? 100 : 0, status: statusFor(settings ? 100 : 0), count: settings ? 1 : 0 },
      { key: 'working_hours', label: 'Working Hours', coverage: hasWorkingHours ? 100 : 0, status: statusFor(hasWorkingHours ? 100 : 0), count: hasWorkingHours ? 1 : 0 },
      { key: 'support', label: 'Support', coverage: depthScore(supportDocs), status: statusFor(depthScore(supportDocs)), count: supportDocs },
      { key: 'contact', label: 'Contact', coverage: hasContact ? 100 : 0, status: statusFor(hasContact ? 100 : 0), count: hasContact ? 1 : 0 },
    ];

    const healthPercent = Math.round(
      categories.reduce((sum, c) => sum + c.coverage, 0) / categories.length
    );
    const weakCategories = categories.filter((c) => c.status !== 'GOOD').map((c) => c.label);

    const gapSummary = await knowledgeGapService.summary(businessId);
    const recommendedTraining = [
      ...categories
        .filter((c) => c.status === 'MISSING')
        .map((c) => `Add ${c.label} knowledge — currently missing.`),
      ...gapSummary.topOpen.map(
        (g) => `Unanswered ×${g.frequency}: "${g.question}" — ${g.recommendation ?? 'add knowledge'}`
      ),
    ];

    return {
      categories,
      healthPercent,
      weakCategories,
      recommendedTraining,
      totalChunks: chunkCount,
      openKnowledgeGaps: gapSummary.open,
    };
  }

  async getBusinessValidation(businessId: string) {
    const [profile, docCount, embeddedChunks, workspace, settings, serviceCount, productDocs] =
      await Promise.all([
        prisma.businessProfile.findUnique({ where: { businessId } }),
        prisma.knowledgeDocument.count({ where: { knowledgeBase: { businessId } } }),
        prisma.knowledgeChunk.count({
          where: { businessId, isActive: true, status: 'ACTIVE', NOT: { embedding: { equals: Prisma.DbNull } } },
        }),
        prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }),
        prisma.appointmentSettings.findUnique({ where: { businessId } }),
        prisma.service.count({ where: { businessId, isActive: true } }),
        this.categoryDocCount(businessId, ['product']),
      ]);

    const profileComplete = this.profileFill(profile) >= 50;

    const checks = [
      { key: 'profile', label: 'Business profile complete', ok: profileComplete, detail: profileComplete ? 'Profile has enough detail' : 'Fill in more business profile fields' },
      { key: 'knowledge', label: 'Knowledge uploaded', ok: docCount > 0, detail: `${docCount} document(s)` },
      { key: 'embeddings', label: 'Embeddings built', ok: embeddedChunks > 0, detail: `${embeddedChunks} embedded chunk(s)` },
      { key: 'training', label: 'Training completed', ok: Boolean(workspace?.lastTrainedAt), detail: workspace?.lastTrainedAt ? 'Trained' : 'Run training first' },
      { key: 'appointments', label: 'Appointment settings configured', ok: Boolean(settings), detail: settings ? 'Configured' : 'Configure appointment settings' },
      { key: 'working_hours', label: 'Working hours configured', ok: this.weeklyHoursHasOpenDay(settings?.weeklyHours), detail: this.weeklyHoursHasOpenDay(settings?.weeklyHours) ? 'Configured' : 'Set weekly working hours' },
      { key: 'services', label: 'Services available', ok: serviceCount > 0, detail: `${serviceCount} service(s)` },
      { key: 'products', label: 'Products available', ok: productDocs > 0, detail: `${productDocs} product document(s)` },
    ];

    const warnings = checks.filter((c) => !c.ok).map((c) => c.detail);
    return { checks, warnings, ready: warnings.length === 0 };
  }

  async getMemoryInspector(businessId: string) {
    const [business, profile, services, settings, workspace, docAgg, indexedCount, faqCount, chunkCount, lastDeployment, sandboxVersion, productionVersion] =
      await Promise.all([
        prisma.business.findUnique({ where: { id: businessId }, select: { name: true, isActive: true } }),
        prisma.businessProfile.findUnique({ where: { businessId } }),
        prisma.service.findMany({ where: { businessId, isActive: true }, select: { name: true, price: true }, take: 25 }),
        prisma.appointmentSettings.findUnique({ where: { businessId } }),
        prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }),
        prisma.knowledgeDocument.count({ where: { knowledgeBase: { businessId } } }),
        prisma.knowledgeDocument.count({ where: { status: 'INDEXED', knowledgeBase: { businessId } } }),
        prisma.knowledgeDocument.count({ where: { type: 'FAQ', knowledgeBase: { businessId } } }),
        prisma.knowledgeChunk.count({ where: { businessId, isActive: true, status: 'ACTIVE' } }),
        prisma.aiDeploymentRequest.findFirst({ where: { businessId, status: 'DEPLOYED' }, orderBy: { deployedAt: 'desc' } }),
        prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }).then((w) =>
          w?.sandboxVersionId ? prisma.aiTrainingVersion.findUnique({ where: { id: w.sandboxVersionId } }) : null
        ),
        prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }).then((w) =>
          w?.productionVersionId ? prisma.aiTrainingVersion.findUnique({ where: { id: w.productionVersionId } }) : null
        ),
      ]);

    return {
      business: { name: business?.name ?? null, aiStatus: business?.isActive ? 'ACTIVE' : 'INACTIVE' },
      profile: profile
        ? {
            businessName: profile.businessName,
            description: profile.businessDescription ?? profile.companyOverview,
            phone: profile.phone,
            email: profile.email,
            website: profile.website,
            workingHours: profile.workingHours,
            languages: profile.languages,
          }
        : null,
      services: services.map((s) => ({ name: s.name, price: s.price ? Number(s.price) : null })),
      appointmentRules: settings
        ? {
            slotDurationMinutes: settings.slotDurationMinutes,
            bufferBeforeMinutes: settings.bufferBeforeMinutes,
            bufferAfterMinutes: settings.bufferAfterMinutes,
            blockedDates: Array.isArray(settings.blockedDates) ? settings.blockedDates.length : 0,
          }
        : null,
      knowledge: { documents: docAgg, indexed: indexedCount, faqs: faqCount, embeddings: chunkCount },
      versions: {
        sandboxVersion: sandboxVersion?.versionNumber ?? null,
        productionVersion: productionVersion?.versionNumber ?? null,
        embeddingVersion: sandboxVersion?.embeddingVersion ?? productionVersion?.embeddingVersion ?? null,
        knowledgeScore: workspace?.knowledgeScore ?? null,
        readinessScore: workspace?.aiReadinessScore ?? null,
      },
      lastTrainedAt: workspace?.lastTrainedAt ?? null,
      lastDeployedAt: lastDeployment?.deployedAt ?? null,
    };
  }

  /** Consolidated final validation report (Part 20). */
  async getValidationReport(businessId: string, sessionId?: string) {
    const [coverage, validation, checklist, business] = await Promise.all([
      this.getKnowledgeCoverage(businessId),
      this.getBusinessValidation(businessId),
      sandboxService.getReadinessChecklist(businessId),
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);

    let sandboxReport: Awaited<ReturnType<typeof sandboxService.getTestReport>> | null = null;
    if (sessionId) {
      sandboxReport = await sandboxService.getTestReport(businessId, sessionId).catch(() => null);
    } else {
      const latest = await prisma.aiSandboxSession.findFirst({
        where: { businessId, messages: { some: { role: 'ASSISTANT' } } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (latest) sandboxReport = await sandboxService.getTestReport(businessId, latest.id).catch(() => null);
    }

    const evaluationItem = checklist.items.find((i) => i.key === 'evaluation_passed');
    const sandboxPassed = sandboxReport?.passed ?? false;
    const coverageOk = coverage.healthPercent >= VALIDATION_THRESHOLD;
    const pass =
      validation.ready &&
      coverageOk &&
      checklist.failed === 0 &&
      evaluationItem?.state !== 'FAILED' &&
      (sandboxReport ? sandboxPassed : false);

    const deploymentRecommendation = pass
      ? 'READY — all validation gates passed. Submit for deployment review.'
      : 'NOT READY — resolve the outstanding validation items before deployment.';

    return {
      businessName: business?.name ?? null,
      generatedAt: new Date().toISOString(),
      knowledgeHealth: coverage.healthPercent,
      coverage: coverage.categories,
      weakCategories: coverage.weakCategories,
      missingKnowledge: coverage.openKnowledgeGaps,
      recommendedTraining: coverage.recommendedTraining,
      businessValidation: validation,
      readinessChecklist: checklist,
      sandboxReport,
      confidenceAverage: sandboxReport?.avgGroundedConfidence ?? null,
      readinessProgress: checklist.progress,
      deploymentRecommendation,
      overallReadiness: pass ? 100 : Math.round((checklist.progress + coverage.healthPercent) / 2),
      result: pass ? 'PASS' : 'FAIL',
    };
  }
}

export const aiValidationService = new AiValidationService();
