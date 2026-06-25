import { prisma } from '../../infrastructure/database/prisma';
import { User, Business, BusinessMember } from '@prisma/client';

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    emailOtpHash?: string;
    emailOtpExpires?: Date;
    emailOtpAttempts?: number;
    isEmailVerified?: boolean;
    isSuperAdmin?: boolean;
  }): Promise<User> {
    return prisma.user.create({ data });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async createBusinessWithOwner(
    userId: string,
    businessData: {
      name: string;
      slug: string;
      industry?: string;
      phone?: string;
      onboardingStep?: number;
    }
  ): Promise<{ business: Business; membership: BusinessMember }> {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessData.name,
          slug: businessData.slug,
          industry: (businessData.industry as never) || 'OTHER',
          phone: businessData.phone,
          onboardingStep: businessData.onboardingStep ?? 1,
        },
      });

      const membership = await tx.businessMember.create({
        data: {
          businessId: business.id,
          userId,
          role: 'OWNER',
        },
      });

      await tx.subscription.create({
        data: {
          businessId: business.id,
          plan: 'FREE',
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.aIConfiguration.create({
        data: { businessId: business.id },
      });

      await tx.knowledgeBase.create({
        data: {
          businessId: business.id,
          name: 'Default Knowledge Base',
        },
      });

      return { business, membership };
    });
  }

  async getUserBusinesses(userId: string) {
    return prisma.businessMember.findMany({
      where: { userId, isActive: true },
      include: {
        business: {
          include: { subscription: true },
        },
      },
    });
  }
}

export const authRepository = new AuthRepository();
