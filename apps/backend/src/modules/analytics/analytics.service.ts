import { analyticsRepository } from './analytics.repository';

export class AnalyticsService {
  async getDashboardStats(businessId: string) {
    return analyticsRepository.getDashboardStats(businessId);
  }

  async getTrends(businessId: string, days?: number) {
    return analyticsRepository.getConversationTrends(businessId, days || 30);
  }

  async getTeamPerformance(businessId: string) {
    return analyticsRepository.getTeamPerformance(businessId);
  }
}

export const analyticsService = new AnalyticsService();
