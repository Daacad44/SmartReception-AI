import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthQuery, isInitialLoading } from '@/hooks/useAuthQuery';
import api, { extractData } from '@/lib/api';
import type {
  Conversation,
  Message,
  Customer,
  Appointment,
  KnowledgeDocument,
  KnowledgeBase,
  Faq,
  TeamMember,
  Notification,
  AnalyticsData,
  BillingData,
  CustomerGrowthPoint,
  CustomerNote,
  CustomerTag,
  TimelineEvent,
  CustomerInsights,
  Service,
  AuditLogEntry,
} from '@/lib/entities';
import type {
  DashboardStats,
  DashboardBundle,
  RevenueOverview,
  ConversationTrend,
  TopService,
  TeamPerformance,
} from '@/lib/types';

export { isInitialLoading };

// ─── Transformers ────────────────────────────────────────────────────────────

function mapConversationStatus(
  status: string,
  isAiEnabled?: boolean,
  assignedToId?: string | null
): Conversation['status'] {
  if (status === 'PENDING') return 'pending';
  if (status === 'RESOLVED' || status === 'CLOSED') return 'resolved';
  if (status === 'OPEN' && isAiEnabled && !assignedToId) return 'ai_handling';
  return 'open';
}

function mapMessageStatus(status: string | null | undefined): Message['status'] {
  if (!status) return 'sent';
  const normalized = status.toLowerCase();
  if (normalized === 'delivered' || normalized === 'read' || normalized === 'sent') {
    return normalized as Message['status'];
  }
  return 'sent';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformConversation(raw: any): Conversation {
  const customer = raw.customer ?? {};
  const lastMsg = raw.messages?.[0] ?? raw.lastMessage;
  const assignedTo = raw.assignedTo;

  return {
    id: raw.id,
    customerId: raw.customerId ?? customer.id,
    customerName: customer.name ?? '',
    customerPhone: customer.phone ?? '',
    customerAvatar: customer.avatarUrl ?? undefined,
    lastMessage: typeof lastMsg === 'string' ? lastMsg : (lastMsg?.content ?? ''),
    lastMessageAt: raw.lastMessageAt ?? raw.updatedAt ?? raw.createdAt,
    unreadCount: raw.unreadCount ?? 0,
    status: mapConversationStatus(raw.status, raw.isAiEnabled, raw.assignedToId),
    assignedTo: assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : undefined,
    tags: raw.tags?.map((t: { name: string } | string) => (typeof t === 'string' ? t : t.name)) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformMessage(raw: any, conversationId: string): Message {
  const isAi = raw.isAiGenerated;
  const isInbound = raw.direction === 'INBOUND';
  const sentBy = raw.sentByUser;

  let sender: Message['sender'];
  let senderName: string;

  if (isInbound) {
    sender = 'customer';
    senderName = raw.senderName ?? 'Customer';
  } else if (isAi) {
    sender = 'ai';
    senderName = 'AI Assistant';
  } else {
    sender = 'agent';
    senderName = sentBy ? `${sentBy.firstName} ${sentBy.lastName}` : 'Agent';
  }

  return {
    id: raw.id,
    conversationId,
    content: raw.content,
    type: raw.type,
    mediaUrl: raw.mediaUrl ?? undefined,
    sender,
    senderName,
    timestamp: raw.createdAt,
    status: mapMessageStatus(raw.status),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformCustomer(raw: any): Customer {
  const tags = raw.tags?.map((t: { tag: { name: string } } | { name: string }) =>
    'tag' in t ? t.tag.name : t.name
  ) ?? [];

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? undefined,
    phone: raw.phone,
    tags,
    totalConversations: raw._count?.conversations ?? 0,
    lastContact: raw.lastContactAt ?? raw.updatedAt ?? raw.createdAt,
    status: raw.leadScore >= 80 ? 'vip' : raw.isActive ? 'active' : 'inactive',
    createdAt: raw.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformAppointment(raw: any): Appointment {
  const start = new Date(raw.startTime);
  const statusMap: Record<string, Appointment['status']> = {
    CONFIRMED: 'confirmed',
    SCHEDULED: 'pending',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    NO_SHOW: 'no_show',
  };

  return {
    id: raw.id,
    customerId: raw.customerId,
    customerName: raw.customer?.name ?? '',
    service: raw.service?.name ?? raw.title,
    date: start.toISOString().split('T')[0],
    time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    duration: raw.service?.duration ?? Math.round((new Date(raw.endTime).getTime() - start.getTime()) / 60000),
    status: statusMap[raw.status] ?? 'pending',
    notes: raw.notes ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformKnowledgeDocument(raw: any): KnowledgeDocument {
  const typeMap: Record<string, KnowledgeDocument['type']> = {
    PDF: 'pdf',
    DOCX: 'doc',
    TXT: 'txt',
    FAQ: 'txt',
  };
  const statusMap: Record<string, KnowledgeDocument['status']> = {
    UPLOADED: 'uploaded',
    INDEXED: 'indexed',
    PROCESSING: 'processing',
    INDEXING: 'indexing',
    PENDING: 'pending',
    FAILED: 'failed',
  };

  const sizeBytes = raw.fileSize ?? 0;
  const size =
    sizeBytes > 0
      ? sizeBytes > 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(sizeBytes / 1024)} KB`
      : '-';

  return {
    id: raw.id,
    title: raw.title,
    type: typeMap[raw.type] ?? 'txt',
    size,
    status: statusMap[raw.status] ?? 'processing',
    processingError: raw.processingError ?? undefined,
    uploadedAt: raw.createdAt,
    uploadedBy: raw.uploadedBy ?? '—',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformTeamMember(raw: any): TeamMember {
  const user = raw.user ?? raw;
  return {
    id: raw.id ?? raw.userId,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email ?? '',
    role: raw.role,
    avatar: user.avatarUrl ?? undefined,
    status: 'offline',
    conversationsHandled: raw.conversationCount ?? 0,
    avgResponseTime: raw.avgResponseTime ?? '—',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformNotification(raw: any): Notification {
  const typeMap: Record<string, Notification['type']> = {
    MESSAGE: 'info',
    APPOINTMENT: 'success',
    TEAM: 'warning',
    SYSTEM: 'error',
  };

  return {
    id: raw.id,
    title: raw.title,
    message: raw.message,
    type: typeMap[raw.type] ?? 'info',
    read: raw.isRead ?? raw.read ?? false,
    createdAt: raw.createdAt,
    data: raw.data ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformKnowledgeBase(raw: any): KnowledgeBase {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    documentCount: raw._count?.documents ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformFaq(raw: any): Faq {
  return {
    id: raw.id,
    question: raw.question ?? raw.title,
    answer: raw.answer ?? raw.content ?? '',
    category: raw.category ?? undefined,
    knowledgeBaseId: raw.knowledgeBaseId,
  };
}

// ─── Query hooks ─────────────────────────────────────────────────────────────

const ANALYTICS_TIMEOUT = 30_000;

export function useDashboardBundle() {
  return useAuthQuery<DashboardBundle>({
    queryKey: ['dashboard', 'bundle'],
    queryFn: async () => {
      const response = await api.get('/analytics/dashboard-bundle', {
        timeout: ANALYTICS_TIMEOUT,
      });
      return extractData(response);
    },
  });
}

export function useDashboardStats() {
  return useAuthQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get('/analytics/dashboard', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useRevenueData() {
  return useAuthQuery<RevenueOverview[]>({
    queryKey: ['dashboard', 'revenue'],
    queryFn: async () => {
      const response = await api.get('/analytics/revenue', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useCustomerGrowth() {
  return useAuthQuery<CustomerGrowthPoint[]>({
    queryKey: ['dashboard', 'customer-growth'],
    queryFn: async () => {
      const response = await api.get('/analytics/customer-growth', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useConversationTrends() {
  return useAuthQuery<ConversationTrend[]>({
    queryKey: ['dashboard', 'conversation-trends'],
    queryFn: async () => {
      const response = await api.get('/analytics/trends', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useTopServices() {
  return useAuthQuery<TopService[]>({
    queryKey: ['dashboard', 'top-services'],
    queryFn: async () => {
      const response = await api.get('/analytics/top-services', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useTeamPerformance() {
  return useAuthQuery<TeamPerformance[]>({
    queryKey: ['dashboard', 'team-performance'],
    queryFn: async () => {
      const response = await api.get('/analytics/team-performance', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useConversations(params?: { status?: string; search?: string }) {
  const apiStatus =
    params?.status && params.status !== 'all' && params.status !== 'ai_handling'
      ? params.status.toUpperCase()
      : undefined;

  return useAuthQuery<Conversation[]>({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const response = await api.get('/conversations', {
        params: {
          limit: 100,
          search: params?.search || undefined,
          status: apiStatus,
        },
      });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      let conversations = items.map(transformConversation);
      if (params?.status === 'ai_handling') {
        conversations = conversations.filter((c) => c.status === 'ai_handling');
      }
      return conversations;
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useAuthQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const response = await api.get(`/conversations/${conversationId}`);
      const data = extractData<{ messages?: unknown[] } & Record<string, unknown>>(response);
      const messages = data.messages ?? [];
      return (messages as unknown[]).map((m) => transformMessage(m, conversationId!));
    },
    enabled: !!conversationId,
  });
}

export function useCustomers(search?: string) {
  return useAuthQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => {
      const response = await api.get('/customers', { params: { search, limit: 100 } });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformCustomer);
    },
  });
}

export function useAppointments(params?: { status?: string; customerId?: string }) {
  return useAuthQuery<Appointment[]>({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const response = await api.get('/appointments', {
        params: { limit: 100, ...params },
      });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformAppointment);
    },
  });
}

export function useAppointmentCalendar(startDate: string, endDate: string) {
  return useAuthQuery<Appointment[]>({
    queryKey: ['appointments', 'calendar', startDate, endDate],
    queryFn: async () => {
      const response = await api.get('/appointments/calendar', {
        params: { startDate, endDate },
      });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformAppointment);
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useServices() {
  return useAuthQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await api.get('/services', { params: { limit: 100 } });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map((raw: { id: string; name: string; duration: number; price?: number }) => ({
        id: raw.id,
        name: raw.name,
        duration: raw.duration,
        price: raw.price,
      }));
    },
  });
}

export function useCustomer(customerId: string | null) {
  return useAuthQuery<Customer & { notes?: string }>({
    queryKey: ['customers', customerId],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}`);
      const raw = extractData(response);
      return transformCustomer(raw);
    },
    enabled: !!customerId,
  });
}

export function useCustomerNotes(customerId: string | null) {
  return useAuthQuery<CustomerNote[]>({
    queryKey: ['customers', customerId, 'notes'],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}/notes`);
      const data = extractData(response);
      return (Array.isArray(data) ? data : []).map(
        (n: { id: string; content: string; createdAt: string; createdBy?: string }) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt,
          createdBy: n.createdBy,
        })
      );
    },
    enabled: !!customerId,
  });
}

export function useCustomerTimeline(customerId: string | null) {
  return useAuthQuery<TimelineEvent[]>({
    queryKey: ['customers', customerId, 'timeline'],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}/timeline`);
      return extractData(response);
    },
    enabled: !!customerId,
  });
}

export function useCustomerInsights(customerId: string | null) {
  return useAuthQuery<CustomerInsights>({
    queryKey: ['customers', customerId, 'insights'],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}/insights`);
      return extractData(response);
    },
    enabled: !!customerId,
  });
}

export function useCustomerTags() {
  return useAuthQuery<CustomerTag[]>({
    queryKey: ['customers', 'tags'],
    queryFn: async () => {
      const response = await api.get('/customers/tags');
      const data = extractData(response);
      return (Array.isArray(data) ? data : []).map(
        (t: { id: string; name: string; color?: string; _count?: { customers: number } }) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          customerCount: t._count?.customers,
        })
      );
    },
  });
}

export function useAuditLogs() {
  return useAuthQuery<AuditLogEntry[]>({
    queryKey: ['audit', 'logs'],
    queryFn: async () => {
      const response = await api.get('/audit/logs', { params: { limit: 50 } });
      const data = extractData(response);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useKnowledgeBases() {
  return useAuthQuery<KnowledgeBase[]>({
    queryKey: ['knowledge', 'bases'],
    queryFn: async () => {
      const response = await api.get('/knowledge/bases');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformKnowledgeBase);
    },
  });
}

const PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'indexing', 'pending']);

export function useKnowledgeDocs(knowledgeBaseId?: string) {
  return useAuthQuery<KnowledgeDocument[]>({
    queryKey: ['knowledge', 'documents', knowledgeBaseId ?? 'default'],
    queryFn: async () => {
      let baseId = knowledgeBaseId;

      if (!baseId) {
        const basesResponse = await api.get('/knowledge/bases');
        const bases = extractData(basesResponse) as unknown[];
        if (!bases.length) return [];
        baseId = (bases[0] as { id: string }).id;
      }

      const response = await api.get(`/knowledge/bases/${baseId}`);
      const data = extractData<{ documents?: unknown[] }>(response);
      return (data.documents ?? []).map(transformKnowledgeDocument);
    },
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs?.some((d) => PROCESSING_STATUSES.has(d.status))) {
        return false;
      }
      return 2000;
    },
  });
}

export function useFaqs(knowledgeBaseId?: string) {
  return useAuthQuery<Faq[]>({
    queryKey: ['knowledge', 'faqs', knowledgeBaseId],
    queryFn: async () => {
      const response = await api.get('/knowledge/faqs', {
        params: knowledgeBaseId ? { knowledgeBaseId } : undefined,
      });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformFaq);
    },
  });
}

export function useTeamMembers() {
  return useAuthQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformTeamMember);
    },
  });
}

export function useNotifications() {
  return useAuthQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformNotification);
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useAnalytics() {
  return useAuthQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics', { timeout: ANALYTICS_TIMEOUT });
      return extractData(response);
    },
  });
}

export function useBilling() {
  return useAuthQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: async () => {
      const response = await api.get('/billing');
      return extractData(response);
    },
  });
}

export function useBusinessSettings() {
  return useAuthQuery({
    queryKey: ['business', 'settings'],
    queryFn: async () => {
      const response = await api.get('/business/settings');
      return extractData<{
        name: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        timezone: string;
        website?: string | null;
      }>(response);
    },
  });
}

export function useAiConfig() {
  return useAuthQuery({
    queryKey: ['ai', 'config'],
    queryFn: async () => {
      const response = await api.get('/ai/config');
      return extractData<{
        greetingMessage?: string | null;
        fallbackMessage?: string | null;
        enableAutoReply: boolean;
        enableBooking: boolean;
        enableLeadQualification: boolean;
        languages: string[];
      }>(response);
    },
  });
}

export function useWhatsAppAccounts() {
  return useAuthQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const response = await api.get('/whatsapp/accounts');
      return extractData<
        Array<{
          id: string;
          phoneNumberId: string;
          phoneNumber: string;
          displayName?: string | null;
          wabaId?: string | null;
          webhookVerified: boolean;
          phoneNumberStatus?: string | null;
          webhookStatus?: string | null;
          lastSyncAt?: string | null;
          isActive: boolean;
        }>
      >(response);
    },
  });
}

export function useWhatsAppStatus() {
  return useAuthQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const response = await api.get('/whatsapp/status');
      return extractData<{
        connected: boolean;
        envConfigured: boolean;
        webhookUrl: string;
        verifyTokenConfigured: boolean;
        appSecretConfigured: boolean;
      }>(response);
    },
  });
}

export function useWhatsAppWebhookInfo() {
  return useAuthQuery({
    queryKey: ['whatsapp-webhook-info'],
    queryFn: async () => {
      const response = await api.get('/whatsapp/webhook-info');
      return extractData<{ webhookUrl: string; legacyWebhookUrl?: string; verifyToken: string }>(
        response
      );
    },
  });
}

export function useKnowledgeSearch(query: string) {
  return useAuthQuery({
    queryKey: ['knowledge-search', query],
    queryFn: async () => {
      const response = await api.get('/knowledge/search', { params: { q: query, limit: 10 } });
      return extractData<
        Array<{
          documentId: string;
          title: string;
          type: string;
          snippet: string;
          score: number;
        }>
      >(response);
    },
    enabled: query.trim().length >= 2,
  });
}
