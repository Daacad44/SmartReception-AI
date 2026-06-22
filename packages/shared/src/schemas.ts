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
  companyName: z.string().max(200).optional(),
  whatsappNumber: z.string().max(20).optional(),
  customerType: z
    .enum(['VIP', 'REGULAR', 'NEW_CUSTOMER', 'RETURNING', 'HIGH_VALUE', 'INACTIVE', 'LEAD'])
    .optional(),
  leadStatus: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional(),
  customerValue: z.number().min(0).optional(),
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
  companyName: z.string().max(200).optional(),
  serviceRequested: z.string().max(200).optional(),
  additionalNotes: z.string().max(2000).optional(),
  leadSource: z.enum(['WHATSAPP', 'WEBSITE', 'FORM', 'PHONE', 'REFERRAL', 'OTHER']).optional(),
  assignedToId: z.string().uuid().optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  customerEmail: z.string().email().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  serviceCategory: z.string().max(100).optional(),
  budget: z.number().min(0).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'MISSED']).optional(),
});

export const appointmentActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'reschedule', 'cancel', 'complete', 'mark_missed', 'assign']),
  assignedToId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  internalNote: z.string().max(2000).optional(),
  rejectionReason: z.string().max(1000).optional(),
});

export const addInternalNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const twoFactorVerifySchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(6).max(8),
});

export const twoFactorSetupVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(6).max(8),
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
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'TEMPLATE', 'INTERACTIVE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
  mediaFilename: z.string().max(255).optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'RECEPTIONIST', 'STAFF']),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'RECEPTIONIST', 'STAFF']),
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

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  customerType: z
    .enum(['VIP', 'REGULAR', 'NEW_CUSTOMER', 'RETURNING', 'HIGH_VALUE', 'INACTIVE', 'LEAD'])
    .optional(),
  customerIds: z.array(z.string().uuid()).optional(),
});

export const updateSegmentSchema = createSegmentSchema.partial();

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(4096),
  type: z
    .enum(['PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING'])
    .default('MARKETING'),
  schedule: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY']).default('ONE_TIME'),
  segmentId: z.string().uuid().optional(),
  customerTypes: z
    .array(
      z.enum(['VIP', 'REGULAR', 'NEW_CUSTOMER', 'RETURNING', 'HIGH_VALUE', 'INACTIVE', 'LEAD'])
    )
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const superAdminCreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
  ownerPassword: z.string().min(8).max(128).optional(),
  industry: z.string().optional(),
  plan: z.enum(['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  phone: z.string().max(20).optional(),
});

export const superAdminUpdateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  plan: z.enum(['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
});

export const superAdminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  isSuperAdmin: z.boolean().optional(),
  businessId: z.string().uuid().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'RECEPTIONIST', 'STAFF']).optional(),
});

export const superAdminUpdateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  totpEnabled: z.boolean().optional(),
  businessId: z.string().uuid().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'RECEPTIONIST', 'STAFF']).optional(),
});

export const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string().uuid(),
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
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorSetupVerifyInput = z.infer<typeof twoFactorSetupVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
export type AppointmentActionInput = z.infer<typeof appointmentActionSchema>;
export type AddInternalNoteInput = z.infer<typeof addInternalNoteSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type SuperAdminCreateBusinessInput = z.infer<typeof superAdminCreateBusinessSchema>;
export type SuperAdminUpdateBusinessInput = z.infer<typeof superAdminUpdateBusinessSchema>;
export type SuperAdminCreateUserInput = z.infer<typeof superAdminCreateUserSchema>;
export type SuperAdminUpdateUserInput = z.infer<typeof superAdminUpdateUserSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
