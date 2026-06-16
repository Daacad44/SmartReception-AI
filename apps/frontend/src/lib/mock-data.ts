import type {
  ConversationTrend,
  DashboardStats,
  RevenueOverview,
  TeamPerformance,
  TopService,
} from './types';

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
  industry: string;
  plan: string;
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
  status: 'indexed' | 'processing' | 'failed';
  uploadedAt: string;
  uploadedBy: string;
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

export const mockUser: User = {
  id: 'user-1',
  email: 'sarah@acmeclinic.com',
  firstName: 'Sarah',
  lastName: 'Johnson',
  avatar: undefined,
  role: 'OWNER',
};

export const mockBusinesses: Business[] = [
  { id: 'biz-1', name: 'Acme Medical Clinic', industry: 'CLINIC', plan: 'PROFESSIONAL' },
  { id: 'biz-2', name: 'Sunrise Dental', industry: 'CLINIC', plan: 'STARTER' },
  { id: 'biz-3', name: 'Grand Hotel & Spa', industry: 'HOTEL', plan: 'ENTERPRISE' },
];

export const mockDashboardStats: DashboardStats = {
  totalConversations: 2847,
  activeCustomers: 1234,
  appointmentsToday: 28,
  aiResolutionRate: 78.5,
  conversationGrowth: 12.3,
  customerGrowth: 8.7,
  appointmentGrowth: 15.2,
  aiGrowth: 5.4,
};

export const mockRevenueData: RevenueOverview[] = [
  { month: 'Jan', revenue: 42000 },
  { month: 'Feb', revenue: 45000 },
  { month: 'Mar', revenue: 48000 },
  { month: 'Apr', revenue: 44000 },
  { month: 'May', revenue: 52000 },
  { month: 'Jun', revenue: 58000 },
  { month: 'Jul', revenue: 55000 },
  { month: 'Aug', revenue: 61000 },
  { month: 'Sep', revenue: 67000 },
  { month: 'Oct', revenue: 72000 },
  { month: 'Nov', revenue: 69000 },
  { month: 'Dec', revenue: 78000 },
];

export const mockCustomerGrowth = [
  { month: 'Jan', customers: 820 },
  { month: 'Feb', customers: 890 },
  { month: 'Mar', customers: 950 },
  { month: 'Apr', customers: 1020 },
  { month: 'May', customers: 1080 },
  { month: 'Jun', customers: 1150 },
  { month: 'Jul', customers: 1180 },
  { month: 'Aug', customers: 1200 },
  { month: 'Sep', customers: 1210 },
  { month: 'Oct', customers: 1220 },
  { month: 'Nov', customers: 1228 },
  { month: 'Dec', customers: 1234 },
];

export const mockConversationTrends: ConversationTrend[] = [
  { date: 'Mon', count: 145 },
  { date: 'Tue', count: 168 },
  { date: 'Wed', count: 192 },
  { date: 'Thu', count: 178 },
  { date: 'Fri', count: 210 },
  { date: 'Sat', count: 98 },
  { date: 'Sun', count: 76 },
];

export const mockTopServices: TopService[] = [
  { serviceId: 's1', name: 'General Consultation', bookingCount: 342 },
  { serviceId: 's2', name: 'Dental Cleaning', bookingCount: 287 },
  { serviceId: 's3', name: 'Follow-up Visit', bookingCount: 198 },
  { serviceId: 's4', name: 'Lab Tests', bookingCount: 156 },
  { serviceId: 's5', name: 'Vaccination', bookingCount: 124 },
];

export const mockTeamPerformance: TeamPerformance[] = [
  { userId: 't1', name: 'Sarah Johnson', conversationCount: 342, resolutionRate: 94.2 },
  { userId: 't2', name: 'Mike Chen', conversationCount: 298, resolutionRate: 91.8 },
  { userId: 't3', name: 'Emily Davis', conversationCount: 267, resolutionRate: 89.5 },
  { userId: 't4', name: 'AI Assistant', conversationCount: 1840, resolutionRate: 78.5 },
];

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    customerId: 'cust-1',
    customerName: 'John Smith',
    customerPhone: '+1 555-0101',
    lastMessage: 'Thank you! What time is my appointment tomorrow?',
    lastMessageAt: new Date(Date.now() - 5 * 60000).toISOString(),
    unreadCount: 2,
    status: 'open',
    assignedTo: 'Sarah Johnson',
    tags: ['appointment', 'urgent'],
  },
  {
    id: 'conv-2',
    customerId: 'cust-2',
    customerName: 'Maria Garcia',
    customerPhone: '+1 555-0102',
    lastMessage: 'I need to reschedule my visit for next week.',
    lastMessageAt: new Date(Date.now() - 15 * 60000).toISOString(),
    unreadCount: 1,
    status: 'pending',
    tags: ['reschedule'],
  },
  {
    id: 'conv-3',
    customerId: 'cust-3',
    customerName: 'David Wilson',
    customerPhone: '+1 555-0103',
    lastMessage: 'The AI helped me book my appointment perfectly!',
    lastMessageAt: new Date(Date.now() - 45 * 60000).toISOString(),
    unreadCount: 0,
    status: 'resolved',
    tags: ['ai-resolved'],
  },
  {
    id: 'conv-4',
    customerId: 'cust-4',
    customerName: 'Lisa Anderson',
    customerPhone: '+1 555-0104',
    lastMessage: 'What are your operating hours on weekends?',
    lastMessageAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    unreadCount: 0,
    status: 'ai_handling',
    tags: ['faq'],
  },
  {
    id: 'conv-5',
    customerId: 'cust-5',
    customerName: 'Robert Brown',
    customerPhone: '+1 555-0105',
    lastMessage: 'Can I get a copy of my medical records?',
    lastMessageAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    unreadCount: 3,
    status: 'open',
    assignedTo: 'Mike Chen',
    tags: ['records'],
  },
  {
    id: 'conv-6',
    customerId: 'cust-6',
    customerName: 'Jennifer Lee',
    customerPhone: '+1 555-0106',
    lastMessage: 'Is Dr. Patel available this Friday?',
    lastMessageAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    unreadCount: 0,
    status: 'resolved',
    tags: ['doctor-inquiry'],
  },
];

export const mockMessages: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      content: 'Hi, I have an appointment scheduled for tomorrow.',
      sender: 'customer',
      senderName: 'John Smith',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      status: 'read',
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      content: 'Hello John! Yes, I can see your appointment is scheduled for tomorrow at 10:00 AM with Dr. Patel.',
      sender: 'agent',
      senderName: 'Sarah Johnson',
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
      status: 'read',
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      content: 'Thank you! What time is my appointment tomorrow?',
      sender: 'customer',
      senderName: 'John Smith',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'delivered',
    },
  ],
  'conv-2': [
    {
      id: 'msg-4',
      conversationId: 'conv-2',
      content: 'I need to reschedule my visit for next week.',
      sender: 'customer',
      senderName: 'Maria Garcia',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      status: 'delivered',
    },
  ],
};

export const mockCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 555-0101',
    tags: ['vip', 'regular'],
    totalConversations: 24,
    lastContact: new Date(Date.now() - 5 * 60000).toISOString(),
    status: 'vip',
    createdAt: '2024-03-15',
  },
  {
    id: 'cust-2',
    name: 'Maria Garcia',
    email: 'maria.g@email.com',
    phone: '+1 555-0102',
    tags: ['new'],
    totalConversations: 3,
    lastContact: new Date(Date.now() - 15 * 60000).toISOString(),
    status: 'active',
    createdAt: '2025-01-10',
  },
  {
    id: 'cust-3',
    name: 'David Wilson',
    phone: '+1 555-0103',
    tags: ['regular'],
    totalConversations: 12,
    lastContact: new Date(Date.now() - 45 * 60000).toISOString(),
    status: 'active',
    createdAt: '2024-08-22',
  },
  {
    id: 'cust-4',
    name: 'Lisa Anderson',
    email: 'lisa.a@email.com',
    phone: '+1 555-0104',
    tags: ['inactive'],
    totalConversations: 8,
    lastContact: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'inactive',
    createdAt: '2024-01-05',
  },
  {
    id: 'cust-5',
    name: 'Robert Brown',
    email: 'robert.b@email.com',
    phone: '+1 555-0105',
    tags: ['urgent', 'regular'],
    totalConversations: 18,
    lastContact: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: 'active',
    createdAt: '2024-06-18',
  },
  {
    id: 'cust-6',
    name: 'Jennifer Lee',
    email: 'jennifer.lee@email.com',
    phone: '+1 555-0106',
    tags: ['vip'],
    totalConversations: 31,
    lastContact: new Date(Date.now() - 6 * 3600000).toISOString(),
    status: 'vip',
    createdAt: '2023-11-30',
  },
];

export const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    customerId: 'cust-1',
    customerName: 'John Smith',
    service: 'General Consultation',
    date: '2025-06-17',
    time: '10:00',
    duration: 30,
    status: 'confirmed',
  },
  {
    id: 'apt-2',
    customerId: 'cust-2',
    customerName: 'Maria Garcia',
    service: 'Dental Cleaning',
    date: '2025-06-17',
    time: '11:30',
    duration: 45,
    status: 'pending',
  },
  {
    id: 'apt-3',
    customerId: 'cust-3',
    customerName: 'David Wilson',
    service: 'Follow-up Visit',
    date: '2025-06-17',
    time: '14:00',
    duration: 20,
    status: 'confirmed',
  },
  {
    id: 'apt-4',
    customerId: 'cust-5',
    customerName: 'Robert Brown',
    service: 'Lab Tests',
    date: '2025-06-18',
    time: '09:00',
    duration: 60,
    status: 'confirmed',
  },
  {
    id: 'apt-5',
    customerId: 'cust-6',
    customerName: 'Jennifer Lee',
    service: 'Vaccination',
    date: '2025-06-18',
    time: '15:30',
    duration: 15,
    status: 'pending',
  },
  {
    id: 'apt-6',
    customerId: 'cust-4',
    customerName: 'Lisa Anderson',
    service: 'General Consultation',
    date: '2025-06-19',
    time: '10:30',
    duration: 30,
    status: 'cancelled',
  },
];

export const mockKnowledgeDocs: KnowledgeDocument[] = [
  {
    id: 'doc-1',
    title: 'Clinic Services & Pricing Guide',
    type: 'pdf',
    size: '2.4 MB',
    status: 'indexed',
    uploadedAt: '2025-01-15',
    uploadedBy: 'Sarah Johnson',
  },
  {
    id: 'doc-2',
    title: 'FAQ - Patient Inquiries',
    type: 'doc',
    size: '156 KB',
    status: 'indexed',
    uploadedAt: '2025-02-20',
    uploadedBy: 'Mike Chen',
  },
  {
    id: 'doc-3',
    title: 'Operating Hours & Holiday Schedule',
    type: 'txt',
    size: '12 KB',
    status: 'indexed',
    uploadedAt: '2025-03-01',
    uploadedBy: 'Sarah Johnson',
  },
  {
    id: 'doc-4',
    title: 'Insurance & Payment Policies',
    type: 'pdf',
    size: '890 KB',
    status: 'processing',
    uploadedAt: '2025-06-10',
    uploadedBy: 'Emily Davis',
  },
  {
    id: 'doc-5',
    title: 'https://acmeclinic.com/services',
    type: 'url',
    size: '-',
    status: 'indexed',
    uploadedAt: '2025-04-12',
    uploadedBy: 'Sarah Johnson',
  },
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'team-1',
    name: 'Sarah Johnson',
    email: 'sarah@acmeclinic.com',
    role: 'OWNER',
    status: 'online',
    conversationsHandled: 342,
    avgResponseTime: '2.3 min',
  },
  {
    id: 'team-2',
    name: 'Mike Chen',
    email: 'mike@acmeclinic.com',
    role: 'MANAGER',
    status: 'online',
    conversationsHandled: 298,
    avgResponseTime: '3.1 min',
  },
  {
    id: 'team-3',
    name: 'Emily Davis',
    email: 'emily@acmeclinic.com',
    role: 'AGENT',
    status: 'away',
    conversationsHandled: 267,
    avgResponseTime: '4.2 min',
  },
  {
    id: 'team-4',
    name: 'James Wilson',
    email: 'james@acmeclinic.com',
    role: 'AGENT',
    status: 'offline',
    conversationsHandled: 189,
    avgResponseTime: '5.8 min',
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    title: 'New conversation',
    message: 'John Smith started a new conversation',
    type: 'info',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'notif-2',
    title: 'Appointment confirmed',
    message: 'Maria Garcia confirmed her appointment for tomorrow',
    type: 'success',
    read: false,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'notif-3',
    title: 'AI escalation',
    message: 'Robert Brown needs human assistance',
    type: 'warning',
    read: true,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
];

export const mockAnalyticsData = {
  totalMessages: 45230,
  avgResponseTime: '3.2 min',
  satisfactionScore: 4.7,
  aiHandledPercent: 78.5,
  channelBreakdown: [
    { channel: 'WhatsApp', count: 38420, percent: 85 },
    { channel: 'SMS', count: 4520, percent: 10 },
    { channel: 'Web Chat', count: 2290, percent: 5 },
  ],
  hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    messages: Math.floor(Math.random() * 80) + 20,
  })),
  topTopics: [
    { topic: 'Appointments', count: 1240 },
    { topic: 'Pricing', count: 890 },
    { topic: 'Operating Hours', count: 670 },
    { topic: 'Insurance', count: 450 },
    { topic: 'Directions', count: 320 },
  ],
};

export const mockBillingData = {
  plan: 'PROFESSIONAL',
  status: 'active',
  price: 99,
  billingCycle: 'monthly',
  nextBillingDate: '2025-07-15',
  usage: {
    conversations: { used: 2847, limit: 5000 },
    aiMessages: { used: 12450, limit: 20000 },
    teamMembers: { used: 4, limit: 10 },
    storage: { used: 2.4, limit: 10 },
  },
  invoices: [
    { id: 'inv-1', date: '2025-06-15', amount: 99, status: 'paid' },
    { id: 'inv-2', date: '2025-05-15', amount: 99, status: 'paid' },
    { id: 'inv-3', date: '2025-04-15', amount: 99, status: 'paid' },
  ],
};
