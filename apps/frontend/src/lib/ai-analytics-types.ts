export interface AiCustomerAnalytics {
  customerId: string;
  businessId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  conversationCount: number;
  messagesSent: number;
  messagesReceived: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  averageResponseTimeMs: number;
  topQuestions: string[];
  productsDiscussed: string[];
  primaryLanguage?: string | null;
  channel: string;
}

export interface AiConversationAnalytics {
  conversationId: string;
  businessId: string;
  customerId: string;
  customerName: string;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  promptSize: number;
  responseSize: number;
  retrievedKnowledge: number;
  retrievedCategories: string[];
  summaryGenerated: boolean;
  compressionPercent: number;
  estimatedCostUsd: number;
  latencyMs: number;
  aiProvider: string;
  completionStatus?: string | null;
  status: string;
}

export interface AiBusinessSnapshot {
  businessId: string;
  totalCustomers: number;
  activeCustomers: number;
  returningCustomers: number;
  totalConversations: number;
  totalCustomerMessages: number;
  totalAiMessages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  dailyTokens: number;
  weeklyTokens: number;
  monthlyTokens: number;
  lifetimeTokens: number;
  avgTokensPerConversation: number;
  avgTokensPerCustomer: number;
  estimatedAiCost?: number | string;
  monthlyAiCost?: number | string;
  lifetimeAiCost?: number | string;
  avgResponseTimeMs: number;
  topProvider?: string | null;
  knowledgeBaseSize: number;
  trainingStatus?: string | null;
  lastTrainingAt?: string | null;
  healthScore?: number | null;
  automationSuccessRate: number;
  tokenSavingsPercent: number;
  lastActivityAt?: string | null;
}

export interface AiTokenIntelligence {
  inputTokens: number;
  outputTokens: number;
  knowledgeTokens: number;
  summaryTokens: number;
  averagePromptSize: number;
  averageResponseSize: number;
  compressionPercent: number;
  tokenSavingsPercent: number;
  estimatedSavings: number;
  dailySavings: number;
  monthlySavings: number;
  lifetimeSavings: number;
}

export interface AiCostIntelligence {
  todayCost: number;
  weeklyCost: number;
  monthlyCost: number;
  lifetimeCost: number;
  costPerCustomer: number;
  costPerConversation: number;
  costPerMessage: number;
  predictedEndOfMonthCost: number;
  projectedAnnualCost: number;
}

export interface AiAnalyticsCharts {
  dailyTokens: Array<{ date: string; tokens: number; cost: number }>;
  monthlyTokens?: Array<{ date: string; tokens: number; cost: number }>;
  conversationGrowth?: Array<{ date: string; count: number }>;
  customerGrowth?: Array<{ date: string; count: number }>;
  providerUsage: Array<{ provider: string; requests: number; tokens: number }>;
  peakHours?: Array<{ hour: number; count: number }>;
  peakDays?: Array<{ day: number; count: number }>;
  tokenSavings?: Array<{ date: string; savings: number }>;
}

export interface AiAnalyticsDashboard {
  snapshot: AiBusinessSnapshot | null;
  usage: {
    today: { totalTokens: number; estimatedCostUsd: number };
    thisWeek: { totalTokens: number };
    thisMonth: { totalTokens: number; estimatedCostUsd: number };
    lifetime: { totalTokens: number; estimatedCostUsd: number };
    predictedEndOfMonthCost: number;
    projectedAnnualCost: number;
  };
  customers: {
    total: number;
    active: number;
    returning: number;
    list: AiCustomerAnalytics[];
  };
  conversations: {
    total: number;
    totalCustomerMessages: number;
    totalAiMessages: number;
    avgTokensPerConversation: number;
    list: AiConversationAnalytics[];
  };
  performance: {
    avgResponseTimeMs: number;
    avgTokensPerCustomer: number;
    tokenSavingsPercent: number;
    automationSuccessRate: number;
    healthScore?: number | null;
    topProvider?: string | null;
  };
  knowledge: {
    chunkCount: number;
    trainingStatus?: string | null;
    lastTrainingAt?: string | null;
    topDocuments: Array<{ id: string; title: string; count: number }>;
  };
  tokenIntelligence: AiTokenIntelligence;
  costIntelligence: AiCostIntelligence;
  charts: AiAnalyticsCharts;
}

export interface AiBusinessDetailAnalytics extends Omit<AiAnalyticsDashboard, 'customers' | 'conversations'> {
  customers: AiCustomerAnalytics[];
  conversations: AiConversationAnalytics[];
  aiHistory: Array<{
    id: string;
    provider: string;
    totalTokens: number;
    estimatedCostUsd: number | string;
    createdAt: string;
  }>;
  trainingHistory: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export interface BusinessAnalyticsCard {
  businessId: string;
  name: string;
  logoUrl?: string | null;
  industry: string;
  status: string;
  licenseStatus?: string;
  createdAt: string;
  owner?: { firstName: string; lastName: string; email: string } | null;
  lastActivity?: string | null;
  totalCustomers: number;
  activeCustomers: number;
  returningCustomers: number;
  totalConversations: number;
  totalCustomerMessages: number;
  totalAiMessages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  dailyTokens: number;
  weeklyTokens: number;
  monthlyTokens: number;
  lifetimeTokens: number;
  avgTokensPerConversation: number;
  avgTokensPerCustomer: number;
  estimatedAiCost: number;
  monthlyAiCost: number;
  lifetimeAiCost: number;
  avgResponseTimeMs: number;
  topProvider?: string;
  knowledgeBaseSize: number;
  trainingStatus?: string;
  lastTrainingAt?: string | null;
  healthScore?: number | null;
  automationSuccessRate: number;
  tokenSavingsPercent: number;
}
