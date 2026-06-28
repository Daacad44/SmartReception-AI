export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DashboardStats {
  totalConversations: number;
  activeCustomers: number;
  appointmentsToday: number;
  aiResolutionRate: number;
  conversationGrowth: number;
  customerGrowth: number;
  appointmentGrowth: number;
  aiGrowth: number;
}

export interface DashboardBundle {
  stats: DashboardStats;
  revenue: RevenueOverview[];
  customerGrowth: Array<{ month: string; customers: number }>;
  trends: ConversationTrend[];
  topServices: TopService[];
  teamPerformance: TeamPerformance[];
  conversationSummary?: {
    unreadTotal: number;
    aiHandlingCount: number;
    humanNeededCount?: number;
  };
  handoffMetrics?: {
    aiResolved: number;
    humanResolved: number;
    transferred: number;
    pendingHumanRequests: number;
    customerSatisfaction: number;
    aiSatisfaction: number;
    topEmployees: Array<{ userId: string | null; name: string; handledCount: number }>;
  };
}

export interface ConversationTrend {
  date: string;
  count: number;
}

export interface RevenueOverview {
  month: string;
  revenue: number;
}

export interface TeamPerformance {
  userId: string;
  name: string;
  avatar?: string;
  conversationCount: number;
  resolutionRate: number;
}

export interface TopService {
  serviceId: string;
  name: string;
  bookingCount: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  businesses: Array<{
    id: string;
    name: string;
    industry: string;
    plan: string;
    role?: string;
  }>;
}
