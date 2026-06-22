import { prisma } from '../../infrastructure/database/prisma';

export class SuperAdminService {
  async getPlatformStats() {
    const [businesses, users, appointments, customers, activeSubscriptions] = await Promise.all([
      prisma.business.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.appointment.count(),
      prisma.customer.count(),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
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
      planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: p._count.plan })),
    };
  }

  async listBusinesses(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.business.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: { select: { members: true, customers: true, appointments: true } },
        },
      }),
      prisma.business.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async toggleBusinessActive(businessId: string, isActive: boolean) {
    return prisma.business.update({ where: { id: businessId }, data: { isActive } });
  }
}

export const superAdminService = new SuperAdminService();
