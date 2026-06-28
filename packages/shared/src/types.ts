export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
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

export interface JwtPayload {
  userId: string;
  email: string;
  businessId?: string;
  role?: string;
  isSuperAdmin?: boolean;
  impersonating?: boolean;
  purpose?: 'access' | '2fa' | 'ai_trainer';
  trainerId?: string;
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
