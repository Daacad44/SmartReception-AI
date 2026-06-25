import { prisma } from '../../infrastructure/database/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import {
  SuperAdminCreateBusinessInput,
  SuperAdminUpdateBusinessInput,
  SuperAdminCreateUserInput,
  SuperAdminUpdateUserInput,
  TransferOwnershipInput,
} from '@smartreception/shared';
import { passwordService } from '../../infrastructure/auth/password.service';
import { authRepository } from '../auth/auth.repository';
import { tokenService } from '../../infrastructure/auth/token.service';
import type { Industry, SubscriptionPlan, UserRole } from '@prisma/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class SuperAdminService {
  async getPlatformStats() {
    const [businesses, users, appointments, customers, activeSubscriptions, messageCount] =
      await Promise.all([
        prisma.business.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.appointment.count(),
        prisma.customer.count(),
        prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
        prisma.message.count({ where: { isAiGenerated: true } }),
      ]);

    const planBreakdown = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    return {
      businesses,
      users,
      appointments,
      customers,
      activeSubscriptions,
      aiMessages: messageCount,
      planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: p._count.plan })),
    };
  }

  async listBusinesses(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [data, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          whatsappAccounts: { where: { isActive: true }, take: 1, select: { phoneNumber: true, displayName: true } },
          members: {
            where: { role: 'OWNER' },
            take: 1,
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
          _count: { select: { members: true, customers: true, appointments: true } },
        },
      }),
      prisma.business.count({ where }),
    ]);

    const aiUsageByBusiness = await Promise.all(
      data.map((business) =>
        prisma.message.count({
          where: { isAiGenerated: true, conversation: { businessId: business.id } },
        })
      )
    );

    return {
      data: data.map((b, index) => ({
        ...b,
        owner: b.members[0]?.user ?? null,
        whatsappNumber: b.whatsappAccounts[0]?.phoneNumber ?? b.phone,
        plan: b.subscription?.plan ?? 'FREE',
        activeCustomers: b._count.customers,
        aiUsage: aiUsageByBusiness[index] ?? 0,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBusiness(businessId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscription: true,
        whatsappAccounts: true,
        members: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        _count: { select: { customers: true, appointments: true, conversations: true } },
      },
    });
    if (!business) throw new NotFoundError('Business not found');
    return business;
  }

  async createBusiness(input: SuperAdminCreateBusinessInput, adminUserId: string) {
    let owner = await prisma.user.findUnique({ where: { email: input.ownerEmail } });

    if (!owner) {
      if (!input.ownerPassword) {
        throw new ValidationError('ownerPassword is required when creating a new owner account');
      }
      const passwordHash = await passwordService.hash(input.ownerPassword);
      owner = await authRepository.createUser({
        email: input.ownerEmail,
        passwordHash,
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        isEmailVerified: true,
      });
    }

    let slug = slugify(input.name);
    const existingSlug = await prisma.business.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now()}`;

    const { business } = await authRepository.createBusinessWithOwner(owner.id, {
      name: input.name,
      slug,
      industry: input.industry as Industry | undefined,
      phone: input.phone,
    });

    if (input.plan) {
      await prisma.subscription.upsert({
        where: { businessId: business.id },
        create: { businessId: business.id, plan: input.plan as SubscriptionPlan, status: 'ACTIVE' },
        update: { plan: input.plan as SubscriptionPlan, status: 'ACTIVE' },
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        userId: adminUserId,
        action: 'CREATE',
        entity: 'Business',
        entityId: business.id,
        newData: { name: input.name, ownerEmail: input.ownerEmail },
      },
    });

    return this.getBusiness(business.id);
  }

  async updateBusiness(businessId: string, input: SuperAdminUpdateBusinessInput, adminUserId: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } });
    if (!existing) throw new NotFoundError('Business not found');

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        name: input.name,
        industry: input.industry as Industry | undefined,
        phone: input.phone,
        email: input.email,
        isActive: input.isActive,
      },
    });

    if (input.plan) {
      await prisma.subscription.upsert({
        where: { businessId },
        create: { businessId, plan: input.plan as SubscriptionPlan, status: 'ACTIVE' },
        update: { plan: input.plan as SubscriptionPlan },
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'Business',
        entityId: businessId,
        newData: input as object,
      },
    });

    return business;
  }

  async deleteBusiness(businessId: string, adminUserId: string) {
    const existing = await prisma.business.findUnique({ where: { id: businessId } });
    if (!existing) throw new NotFoundError('Business not found');

    await prisma.business.delete({ where: { id: businessId } });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DELETE',
        entity: 'Business',
        entityId: businessId,
        newData: { name: existing.name },
      },
    });
  }

  async transferOwnership(businessId: string, input: TransferOwnershipInput, adminUserId: string) {
    const membership = await prisma.businessMember.findFirst({
      where: { businessId, userId: input.newOwnerUserId, isActive: true },
    });
    if (!membership) throw new NotFoundError('User is not a member of this business');

    await prisma.$transaction([
      prisma.businessMember.updateMany({
        where: { businessId, role: 'OWNER' },
        data: { role: 'ADMIN' },
      }),
      prisma.businessMember.update({
        where: { businessId_userId: { businessId, userId: input.newOwnerUserId } },
        data: { role: 'OWNER' },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'Business',
        entityId: businessId,
        newData: { transferOwnershipTo: input.newOwnerUserId },
      },
    });
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isSuperAdmin: true,
          totpEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          businessMemberships: {
            include: { business: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createUser(input: SuperAdminCreateUserInput, adminUserId: string) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await passwordService.hash(input.password);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      isEmailVerified: true,
      isSuperAdmin: input.isSuperAdmin,
    });

    if (input.businessId && input.role) {
      await prisma.businessMember.create({
        data: {
          businessId: input.businessId,
          userId: user.id,
          role: input.role as UserRole,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId: input.businessId,
        userId: adminUserId,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        newData: { email: input.email, role: input.role },
      },
    });

    return user;
  }

  async updateUser(userId: string, input: SuperAdminUpdateUserInput, adminUserId: string) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: input.isActive,
        isSuperAdmin: input.isSuperAdmin,
        totpEnabled: input.totpEnabled,
      },
    });

    if (input.businessId && input.role) {
      await prisma.businessMember.upsert({
        where: { businessId_userId: { businessId: input.businessId, userId } },
        create: { businessId: input.businessId, userId, role: input.role as UserRole },
        update: { role: input.role as UserRole, isActive: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId: input.businessId,
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        newData: input as object,
      },
    });

    return user;
  }

  async deleteUser(userId: string, adminUserId: string) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');
    if (existing.isSuperAdmin) throw new ValidationError('Cannot delete super admin accounts');

    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DELETE',
        entity: 'User',
        entityId: userId,
      },
    });
  }

  async resetPassword(userId: string, newPassword: string, adminUserId: string) {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');

    const passwordHash = await passwordService.hash(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        newData: { event: 'password_reset' },
      },
    });
  }

  async toggleBusinessActive(businessId: string, isActive: boolean, adminUserId: string) {
    const business = await prisma.business.update({ where: { id: businessId }, data: { isActive } });
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'Business',
        entityId: businessId,
        newData: { isActive },
      },
    });
    return business;
  }

  /** Issue a short-lived access token for super-admin support impersonation of a business workspace. */
  async impersonateBusiness(businessId: string, adminUserId: string, adminEmail: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    if (!business) throw new NotFoundError('Business not found');
    if (!business.isActive) throw new ValidationError('Cannot impersonate a suspended business');

    const accessToken = tokenService.generateAccessToken({
      userId: adminUserId,
      email: adminEmail,
      businessId: business.id,
      role: 'OWNER',
      isSuperAdmin: true,
      impersonating: true,
    });

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        userId: adminUserId,
        action: 'UPDATE',
        entity: 'Business',
        entityId: business.id,
        newData: { event: 'super_admin_impersonation' },
      },
    });

    return { accessToken, business };
  }
}

export const superAdminService = new SuperAdminService();
