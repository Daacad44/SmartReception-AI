import { analyticsRepository } from './analytics.repository';
import { conversationsRepository } from '../conversations/conversations.repository';
import { logger } from '../../core/logger';

const EMPTY_HANDOFF = {
  aiResolved: 0,
  humanResolved: 0,
  transferred: 0,
  pendingHumanRequests: 0,
  customerSatisfaction: 0,
  aiSatisfaction: 0,
  totalFeedback: 0,
  avgAiMessages: 0,
  avgHumanMessages: 0,
  topEmployees: [] as Array<{ userId: string | null; name: string; handledCount: number }>,
};

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === 'fulfilled') return result.value;
  logger.warn(`dashboard-bundle: ${label} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  return fallback;
}

export class AnalyticsService {
  async getDashboardStats(businessId: string) {
    return analyticsRepository.getDashboardStats(businessId);
  }

  async getRevenueOverview(businessId: string) {
    return analyticsRepository.getRevenueOverview(businessId);
  }

  async getCustomerGrowth(businessId: string) {
    return analyticsRepository.getCustomerGrowth(businessId);
  }

  async getTopServices(businessId: string) {
    return analyticsRepository.getTopServices(businessId);
  }

  async getFullAnalytics(businessId: string) {
    return analyticsRepository.getFullAnalytics(businessId);
  }

  async getWhatsAppAnalytics(businessId: string) {
    return analyticsRepository.getWhatsAppAnalytics(businessId);
  }

  async getTrends(businessId: string, days?: number) {
    return analyticsRepository.getConversationTrends(businessId, days || 30);
  }

  async getTeamPerformance(businessId: string) {
    return analyticsRepository.getTeamPerformance(businessId);
  }

  async getHandoffMetrics(businessId: string) {
    return analyticsRepository.getHandoffMetrics(businessId);
  }

  async getDashboardBundle(businessId: string) {
    const [
      statsResult,
      revenueResult,
      customerGrowthResult,
      trendsResult,
      topServicesResult,
      teamPerformanceResult,
      conversationSummaryResult,
      handoffMetricsResult,
    ] = await Promise.allSettled([
      analyticsRepository.getDashboardStats(businessId),
      analyticsRepository.getRevenueOverview(businessId),
      analyticsRepository.getCustomerGrowth(businessId),
      analyticsRepository.getConversationTrends(businessId, 30),
      analyticsRepository.getTopServices(businessId),
      analyticsRepository.getTeamPerformance(businessId),
      conversationsRepository.getSummary(businessId),
      analyticsRepository.getHandoffMetrics(businessId),
    ]);

    if (statsResult.status === 'rejected') {
      throw statsResult.reason;
    }

    return {
      stats: statsResult.value,
      revenue: settledValue(revenueResult, [] as Awaited<ReturnType<typeof analyticsRepository.getRevenueOverview>>, 'revenue'),
      customerGrowth: settledValue(
        customerGrowthResult,
        [] as Awaited<ReturnType<typeof analyticsRepository.getCustomerGrowth>>,
        'customerGrowth'
      ),
      trends: settledValue(trendsResult, [] as Awaited<ReturnType<typeof analyticsRepository.getConversationTrends>>, 'trends'),
      topServices: settledValue(
        topServicesResult,
        [] as Awaited<ReturnType<typeof analyticsRepository.getTopServices>>,
        'topServices'
      ),
      teamPerformance: settledValue(
        teamPerformanceResult,
        [] as Awaited<ReturnType<typeof analyticsRepository.getTeamPerformance>>,
        'teamPerformance'
      ),
      conversationSummary: settledValue(
        conversationSummaryResult,
        { unreadTotal: 0, aiHandlingCount: 0, humanNeededCount: 0 },
        'conversationSummary'
      ),
      handoffMetrics: settledValue(handoffMetricsResult, EMPTY_HANDOFF, 'handoffMetrics'),
    };
  }
}

export const analyticsService = new AnalyticsService();
