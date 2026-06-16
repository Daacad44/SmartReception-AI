import { prisma } from '../../infrastructure/database/prisma';

function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export class AnalyticsRepository {
  async getDashboardStats(businessId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalConversations,
      activeCustomers,
      appointmentsToday,
      aiMessages,
      totalMessages,
      recentConversations,
      recentCustomers,
      recentAppointments,
      recentAiMessages,
      recentTotalMessages,
      prevConversations,
      prevCustomers,
      prevAppointments,
      prevAiMessages,
      prevTotalMessages,
    ] = await Promise.all([
      prisma.conversation.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.appointment.count({
        where: {
          businessId,
          startTime: { gte: todayStart },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.message.count({
        where: { isAiGenerated: true, conversation: { businessId } },
      }),
      prisma.message.count({
        where: { conversation: { businessId } },
      }),
      prisma.conversation.count({
        where: { businessId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.customer.count({
        where: { businessId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          createdAt: { gte: thirtyDaysAgo },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.message.count({
        where: {
          isAiGenerated: true,
          conversation: { businessId },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { businessId },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.conversation.count({
        where: { businessId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.customer.count({
        where: { businessId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.message.count({
        where: {
          isAiGenerated: true,
          conversation: { businessId },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { businessId },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
    ]);

    const aiResolutionRate = totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;
    const recentAiRate = recentTotalMessages > 0 ? (recentAiMessages / recentTotalMessages) * 100 : 0;
    const prevAiRate = prevTotalMessages > 0 ? (prevAiMessages / prevTotalMessages) * 100 : 0;

    return {
      totalConversations,
      activeCustomers,
      appointmentsToday,
      aiResolutionRate: Math.round(aiResolutionRate * 10) / 10,
      conversationGrowth: Math.round(calcGrowth(recentConversations, prevConversations) * 10) / 10,
      customerGrowth: Math.round(calcGrowth(recentCustomers, prevCustomers) * 10) / 10,
      appointmentGrowth: Math.round(calcGrowth(recentAppointments, prevAppointments) * 10) / 10,
      aiGrowth: Math.round(calcGrowth(recentAiRate, prevAiRate) * 10) / 10,
    };
  }

  async getConversationTrends(businessId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const trendMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      trendMap.set(date.toISOString().split('T')[0], 0);
    }

    for (const conv of conversations) {
      const dateKey = conv.createdAt.toISOString().split('T')[0];
      if (trendMap.has(dateKey)) {
        trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
      }
    }

    return Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));
  }

  async getTeamPerformance(businessId: string) {
    const members = await prisma.businessMember.findMany({
      where: { businessId, isActive: true },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const performance = await Promise.all(
      members.map(async (member) => {
        const [conversationCount, resolvedCount] = await Promise.all([
          prisma.conversation.count({
            where: { businessId, assignedToId: member.userId },
          }),
          prisma.conversation.count({
            where: {
              businessId,
              assignedToId: member.userId,
              status: { in: ['RESOLVED', 'CLOSED'] },
            },
          }),
        ]);

        return {
          userId: member.userId,
          name: `${member.user.firstName} ${member.user.lastName}`,
          avatar: member.user.avatarUrl || undefined,
          role: member.role,
          conversationCount,
          resolutionRate:
            conversationCount > 0
              ? Math.round((resolvedCount / conversationCount) * 1000) / 10
              : 0,
        };
      })
    );

    return performance.sort((a, b) => b.conversationCount - a.conversationCount);
  }
}

export const analyticsRepository = new AnalyticsRepository();
