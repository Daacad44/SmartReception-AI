import type {
  ConversationTrend,
  DashboardStats,
  RevenueOverview,
  TeamPerformance,
  TopService,
} from './types';

export type { DashboardStats, RevenueOverview, ConversationTrend, TopService, TeamPerformance };

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
}

export interface Business {
  id: string;
  name: string;
  industry?: string;
  plan?: string;
  slug?: string;
  role?: string;
  logo?: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'pending' | 'resolved' | 'ai_handling';
  assignedTo?: string;
  tags: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'customer' | 'agent' | 'ai';
  senderName: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  avatar?: string;
  tags: string[];
  totalConversations: number;
  lastContact: string;
  status: 'active' | 'inactive' | 'vip';
  createdAt: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes?: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: 'pdf' | 'doc' | 'txt' | 'url';
  size: string;
  status: 'indexed' | 'processing' | 'pending' | 'failed';
  uploadedAt: string;
  uploadedBy: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  knowledgeBaseId: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  conversationsHandled: number;
  avgResponseTime: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface AnalyticsData {
  totalMessages: number;
  avgResponseTime: string;
  satisfactionScore: number;
  aiHandledPercent: number;
  channelBreakdown: Array<{ channel: string; count: number; percent: number }>;
  hourlyActivity: Array<{ hour: string; messages: number }>;
  topTopics: Array<{ topic: string; count: number }>;
}

export interface BillingData {
  plan: string;
  status: string;
  price: number;
  billingCycle: string;
  nextBillingDate: string;
  usage: Record<string, { used: number; limit: number }>;
  invoices: Array<{ id: string; date: string; amount: number; status: string }>;
}

export interface CustomerGrowthPoint {
  month: string;
  customers: number;
}
