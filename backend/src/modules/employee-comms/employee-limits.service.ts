import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError } from '../../core/errors';

export type EmployeeCommPlanLimits = {
  maxEmployees: number;
  maxMessagesPerMonth: number;
  aiGenerator: boolean;
  priorityQueue: boolean;
  unlimitedScheduling: boolean;
};

const PLAN_LIMITS: Record<SubscriptionPlan, EmployeeCommPlanLimits> = {
  FREE: { maxEmployees: 5, maxMessagesPerMonth: 50, aiGenerator: false, priorityQueue: false, unlimitedScheduling: false },
  STARTER: { maxEmployees: 20, maxMessagesPerMonth: 500, aiGenerator: false, priorityQueue: false, unlimitedScheduling: false },
  BUSINESS: { maxEmployees: 2000, maxMessagesPerMonth: 50000, aiGenerator: true, priorityQueue: false, unlimitedScheduling: true },
  PROFESSIONAL: { maxEmployees: 500, maxMessagesPerMonth: 10000, aiGenerator: true, priorityQueue: false, unlimitedScheduling: true },
  ENTERPRISE: { maxEmployees: 999999, maxMessagesPerMonth: 9999999, aiGenerator: true, priorityQueue: true, unlimitedScheduling: true },
  CUSTOM: { maxEmployees: 999999, maxMessagesPerMonth: 9999999, aiGenerator: true, priorityQueue: true, unlimitedScheduling: true },
};

export async function getEmployeeCommLimits(businessId: string): Promise<EmployeeCommPlanLimits> {
  const subscription = await prisma.subscription.findUnique({
    where: { businessId },
    select: { plan: true },
  });
  return PLAN_LIMITS[subscription?.plan ?? 'FREE'];
}

export async function assertEmployeeCreateAllowed(businessId: string): Promise<void> {
  const limits = await getEmployeeCommLimits(businessId);
  const count = await prisma.employee.count({ where: { businessId, isActive: true } });
  if (count >= limits.maxEmployees) {
    throw new ValidationError(`Plan limit reached: maximum ${limits.maxEmployees} employees`);
  }
}

export async function assertEmployeeBroadcastAllowed(
  businessId: string,
  recipientCount: number
): Promise<EmployeeCommPlanLimits> {
  const limits = await getEmployeeCommLimits(businessId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const sentThisMonth = await prisma.employeeBroadcastRecipient.count({
    where: {
      broadcast: { businessId },
      isSent: true,
      sentAt: { gte: monthStart },
    },
  });

  if (sentThisMonth + recipientCount > limits.maxMessagesPerMonth) {
    throw new ValidationError(
      `Plan limit reached: ${limits.maxMessagesPerMonth} employee messages per month`
    );
  }
  return limits;
}
