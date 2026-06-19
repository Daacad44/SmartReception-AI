import { analyticsRepository } from './analytics.repository';

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

  async getTrends(businessId: string, days?: number) {
    return analyticsRepository.getConversationTrends(businessId, days || 30);
  }

  async getTeamPerformance(businessId: string) {
    return analyticsRepository.getTeamPerformance(businessId);
  }

  async getDashboardBundle(businessId: string) {
    const [stats, revenue, customerGrowth, trends, topServices, teamPerformance] =
      await Promise.all([
        analyticsRepository.getDashboardStats(businessId),
        analyticsRepository.getRevenueOverview(businessId),
        analyticsRepository.getCustomerGrowth(businessId),
        analyticsRepository.getConversationTrends(businessId, 30),
        analyticsRepository.getTopServices(businessId),
        analyticsRepository.getTeamPerformance(businessId),
      ]);

    return { stats, revenue, customerGrowth, trends, topServices, teamPerformance };
  }
}

export const analyticsService = new AnalyticsService();
