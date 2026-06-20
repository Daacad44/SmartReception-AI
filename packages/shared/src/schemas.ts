import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    businessName: z.string().min(1).max(200),
    industry: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
  password: z.string().min(8).max(128),
});

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  industry: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  timezone: z.string().default('UTC'),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(5000).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createAppointmentSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export const changePlanSchema = z.object({
  plan: z.enum(['STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE']),
});

export const checkoutSchema = z.object({
  plan: z.enum(['STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE']),
});

export const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(1).max(100),
  phoneNumber: z.string().min(1).max(20),
  displayName: z.string().max(200).optional(),
  wabaId: z.string().max(100).optional(),
  accessToken: z.string().min(1).max(500),
});

export const knowledgeSearchSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO']).default('TEXT'),
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER']),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER']),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  duration: z.number().int().min(5).max(480),
  price: z.number().min(0).optional(),
});

export const createFaqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
  category: z.string().max(100).optional(),
});

export const aiConfigSchema = z.object({
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(50).max(4096).default(500),
  enableAutoReply: z.boolean().default(true),
  enableBooking: z.boolean().default(true),
  enableLeadQualification: z.boolean().default(true),
  languages: z.array(z.string()).default(['en']),
  greetingMessage: z.string().max(1000).optional(),
  fallbackMessage: z.string().max(1000).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type AiConfigInput = z.infer<typeof aiConfigSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchSchema>;
