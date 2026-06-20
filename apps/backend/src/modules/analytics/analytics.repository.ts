import { prisma } from '../../infrastructure/database/prisma';

function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLast12MonthBuckets() {
  const now = new Date();
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];

  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: MONTH_LABELS[start.getMonth()], start, end });
  }

  return buckets;
}

const TOPIC_KEYWORDS: Array<{ topic: string; keywords: string[] }> = [
  { topic: 'Appointments', keywords: ['appointment', 'book', 'schedule', 'booking', 'reschedule'] },
  { topic: 'Pricing', keywords: ['price', 'cost', 'fee', 'payment', 'insurance', 'charge'] },
  { topic: 'Operating Hours', keywords: ['hours', 'open', 'close', 'when', 'available'] },
  { topic: 'Services', keywords: ['service', 'treatment', 'procedure', 'offer'] },
  { topic: 'Directions', keywords: ['location', 'address', 'direction', 'where', 'parking'] },
];

export class AnalyticsRepository {
  async getDashboardStats(businessId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    type StatsRow = {
      totalConversations: bigint;
      activeCustomers: bigint;
      appointmentsToday: bigint;
      aiMessages: bigint;
      totalMessages: bigint;
      recentConversations: bigint;
      recentCustomers: bigint;
      recentAppointments: bigint;
      recentAiMessages: bigint;
      recentTotalMessages: bigint;
      prevConversations: bigint;
      prevCustomers: bigint;
      prevAppointments: bigint;
      prevAiMessages: bigint;
      prevTotalMessages: bigint;
    };

    const [row] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        (SELECT COUNT(*)::bigint FROM conversations WHERE "businessId" = ${businessId}) AS "totalConversations",
        (SELECT COUNT(*)::bigint FROM customers WHERE "businessId" = ${businessId} AND "isActive" = true) AS "activeCustomers",
        (SELECT COUNT(*)::bigint FROM appointments WHERE "businessId" = ${businessId} AND "startTime" >= ${todayStart} AND status NOT IN ('CANCELLED')) AS "appointmentsToday",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId} AND m."isAiGenerated" = true) AS "aiMessages",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId}) AS "totalMessages",
        (SELECT COUNT(*)::bigint FROM conversations WHERE "businessId" = ${businessId} AND "createdAt" >= ${thirtyDaysAgo}) AS "recentConversations",
        (SELECT COUNT(*)::bigint FROM customers WHERE "businessId" = ${businessId} AND "createdAt" >= ${thirtyDaysAgo}) AS "recentCustomers",
        (SELECT COUNT(*)::bigint FROM appointments WHERE "businessId" = ${businessId} AND "createdAt" >= ${thirtyDaysAgo} AND status NOT IN ('CANCELLED')) AS "recentAppointments",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId} AND m."isAiGenerated" = true AND m."createdAt" >= ${thirtyDaysAgo}) AS "recentAiMessages",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId} AND m."createdAt" >= ${thirtyDaysAgo}) AS "recentTotalMessages",
        (SELECT COUNT(*)::bigint FROM conversations WHERE "businessId" = ${businessId} AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}) AS "prevConversations",
        (SELECT COUNT(*)::bigint FROM customers WHERE "businessId" = ${businessId} AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo}) AS "prevCustomers",
        (SELECT COUNT(*)::bigint FROM appointments WHERE "businessId" = ${businessId} AND "createdAt" >= ${sixtyDaysAgo} AND "createdAt" < ${thirtyDaysAgo} AND status NOT IN ('CANCELLED')) AS "prevAppointments",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId} AND m."isAiGenerated" = true AND m."createdAt" >= ${sixtyDaysAgo} AND m."createdAt" < ${thirtyDaysAgo}) AS "prevAiMessages",
        (SELECT COUNT(*)::bigint FROM messages m JOIN conversations c ON m."conversationId" = c.id WHERE c."businessId" = ${businessId} AND m."createdAt" >= ${sixtyDaysAgo} AND m."createdAt" < ${thirtyDaysAgo}) AS "prevTotalMessages"
    `;

    if (!row) {
      return {
        totalConversations: 0,
        activeCustomers: 0,
        appointmentsToday: 0,
        aiResolutionRate: 0,
        conversationGrowth: 0,
        customerGrowth: 0,
        appointmentGrowth: 0,
        aiGrowth: 0,
      };
    }

    const n = (v: bigint) => Number(v);
    const totalMessages = n(row.totalMessages);
    const aiMessages = n(row.aiMessages);
    const recentTotalMessages = n(row.recentTotalMessages);
    const recentAiMessages = n(row.recentAiMessages);
    const prevTotalMessages = n(row.prevTotalMessages);
    const prevAiMessages = n(row.prevAiMessages);

    const aiResolutionRate = totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;
    const recentAiRate = recentTotalMessages > 0 ? (recentAiMessages / recentTotalMessages) * 100 : 0;
    const prevAiRate = prevTotalMessages > 0 ? (prevAiMessages / prevTotalMessages) * 100 : 0;

    return {
      totalConversations: n(row.totalConversations),
      activeCustomers: n(row.activeCustomers),
      appointmentsToday: n(row.appointmentsToday),
      aiResolutionRate: Math.round(aiResolutionRate * 10) / 10,
      conversationGrowth: Math.round(calcGrowth(n(row.recentConversations), n(row.prevConversations)) * 10) / 10,
      customerGrowth: Math.round(calcGrowth(n(row.recentCustomers), n(row.prevCustomers)) * 10) / 10,
      appointmentGrowth: Math.round(calcGrowth(n(row.recentAppointments), n(row.prevAppointments)) * 10) / 10,
      aiGrowth: Math.round(calcGrowth(recentAiRate, prevAiRate) * 10) / 10,
    };
  }

  async getRevenueOverview(businessId: string) {
    const buckets = getLast12MonthBuckets();
    const startDate = buckets[0].start;

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        startTime: { gte: startDate },
        status: { notIn: ['CANCELLED'] },
        service: { price: { not: null } },
      },
      select: {
        startTime: true,
        service: { select: { price: true } },
      },
    });

    const revenueMap = new Map(buckets.map((b) => [b.key, 0]));

    for (const appt of appointments) {
      const key = `${appt.startTime.getFullYear()}-${String(appt.startTime.getMonth() + 1).padStart(2, '0')}`;
      if (revenueMap.has(key)) {
        revenueMap.set(key, (revenueMap.get(key) || 0) + Number(appt.service?.price ?? 0));
      }
    }

    return buckets.map((b) => ({
      month: b.label,
      revenue: Math.round(revenueMap.get(b.key) || 0),
    }));
  }

  async getCustomerGrowth(businessId: string) {
    const buckets = getLast12MonthBuckets();
    const startDate = buckets[0].start;

    const customers = await prisma.customer.findMany({
      where: { businessId, createdAt: { gte: startDate } },
      select: { createdAt: true },
    });

    const countMap = new Map(buckets.map((b) => [b.key, 0]));

    for (const customer of customers) {
      const key = `${customer.createdAt.getFullYear()}-${String(customer.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (countMap.has(key)) {
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    return buckets.map((b) => ({
      month: b.label,
      customers: countMap.get(b.key) || 0,
    }));
  }

  async getTopServices(businessId: string) {
    const grouped = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: {
        businessId,
        serviceId: { not: null },
        status: { notIn: ['CANCELLED'] },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const serviceIds = grouped
      .map((g) => g.serviceId)
      .filter((id): id is string => id !== null);

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(services.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      serviceId: g.serviceId!,
      name: nameMap.get(g.serviceId!) || 'Unknown Service',
      bookingCount: g._count.id,
    }));
  }

  async getFullAnalytics(businessId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messages = await prisma.message.findMany({
      where: {
        conversation: { businessId },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        direction: true,
        content: true,
        isAiGenerated: true,
        createdAt: true,
        conversation: {
          select: { whatsappAccountId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalMessages = messages.length;
    const aiMessages = messages.filter((m) => m.isAiGenerated).length;
    const aiHandledPercent =
      totalMessages > 0 ? Math.round((aiMessages / totalMessages) * 1000) / 10 : 0;

    const responseTimes: number[] = [];

    const conversationMessages = await prisma.message.findMany({
      where: {
        conversation: { businessId },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        conversationId: true,
        direction: true,
        createdAt: true,
      },
      orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }],
    });

    const byConversation = new Map<string, Array<{ direction: string; createdAt: Date }>>();
    for (const msg of conversationMessages) {
      const list = byConversation.get(msg.conversationId) || [];
      list.push({ direction: msg.direction, createdAt: msg.createdAt });
      byConversation.set(msg.conversationId, list);
    }

    for (const convMsgs of byConversation.values()) {
      for (let i = 0; i < convMsgs.length - 1; i++) {
        if (convMsgs[i].direction === 'INBOUND' && convMsgs[i + 1].direction === 'OUTBOUND') {
          const diffMs = convMsgs[i + 1].createdAt.getTime() - convMsgs[i].createdAt.getTime();
          if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
            responseTimes.push(diffMs);
          }
        }
      }
    }

    const avgMs =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const avgMinutes = Math.round(avgMs / 60000 * 10) / 10;
    const avgResponseTime = avgMinutes >= 1 ? `${avgMinutes} min` : `${Math.round(avgMs / 1000)} sec`;

    const [totalConversations, resolvedConversations] = await Promise.all([
      prisma.conversation.count({ where: { businessId } }),
      prisma.conversation.count({
        where: { businessId, status: { in: ['RESOLVED', 'CLOSED'] } },
      }),
    ]);
    const resolutionRate = totalConversations > 0 ? resolvedConversations / totalConversations : 0;
    const satisfactionScore = Math.round(resolutionRate * 5 * 10) / 10;

    let whatsappCount = 0;
    let otherCount = 0;
    for (const msg of messages) {
      if (msg.conversation.whatsappAccountId) {
        whatsappCount++;
      } else {
        otherCount++;
      }
    }

    const channelBreakdown = [
      { channel: 'WhatsApp', count: whatsappCount, percent: 0 },
      { channel: 'Other', count: otherCount, percent: 0 },
    ].map((ch) => ({
      ...ch,
      percent: totalMessages > 0 ? Math.round((ch.count / totalMessages) * 100) : 0,
    }));

    const hourlyMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(`${String(i).padStart(2, '0')}:00`, 0);
    }
    for (const msg of messages) {
      const hour = `${String(msg.createdAt.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }
    const hourlyActivity = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
      hour,
      messages: count,
    }));

    const topicCounts = new Map<string, number>();
    for (const { topic } of TOPIC_KEYWORDS) {
      topicCounts.set(topic, 0);
    }

    const inboundMessages = messages.filter((m) => m.direction === 'INBOUND');
    for (const msg of inboundMessages) {
      const lower = msg.content.toLowerCase();
      for (const { topic, keywords } of TOPIC_KEYWORDS) {
        if (keywords.some((kw) => lower.includes(kw))) {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }
      }
    }

    const kbCategories = await prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBase: { businessId },
        category: { not: null },
      },
      select: { category: true },
    });
    for (const doc of kbCategories) {
      if (doc.category) {
        topicCounts.set(doc.category, (topicCounts.get(doc.category) || 0) + 1);
      }
    }

    const topTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const messagesPerDay: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      messagesPerDay.push({ date: date.toISOString().split('T')[0], count: 0 });
    }
    const dayMap = new Map(messagesPerDay.map((d) => [d.date, 0]));
    for (const msg of messages) {
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      if (dayMap.has(dateKey)) {
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
      }
    }
    const dailyMessages = messagesPerDay.map((d) => ({
      date: d.date,
      count: dayMap.get(d.date) || 0,
    }));

    return {
      totalMessages,
      messagesPerDay: dailyMessages,
      avgResponseTime,
      satisfactionScore,
      aiHandledPercent,
      channelBreakdown,
      hourlyActivity,
      topTopics,
    };
  }

  async getWhatsAppAnalytics(businessId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const whatsappWhere = {
      conversation: { businessId, whatsappAccountId: { not: null } },
    };

    const [
      messagesReceived,
      messagesSent,
      aiOutbound,
      humanOutbound,
      activeConversations,
      recentCustomers,
      prevCustomers,
      takeoverCount,
      totalWhatsAppConversations,
    ] = await Promise.all([
      prisma.message.count({
        where: { ...whatsappWhere, direction: 'INBOUND', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.count({
        where: { ...whatsappWhere, direction: 'OUTBOUND', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.count({
        where: {
          ...whatsappWhere,
          direction: 'OUTBOUND',
          isAiGenerated: true,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.message.count({
        where: {
          ...whatsappWhere,
          direction: 'OUTBOUND',
          isAiGenerated: false,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.conversation.count({
        where: {
          businessId,
          whatsappAccountId: { not: null },
          status: { in: ['OPEN', 'PENDING'] },
        },
      }),
      prisma.customer.count({
        where: {
          businessId,
          conversations: { some: { whatsappAccountId: { not: null } } },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.customer.count({
        where: {
          businessId,
          conversations: { some: { whatsappAccountId: { not: null } } },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
      prisma.conversation.count({
        where: {
          businessId,
          whatsappAccountId: { not: null },
          isAiEnabled: false,
          assignedToId: { not: null },
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.conversation.count({
        where: { businessId, whatsappAccountId: { not: null } },
      }),
    ]);

    const conversationMessages = await prisma.message.findMany({
      where: {
        conversation: { businessId, whatsappAccountId: { not: null } },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { conversationId: true, direction: true, createdAt: true },
      orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }],
    });

    const responseTimes: number[] = [];
    const byConversation = new Map<string, Array<{ direction: string; createdAt: Date }>>();
    for (const msg of conversationMessages) {
      const list = byConversation.get(msg.conversationId) || [];
      list.push({ direction: msg.direction, createdAt: msg.createdAt });
      byConversation.set(msg.conversationId, list);
    }
    for (const convMsgs of byConversation.values()) {
      for (let i = 0; i < convMsgs.length - 1; i++) {
        if (convMsgs[i].direction === 'INBOUND' && convMsgs[i + 1].direction === 'OUTBOUND') {
          const diffMs = convMsgs[i + 1].createdAt.getTime() - convMsgs[i].createdAt.getTime();
          if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
            responseTimes.push(diffMs);
          }
        }
      }
    }

    const avgMs =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const avgMinutes = Math.round((avgMs / 60000) * 10) / 10;
    const avgResponseTime =
      avgMinutes >= 1 ? `${avgMinutes} min` : `${Math.round(avgMs / 1000)} sec`;

    const outboundTotal = messagesSent || 1;
    const aiResolutionRate = Math.round((aiOutbound / outboundTotal) * 1000) / 10;
    const humanTakeoverRate =
      totalWhatsAppConversations > 0
        ? Math.round((takeoverCount / totalWhatsAppConversations) * 1000) / 10
        : 0;

    return {
      messagesReceived,
      messagesSent,
      avgResponseTime,
      aiResolutionRate,
      humanTakeoverRate,
      activeConversations,
      customerGrowth: Math.round(calcGrowth(recentCustomers, prevCustomers) * 10) / 10,
      humanOutbound,
      aiOutbound,
      periodDays: 30,
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
