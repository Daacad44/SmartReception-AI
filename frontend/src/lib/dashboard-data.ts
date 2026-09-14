import type {
  DashboardBundle,
  DashboardStats,
  HandoffMetrics,
  RevenueOverview,
  TeamPerformance,
  TopService,
} from '@/lib/types';
import type { BillingData } from '@/lib/entities';

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalConversations: 0,
  activeCustomers: 0,
  appointmentsToday: 0,
  aiResolutionRate: 0,
  conversationGrowth: 0,
  customerGrowth: 0,
  appointmentGrowth: 0,
  aiGrowth: 0,
};

export function isFiniteNumber(value: unknown): value is number {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
  return false;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((item) => item != null) as T[]) : [];
}

function normalizeStats(raw: unknown): DashboardStats {
  const stats = raw && typeof raw === 'object' ? (raw as Partial<DashboardStats>) : {};
  return {
    totalConversations: toFiniteNumber(stats.totalConversations),
    activeCustomers: toFiniteNumber(stats.activeCustomers),
    appointmentsToday: toFiniteNumber(stats.appointmentsToday),
    aiResolutionRate: toFiniteNumber(stats.aiResolutionRate),
    conversationGrowth: toFiniteNumber(stats.conversationGrowth),
    customerGrowth: toFiniteNumber(stats.customerGrowth),
    appointmentGrowth: toFiniteNumber(stats.appointmentGrowth),
    aiGrowth: toFiniteNumber(stats.aiGrowth),
  };
}

function normalizeHandoff(raw: unknown): HandoffMetrics | undefined {
  if (!raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0) return undefined;
  const h = raw as Partial<HandoffMetrics> & { topEmployees?: unknown };
  const topEmployees = asArray<HandoffMetrics['topEmployees'][number]>(h.topEmployees).map((employee) => ({
    userId: employee?.userId ?? null,
    name: employee?.name || 'Unknown',
    handledCount: toFiniteNumber(employee?.handledCount),
  }));
  return {
    aiResolved: toFiniteNumber(h.aiResolved),
    humanResolved: toFiniteNumber(h.humanResolved),
    transferred: toFiniteNumber(h.transferred),
    pendingHumanRequests: toFiniteNumber(h.pendingHumanRequests),
    customerSatisfaction: toFiniteNumber(h.customerSatisfaction),
    aiSatisfaction: toFiniteNumber(h.aiSatisfaction),
    topEmployees,
  };
}

export function normalizeDashboardBundle(raw: unknown): DashboardBundle {
  const data = raw && typeof raw === 'object' ? (raw as Partial<DashboardBundle>) : {};
  return {
    stats: normalizeStats(data.stats),
    revenue: asArray<RevenueOverview>(data.revenue),
    customerGrowth: asArray<DashboardBundle['customerGrowth'][number]>(data.customerGrowth),
    trends: asArray<DashboardBundle['trends'][number]>(data.trends),
    topServices: asArray<TopService>(data.topServices),
    teamPerformance: asArray<TeamPerformance>(data.teamPerformance),
    conversationSummary: data.conversationSummary
      ? {
          unreadTotal: toFiniteNumber(data.conversationSummary.unreadTotal),
          aiHandlingCount: toFiniteNumber(data.conversationSummary.aiHandlingCount),
          humanNeededCount: toFiniteNumber(data.conversationSummary.humanNeededCount),
        }
      : undefined,
    handoffMetrics: normalizeHandoff(data.handoffMetrics),
  };
}

export function hasChartData<T>(data: T[] | undefined, key: keyof T): boolean {
  return Boolean(
    data?.some((item) => item != null && Number((item as T)[key]) > 0)
  );
}

export interface UsageMetric {
  used: number;
  limit: number;
}

export function normalizeUsageMetric(value: unknown): UsageMetric | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const metric = value as { used?: unknown; limit?: unknown };
  if (!isFiniteNumber(metric.used) || !isFiniteNumber(metric.limit)) return undefined;
  return { used: Number(metric.used), limit: Number(metric.limit) };
}

export function normalizeBillingData(raw: unknown): BillingData {
  const data = raw && typeof raw === 'object' ? (raw as Partial<BillingData>) : {};
  const usageEntries = data.usage && typeof data.usage === 'object' ? Object.entries(data.usage) : [];
  const usage: BillingData['usage'] = {};
  for (const [key, value] of usageEntries) {
    const metric = normalizeUsageMetric(value);
    if (metric) usage[key] = metric;
  }
  return {
    plan: typeof data.plan === 'string' ? data.plan : 'FREE',
    status: typeof data.status === 'string' ? data.status : 'trialing',
    price: toFiniteNumber(data.price),
    billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : 'monthly',
    nextBillingDate: data.nextBillingDate ?? '',
    hasPaymentMethod: Boolean(data.hasPaymentMethod),
    stripeEnabled: Boolean(data.stripeEnabled),
    usage,
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
  };
}
