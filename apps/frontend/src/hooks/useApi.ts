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
  type Conversation,
  type Message,
  type Customer,
  type Appointment,
  type KnowledgeDocument,
  type TeamMember,
  type Notification,
} from '@/lib/mock-data';
import type {
  DashboardStats,
  RevenueOverview,
  ConversationTrend,
  TopService,
  TeamPerformance,
} from '@/lib/types';

interface CustomerGrowthPoint {
  month: string;
  customers: number;
}

interface AnalyticsData {
  totalMessages: number;
  avgResponseTime: string;
  satisfactionScore: number;
  aiHandledPercent: number;
  channelBreakdown: Array<{ channel: string; count: number; percent: number }>;
  hourlyActivity: Array<{ hour: string; messages: number }>;
  topTopics: Array<{ topic: string; count: number }>;
}

interface BillingData {
  plan: string;
  status: string;
  price: number;
  billingCycle: string;
  nextBillingDate: string;
  usage: Record<string, { used: number; limit: number }>;
  invoices: Array<{ id: string; date: string; amount: number; status: string }>;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/stats');
        return (data.data ?? data) as DashboardStats;
      }, mockDashboardStats),
  });
}

export function useRevenueData() {
  return useQuery<RevenueOverview[]>({
    queryKey: ['dashboard', 'revenue'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/revenue');
        return data.data ?? data;
      }, mockRevenueData),
  });
}

export function useCustomerGrowth() {
  return useQuery<CustomerGrowthPoint[]>({
    queryKey: ['dashboard', 'customer-growth'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/customer-growth');
        return data.data ?? data;
      }, mockCustomerGrowth),
  });
}

export function useConversationTrends() {
  return useQuery<ConversationTrend[]>({
    queryKey: ['dashboard', 'conversation-trends'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/conversation-trends');
        return data.data ?? data;
      }, mockConversationTrends),
  });
}

export function useTopServices() {
  return useQuery<TopService[]>({
    queryKey: ['dashboard', 'top-services'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/top-services');
        return data.data ?? data;
      }, mockTopServices),
  });
}

export function useTeamPerformance() {
  return useQuery<TeamPerformance[]>({
    queryKey: ['dashboard', 'team-performance'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/dashboard/team-performance');
        return data.data ?? data;
      }, mockTeamPerformance),
  });
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/conversations');
        return data.data ?? data;
      }, mockConversations),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery<Message[]>({
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
  return useQuery<Customer[]>({
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
  return useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/appointments');
        return data.data ?? data;
      }, mockAppointments),
  });
}

export function useKnowledgeDocs() {
  return useQuery<KnowledgeDocument[]>({
    queryKey: ['knowledge'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/knowledge');
        return data.data ?? data;
      }, mockKnowledgeDocs),
  });
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/team');
        return data.data ?? data;
      }, mockTeamMembers),
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/notifications');
        return data.data ?? data;
      }, mockNotifications),
  });
}

export function useAnalytics() {
  return useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/analytics');
        return data.data ?? data;
      }, mockAnalyticsData),
  });
}

export function useBilling() {
  return useQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/billing');
        return data.data ?? data;
      }, mockBillingData),
  });
}
