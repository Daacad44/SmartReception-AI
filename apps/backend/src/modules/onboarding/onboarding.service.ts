import { prisma } from '../../infrastructure/database/prisma';
import { authRepository } from '../auth/auth.repository';
import { whatsappModuleService } from '../whatsapp/whatsapp.service';
import { NotFoundError, ValidationError, ForbiddenError } from '../../core/errors';
import type {
  OnboardingBusinessInfoInput,
  OnboardingDescriptionInput,
  OnboardingServicesInput,
  OnboardingWorkingHoursInput,
  OnboardingLanguagesInput,
  OnboardingWhatsAppInput,
} from '@smartreception/shared';
import type { WhatsAppStatus } from '@prisma/client';
import { businessTypesService } from './business-types.service';

const TOTAL_STEPS = 8;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseOnboardingData(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

export class OnboardingService {
  async listBusinessTypes() {
    return businessTypesService.listGrouped();
  }

  async getStatus(userId: string) {
    const memberships = await authRepository.getUserBusinesses(userId);
    const membership = memberships[0];
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { welcomeSeenAt: true, isSuperAdmin: true, pendingBusinessName: true, phone: true },
    });

    if (!membership) {
      await this.ensureBusinessForUser(userId);
      const refreshed = await authRepository.getUserBusinesses(userId);
      if (refreshed[0]) {
        return this.buildStatus(refreshed[0], user);
      }
      throw new NotFoundError('Ganacsi lama abuuri karin. Fadlan mar kale isku day.');
    }

    return this.buildStatus(membership, user);
  }

  private async buildStatus(
    membership: Awaited<ReturnType<typeof authRepository.getUserBusinesses>>[number],
    user: { welcomeSeenAt: Date | null } | null
  ) {
    const business = membership.business;
    const completed = Boolean(business.onboardingCompletedAt);
    const profile = await prisma.businessProfile.findUnique({
      where: { businessId: business.id },
    });
    const onboardingData = parseOnboardingData(business.onboardingData);
    const whatsappAccount = await prisma.whatsAppAccount.findFirst({
      where: { businessId: business.id, isActive: true },
    });
    const whatsappStatus: WhatsAppStatus =
      business.whatsappStatus ?? (whatsappAccount ? 'CONNECTED' : 'NOT_CONNECTED');

    return {
      completed,
      currentStep: completed ? TOTAL_STEPS : Math.min(business.onboardingStep, TOTAL_STEPS - 1),
      totalSteps: TOTAL_STEPS,
      hasBusiness: true,
      welcomeSeen: Boolean(user?.welcomeSeenAt),
      business: {
        id: business.id,
        name: business.name,
        industry: business.industry,
        businessType: business.businessType,
        businessCategory: business.businessCategory,
        phone: business.phone,
        whatsappNumber: business.whatsappNumber,
        country: business.country,
        city: business.city,
        address: business.address,
        website: business.website,
        plan: business.subscription?.plan ?? 'FREE',
        whatsappStatus,
      },
      onboardingData: {
        ...onboardingData,
        description: profile?.businessDescription ?? onboardingData.description,
        services: (onboardingData.services as string[] | undefined) ?? [],
        workingHours: profile?.workingHours
          ? (() => {
              try {
                return JSON.parse(profile.workingHours!) as Record<string, unknown>;
              } catch {
                return onboardingData.workingHours;
              }
            })()
          : onboardingData.workingHours,
        languages: onboardingData.languages,
      },
      whatsappConnected: whatsappStatus === 'CONNECTED',
      whatsappStatus,
    };
  }

  private async ensureBusinessForUser(userId: string) {
    const existing = await authRepository.getUserBusinesses(userId);
    if (existing[0]) return;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const businessName =
      user.pendingBusinessName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email.split('@')[0] ||
      'Ganacsigayga';

    let slug = slugify(businessName) || `business-${userId.slice(0, 8)}`;
    const existingSlug = await prisma.business.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now()}`;

    try {
      await authRepository.createBusinessWithOwner(userId, {
        name: businessName,
        slug,
        phone: user.phone ?? undefined,
        onboardingStep: 0,
      });
    } catch (error) {
      const retry = await authRepository.getUserBusinesses(userId);
      if (retry[0]) return;
      throw error;
    }

    await prisma.user
      .update({ where: { id: userId }, data: { pendingBusinessName: null } })
      .catch(() => undefined);
  }

  private async getOwnerBusiness(userId: string) {
    const memberships = await authRepository.getUserBusinesses(userId);
    if (!memberships[0]) {
      await this.ensureBusinessForUser(userId);
      const retry = await authRepository.getUserBusinesses(userId);
      if (!retry[0]) throw new NotFoundError('Business not found');
      return retry[0];
    }
    return memberships[0];
  }

  async advanceWelcome(userId: string) {
    const membership = await this.getOwnerBusiness(userId);
    await prisma.business.update({
      where: { id: membership.businessId },
      data: { onboardingStep: Math.max(membership.business.onboardingStep, 1) },
    });
    return { step: 1 };
  }

  async saveBusinessInfo(userId: string, input: OnboardingBusinessInfoInput) {
    const membership = await this.getOwnerBusiness(userId);
    const business = await prisma.business.update({
      where: { id: membership.businessId },
      data: {
        name: input.name,
        industry: (input.industry as never) || membership.business.industry || 'OTHER',
        businessType: input.businessType,
        businessCategory: input.businessCategory,
        phone: input.phone,
        whatsappNumber: input.whatsappNumber || input.phone,
        country: input.country,
        city: input.city,
        address: input.address,
        website: input.website || null,
        onboardingStep: Math.max(membership.business.onboardingStep, 2),
      },
      include: { subscription: true },
    });

    await prisma.businessProfile.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        businessName: input.name,
        phone: input.phone,
        website: input.website || null,
        address: input.address,
        city: input.city,
        country: input.country,
      },
      update: {
        businessName: input.name,
        phone: input.phone,
        website: input.website || null,
        address: input.address,
        city: input.city,
        country: input.country,
      },
    });

    return { business, tokens: null };
  }

  async saveDescription(userId: string, businessId: string, input: OnboardingDescriptionInput) {
    await this.assertOwner(userId, businessId);
    const existing = parseOnboardingData(
      (await prisma.business.findUnique({ where: { id: businessId } }))?.onboardingData
    );

    await prisma.businessProfile.upsert({
      where: { businessId },
      create: { businessId, businessName: '', businessDescription: input.description },
      update: { businessDescription: input.description },
    });

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 3,
        onboardingData: { ...existing, description: input.description },
      },
    });
  }

  async saveServices(userId: string, businessId: string, input: OnboardingServicesInput) {
    await this.assertOwner(userId, businessId);
    const existing = parseOnboardingData(
      (await prisma.business.findUnique({ where: { id: businessId } }))?.onboardingData
    );
    const servicesText = input.services.join('\n');

    await prisma.businessProfile.upsert({
      where: { businessId },
      create: { businessId, businessName: '', companyOverview: servicesText },
      update: { companyOverview: servicesText },
    });

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 4,
        onboardingData: { ...existing, services: input.services },
      },
    });
  }

  async saveWorkingHours(userId: string, businessId: string, input: OnboardingWorkingHoursInput) {
    await this.assertOwner(userId, businessId);
    const existing = parseOnboardingData(
      (await prisma.business.findUnique({ where: { id: businessId } }))?.onboardingData
    );
    const hoursText = JSON.stringify(input.workingHours, null, 2);

    await prisma.businessProfile.upsert({
      where: { businessId },
      create: { businessId, businessName: '', workingHours: hoursText },
      update: { workingHours: hoursText },
    });

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 5,
        onboardingData: { ...existing, workingHours: input.workingHours },
      },
    });
  }

  async saveLanguages(userId: string, businessId: string, input: OnboardingLanguagesInput) {
    await this.assertOwner(userId, businessId);
    const existing = parseOnboardingData(
      (await prisma.business.findUnique({ where: { id: businessId } }))?.onboardingData
    );

    await prisma.aIConfiguration.upsert({
      where: { businessId },
      create: { businessId, languages: input.languages },
      update: { languages: input.languages },
    });

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 6,
        onboardingData: { ...existing, languages: input.languages },
      },
    });
  }

  async connectWhatsApp(userId: string, businessId: string, input: OnboardingWhatsAppInput) {
    await this.assertOwner(userId, businessId);

    let whatsappStatus: WhatsAppStatus = 'NOT_CONNECTED';
    let connectionError: string | undefined;

    if (!input.skipConnection && input.phoneNumberId && input.accessToken) {
      try {
        await whatsappModuleService.connectAccount(businessId, {
          phoneNumberId: input.phoneNumberId,
          phoneNumber: input.phoneNumber || input.phoneNumberId,
          displayName: input.displayName || 'WhatsApp Business',
          wabaId: input.wabaId,
          accessToken: input.accessToken,
        });
        await whatsappModuleService.testConnection(businessId);
        whatsappStatus = 'CONNECTED';
      } catch (error) {
        connectionError =
          error instanceof Error ? error.message : 'WhatsApp connection failed';
      }
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const existingData = parseOnboardingData(business?.onboardingData);

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 7,
        whatsappStatus,
        onboardingData: {
          ...existingData,
          whatsappSkipped: Boolean(input.skipConnection),
          whatsappConnectionError: connectionError ?? null,
        },
      },
    });
  }

  async complete(userId: string, businessId: string) {
    await this.assertOwner(userId, businessId);
    const business = await prisma.business.findFirst({ where: { id: businessId } });
    if (!business) throw new NotFoundError('Business not found');
    if (business.onboardingStep < 6) {
      throw new ValidationError('Fadlan dhammaystir dhammaan tallaabooyinka onboarding-ka');
    }

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingStep: TOTAL_STEPS,
        licenseStatus: 'TRIAL',
        isLicenseLocked: false,
      },
    });
  }

  async markWelcomeSeen(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { welcomeSeenAt: new Date() },
    });
  }

  private async assertOwner(userId: string, businessId: string) {
    const membership = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenError('Only business owners can complete onboarding');
    }
  }
}

export const onboardingService = new OnboardingService();
