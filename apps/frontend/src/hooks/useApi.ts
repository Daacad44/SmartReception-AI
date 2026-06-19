import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { useAuthReady } from '@/hooks/useAuthReady';
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
} from '@/lib/entities';
import type {
  DashboardStats,
  RevenueOverview,
  ConversationTrend,
  TopService,
  TeamPerformance,
} from '@/lib/types';

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

function mapMessageStatus(status: string): Message['status'] {
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
    NO_SHOW: 'cancelled',
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

export function useDashboardStats() {
  const authReady = useAuthReady();
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get('/analytics/dashboard');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useRevenueData() {
  const authReady = useAuthReady();
  return useQuery<RevenueOverview[]>({
    queryKey: ['dashboard', 'revenue'],
    queryFn: async () => {
      const response = await api.get('/analytics/revenue');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useCustomerGrowth() {
  const authReady = useAuthReady();
  return useQuery<CustomerGrowthPoint[]>({
    queryKey: ['dashboard', 'customer-growth'],
    queryFn: async () => {
      const response = await api.get('/analytics/customer-growth');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useConversationTrends() {
  const authReady = useAuthReady();
  return useQuery<ConversationTrend[]>({
    queryKey: ['dashboard', 'conversation-trends'],
    queryFn: async () => {
      const response = await api.get('/analytics/trends');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useTopServices() {
  const authReady = useAuthReady();
  return useQuery<TopService[]>({
    queryKey: ['dashboard', 'top-services'],
    queryFn: async () => {
      const response = await api.get('/analytics/top-services');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useTeamPerformance() {
  const authReady = useAuthReady();
  return useQuery<TeamPerformance[]>({
    queryKey: ['dashboard', 'team-performance'],
    queryFn: async () => {
      const response = await api.get('/analytics/team-performance');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useConversations(params?: { status?: string; search?: string }) {
  const authReady = useAuthReady();
  return useQuery<Conversation[]>({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const response = await api.get('/conversations', { params: { limit: 100, ...params } });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformConversation);
    },
    enabled: authReady,
  });
}

export function useMessages(conversationId: string | null) {
  const authReady = useAuthReady();
  return useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const response = await api.get(`/conversations/${conversationId}`);
      const data = extractData<{ messages?: unknown[] } & Record<string, unknown>>(response);
      const messages = data.messages ?? [];
      return (messages as unknown[]).map((m) => transformMessage(m, conversationId!));
    },
    enabled: authReady && !!conversationId,
  });
}

export function useCustomers(search?: string) {
  const authReady = useAuthReady();
  return useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => {
      const response = await api.get('/customers', { params: { search, limit: 100 } });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformCustomer);
    },
    enabled: authReady,
  });
}

export function useAppointments() {
  const authReady = useAuthReady();
  return useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: async () => {
      const response = await api.get('/appointments', { params: { limit: 100 } });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformAppointment);
    },
    enabled: authReady,
  });
}

export function useKnowledgeBases() {
  const authReady = useAuthReady();
  return useQuery<KnowledgeBase[]>({
    queryKey: ['knowledge', 'bases'],
    queryFn: async () => {
      const response = await api.get('/knowledge/bases');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformKnowledgeBase);
    },
    enabled: authReady,
  });
}

const PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'indexing', 'pending']);

export function useKnowledgeDocs(knowledgeBaseId?: string) {
  const authReady = useAuthReady();
  return useQuery<KnowledgeDocument[]>({
    queryKey: ['knowledge', 'documents', knowledgeBaseId],
    queryFn: async () => {
      if (knowledgeBaseId) {
        const response = await api.get(`/knowledge/bases/${knowledgeBaseId}`);
        const data = extractData<{ documents?: unknown[] }>(response);
        return (data.documents ?? []).map(transformKnowledgeDocument);
      }

      const basesResponse = await api.get('/knowledge/bases');
      const bases = extractData(basesResponse) as unknown[];
      if (!bases.length) return [];

      const baseId = (bases[0] as { id: string }).id;
      const response = await api.get(`/knowledge/bases/${baseId}`);
      const data = extractData<{ documents?: unknown[] }>(response);
      return (data.documents ?? []).map(transformKnowledgeDocument);
    },
    enabled: authReady,
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
  const authReady = useAuthReady();
  return useQuery<Faq[]>({
    queryKey: ['knowledge', 'faqs', knowledgeBaseId],
    queryFn: async () => {
      const response = await api.get('/knowledge/faqs', {
        params: knowledgeBaseId ? { knowledgeBaseId } : undefined,
      });
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformFaq);
    },
    enabled: authReady,
  });
}

export function useTeamMembers() {
  const authReady = useAuthReady();
  return useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await api.get('/team');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformTeamMember);
    },
    enabled: authReady,
  });
}

export function useNotifications() {
  const authReady = useAuthReady();
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications');
      const data = extractData(response);
      const items = Array.isArray(data) ? data : [];
      return items.map(transformNotification);
    },
    enabled: authReady,
  });
}

export function useAnalytics() {
  const authReady = useAuthReady();
  return useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useBilling() {
  const authReady = useAuthReady();
  return useQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: async () => {
      const response = await api.get('/billing');
      return extractData(response);
    },
    enabled: authReady,
  });
}

export function useBusinessSettings() {
  const authReady = useAuthReady();
  return useQuery({
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
    enabled: authReady,
  });
}

export function useAiConfig() {
  const authReady = useAuthReady();
  return useQuery({
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
    enabled: authReady,
  });
}
