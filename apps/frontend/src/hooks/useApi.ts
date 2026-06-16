import { useQuery } from '@tanstack/react-query';
import api, { apiCall } from '@/lib/api';
import {
  mockDashboardStats,
  mockRevenueData,
  mockCustomerGrowth,
  mockConversationTrends,
  mockTopServices,
  mockTeamPerformance,
  mockConversations,
  mockMessages,
  mockCustomers,
  mockAppointments,
  mockKnowledgeDocs,
  mockTeamMembers,
  mockNotifications,
  mockAnalyticsData,
  mockBillingData,
} from '@/lib/mock-data';
import type { DashboardStats } from '@/lib/types';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/stats');
        return (data.data ?? data) as DashboardStats;
      }, mockDashboardStats),
  });
}

export function useRevenueData() {
  return useQuery({
    queryKey: ['dashboard', 'revenue'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/revenue');
        return data.data ?? data;
      }, mockRevenueData),
  });
}

export function useCustomerGrowth() {
  return useQuery({
    queryKey: ['dashboard', 'customer-growth'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/customer-growth');
        return data.data ?? data;
      }, mockCustomerGrowth),
  });
}

export function useConversationTrends() {
  return useQuery({
    queryKey: ['dashboard', 'conversation-trends'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/conversation-trends');
        return data.data ?? data;
      }, mockConversationTrends),
  });
}

export function useTopServices() {
  return useQuery({
    queryKey: ['dashboard', 'top-services'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/top-services');
        return data.data ?? data;
      }, mockTopServices),
  });
}

export function useTeamPerformance() {
  return useQuery({
    queryKey: ['dashboard', 'team-performance'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/team-performance');
        return data.data ?? data;
      }, mockTeamPerformance),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/conversations');
        return data.data ?? data;
      }, mockConversations),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get(`/conversations/${conversationId}/messages`);
        return data.data ?? data;
      }, mockMessages[conversationId!] ?? []),
    enabled: !!conversationId,
  });
}

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/customers', { params: { search } });
        return data.data ?? data;
      }, mockCustomers.filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search) ||
          c.email?.toLowerCase().includes(search.toLowerCase())
      )),
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/appointments');
        return data.data ?? data;
      }, mockAppointments),
  });
}

export function useKnowledgeDocs() {
  return useQuery({
    queryKey: ['knowledge'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/knowledge');
        return data.data ?? data;
      }, mockKnowledgeDocs),
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/team');
        return data.data ?? data;
      }, mockTeamMembers),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/notifications');
        return data.data ?? data;
      }, mockNotifications),
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/analytics');
        return data.data ?? data;
      }, mockAnalyticsData),
  });
}

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/billing');
        return data.data ?? data;
      }, mockBillingData),
  });
}
