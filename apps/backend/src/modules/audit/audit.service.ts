import { prisma } from '../../infrastructure/database/prisma';
import { PaginationInput } from '@smartreception/shared';

export class AuditService {
  async list(
    businessId: string,
    params: PaginationInput & { entity?: string; action?: string }
  ) {
    const { page, limit, entity, action } = params;
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      ...(entity && { entity }),
      ...(action && { action: action as 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();
