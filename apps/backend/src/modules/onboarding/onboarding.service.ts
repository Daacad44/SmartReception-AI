import { prisma } from '../../infrastructure/database/prisma';
import { authRepository } from '../auth/auth.repository';
import { whatsappModuleService } from '../whatsapp/whatsapp.service';
import { tokenService } from '../../infrastructure/auth/token.service';
import { NotFoundError, ValidationError, ForbiddenError } from '../../core/errors';
import type {
  OnboardingBusinessInfoInput,
  OnboardingProfileInput,
  OnboardingDiscoveryInput,
  OnboardingPlanInput,
  OnboardingWhatsAppInput,
} from '@smartreception/shared';
import type { Industry, SubscriptionPlan } from '@prisma/client';
import { businessTypesService } from './business-types.service';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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
      select: { welcomeSeenAt: true, isSuperAdmin: true },
    });

    if (!membership) {
      return {
        completed: false,
        currentStep: 0,
        totalSteps: 5,
        hasBusiness: false,
        welcomeSeen: Boolean(user?.welcomeSeenAt),
        business: null,
        whatsappConnected: false,
      };
    }

    const business = membership.business;
    const completed = Boolean(business.onboardingCompletedAt);
    const whatsappAccount = await prisma.whatsAppAccount.findFirst({
      where: { businessId: business.id, isActive: true },
    });

    return {
      completed,
      currentStep: completed ? 5 : Math.max(business.onboardingStep, 1),
      totalSteps: 5,
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
        employeeRange: business.employeeRange,
        customerVolume: business.customerVolume,
        mainGoal: business.mainGoal,
        plan: business.subscription?.plan ?? 'FREE',
        onboardingData: business.onboardingData,
      },
      whatsappConnected: Boolean(whatsappAccount),
    };
  }

  async saveBusinessInfo(userId: string, input: OnboardingBusinessInfoInput) {
    const memberships = await authRepository.getUserBusinesses(userId);

    if (memberships.length > 0) {
      const business = await prisma.business.update({
        where: { id: memberships[0].businessId },
        data: {
          name: input.name,
          industry: input.industry as Industry,
          businessType: input.businessType,
          businessCategory: input.businessCategory,
          phone: input.phone,
          whatsappNumber: input.whatsappNumber,
          country: input.country,
          city: input.city,
          address: input.address,
          website: input.website || null,
          onboardingStep: Math.max(memberships[0].business.onboardingStep, 1),
        },
        include: { subscription: true },
      });
      return { business, tokens: null };
    }

    let slug = slugify(input.name);
    const existingSlug = await prisma.business.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now()}`;

    const { business } = await authRepository.createBusinessWithOwner(userId, {
      name: input.name,
      slug,
      industry: input.industry,
      phone: input.phone,
      onboardingStep: 1,
    });

    await prisma.business.update({
      where: { id: business.id },
      data: {
        businessType: input.businessType,
        businessCategory: input.businessCategory,
        whatsappNumber: input.whatsappNumber,
        country: input.country,
        city: input.city,
        address: input.address,
        website: input.website || null,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const tokens = await tokenService.createTokenPair(userId, user.email, business.id, 'OWNER');

    return { business, tokens };
  }

  async saveProfile(userId: string, businessId: string, input: OnboardingProfileInput) {
    await this.assertOwner(userId, businessId);
    return prisma.business.update({
      where: { id: businessId },
      data: {
        employeeRange: input.employeeRange,
        customerVolume: input.customerVolume,
        mainGoal: input.mainGoal,
        onboardingStep: 2,
      },
    });
  }

  async saveDiscovery(userId: string, businessId: string, input: OnboardingDiscoveryInput) {
    await this.assertOwner(userId, businessId);
    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingStep: 3,
        onboardingData: {
          referralSource: input.referralSource,
          problemToSolve: input.problemToSolve,
          biggestChallenge: input.biggestChallenge,
        },
      },
    });
  }

  async savePlan(userId: string, businessId: string, input: OnboardingPlanInput) {
    await this.assertOwner(userId, businessId);
    const plan = input.plan as SubscriptionPlan;
    const status = plan === 'FREE' ? 'TRIALING' : 'ACTIVE';

    await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan,
        status,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      update: { plan, status },
    });

    return prisma.business.update({
      where: { id: businessId },
      data: { onboardingStep: 4 },
    });
  }

  async connectWhatsApp(userId: string, businessId: string, input: OnboardingWhatsAppInput) {
    await this.assertOwner(userId, businessId);

    if (!input.skipConnection) {
      await whatsappModuleService.connectAccount(businessId, {
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber || input.phoneNumberId,
        displayName: input.displayName || 'WhatsApp Business',
        wabaId: input.wabaId,
        accessToken: input.accessToken,
      });

      await whatsappModuleService.testConnection(businessId);
    }

    return prisma.business.update({
      where: { id: businessId },
      data: { onboardingStep: 5 },
    });
  }

  async complete(userId: string, businessId: string) {
    await this.assertOwner(userId, businessId);
    const business = await prisma.business.findFirst({ where: { id: businessId } });
    if (!business) throw new NotFoundError('Business not found');
    if (business.onboardingStep < 4) {
      throw new ValidationError('Please complete all onboarding steps first');
    }

    return prisma.business.update({
      where: { id: businessId },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingStep: 5,
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
