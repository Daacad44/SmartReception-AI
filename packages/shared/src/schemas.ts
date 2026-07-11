import { z } from 'zod';

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(8).max(128),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    businessName: z.string().min(2).max(200),
    phone: z.string().min(6).max(20),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const checkEmailSchema = z.object({
  email: z.string().email(),
});

export const onboardingBusinessInfoSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1).optional(),
  businessType: z.string().min(1).max(200).optional(),
  businessCategory: z.string().min(1).max(100).optional(),
  phone: z.string().min(6).max(20),
  whatsappNumber: z.string().min(6).max(20).optional().or(z.literal('')),
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  website: z.string().url().optional().or(z.literal('')),
});

export const onboardingDescriptionSchema = z.object({
  description: z.string().min(10).max(5000),
});

export const onboardingServicesSchema = z.object({
  services: z.array(z.string().min(1).max(200)).min(1),
});

export const onboardingWorkingHoursSchema = z.object({
  workingHours: z.record(
    z.string(),
    z.object({
      open: z.string().min(1),
      close: z.string().min(1),
      closed: z.boolean().optional(),
    })
  ),
});

export const onboardingLanguagesSchema = z.object({
  languages: z.array(z.enum(['so', 'en', 'ar'])).min(1),
});

export const onboardingProfileSchema = z.object({
  employeeRange: z.enum(['1-5', '5-20', '20-50', '50-100', '100+']),
  customerVolume: z.enum(['1-50', '50-200', '200-1000', '1000+']),
  mainGoal: z.enum([
    'AI_RECEPTIONIST',
    'WHATSAPP_AUTOMATION',
    'APPOINTMENT_BOOKING',
    'CRM',
    'MARKETING_CAMPAIGNS',
    'CUSTOMER_SUPPORT',
    'LEAD_GENERATION',
  ]),
});

export const onboardingDiscoverySchema = z.object({
  referralSource: z.enum([
    'FACEBOOK',
    'TIKTOK',
    'GOOGLE',
    'WHATSAPP',
    'YOUTUBE',
    'FRIEND_REFERRAL',
    'EXISTING_CUSTOMER',
    'OTHER',
  ]),
  problemToSolve: z.string().min(10).max(2000),
  biggestChallenge: z.string().min(10).max(2000),
});

export const onboardingPlanSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
});

export const onboardingWhatsAppSchema = z
  .object({
    wabaId: z.string().optional(),
    phoneNumberId: z.string().optional(),
    accessToken: z.string().optional(),
    phoneNumber: z.string().optional(),
    displayName: z.string().optional(),
    skipConnection: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.skipConnection) return;
    if (!data.wabaId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WABA ID is required', path: ['wabaId'] });
    }
    if (!data.phoneNumberId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone Number ID is required',
        path: ['phoneNumberId'],
      });
    }
    if (!data.accessToken?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Access token is required',
        path: ['accessToken'],
      });
    }
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

export const CUSTOMER_TYPES = [
  'VIP',
  'REGULAR',
  'NEW_CUSTOMER',
  'RETURNING',
  'HIGH_VALUE',
  'PREMIUM',
  'INACTIVE',
  'LEAD',
  'PROSPECT',
] as const;

export const customerTypeSchema = z.enum(CUSTOMER_TYPES);

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(5000).optional(),
  companyName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  whatsappNumber: z.string().max(20).optional(),
  customerType: customerTypeSchema.optional(),
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
  status: z.enum(['DRAFT', 'PENDING', 'SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'MISSED', 'IN_PROGRESS', 'REJECTED', 'RESCHEDULED', 'EXPIRED', 'ARCHIVED', 'CUSTOMER_ARRIVED']).optional(),
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

export const updateWhatsAppAccountSchema = z.object({
  reengagementTemplateName: z.string().max(200).optional().nullable(),
  reengagementTemplateLanguage: z.string().max(20).optional().nullable(),
  reengagementTemplateHasBodyVariable: z.boolean().optional(),
});

export const whatsappOAuthExchangeSchema = z.object({
  code: z.string().min(1).max(2000),
  wabaId: z.string().min(1).max(100),
  phoneNumberId: z.string().min(1).max(100),
});

export const knowledgeSearchSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(4096).optional(),
    templateId: z.string().uuid().optional(),
    type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'TEMPLATE', 'INTERACTIVE']).default('TEXT'),
    mediaUrl: z.string().url().optional(),
    mediaFilename: z.string().max(255).optional(),
  })
  .refine((data) => Boolean(data.templateId) || Boolean(data.content?.trim()), {
    message: 'Message content or templateId is required',
  });

export const conversationAssignSchema = z.object({
  assigneeId: z.string().uuid(),
  team: z.enum(['SUPPORT', 'SALES', 'TECHNICAL', 'GENERAL']).optional().nullable(),
});

export const conversationTransferSchema = z.object({
  assigneeId: z.string().uuid().optional().nullable(),
  team: z.enum(['SUPPORT', 'SALES', 'TECHNICAL', 'GENERAL']).optional().nullable(),
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
  customerType: customerTypeSchema.optional(),
  customerIds: z.array(z.string().uuid()).optional(),
});

export const updateSegmentSchema = createSegmentSchema.partial();

export const CAMPAIGN_TYPES = [
  'PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING',
  'WELCOME', 'APPOINTMENT_REMINDER', 'BIRTHDAY', 'PAYMENT_REMINDER', 'INVOICE',
  'PRODUCT_LAUNCH', 'SEASONAL', 'DISCOUNT', 'RETENTION', 'RE_ENGAGEMENT', 'THANK_YOU', 'CUSTOM',
] as const;

export const CAMPAIGN_SCHEDULES = [
  'ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RECURRING', 'CUSTOM',
] as const;

export const CAMPAIGN_MESSAGE_TYPES = [
  'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'LOCATION', 'INTERACTIVE', 'TEMPLATE',
] as const;

const scheduleConfigSchema = z.object({
  weekdays: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  lastDayOfMonth: z.boolean().optional(),
  yearlyMonth: z.number().min(1).max(12).optional(),
  yearlyDay: z.number().min(1).max(31).optional(),
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
}).optional();

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(4096),
  type: z.enum(CAMPAIGN_TYPES).default('MARKETING'),
  schedule: z.enum(CAMPAIGN_SCHEDULES).default('ONE_TIME'),
  messageType: z.enum(CAMPAIGN_MESSAGE_TYPES).default('TEXT'),
  segmentId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  customerTypes: z.array(customerTypeSchema).optional(),
  customerIds: z.array(z.string().uuid()).optional(),
  sendToAll: z.boolean().optional(),
  targetCustomerId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  cronExpression: z.string().max(100).optional(),
  scheduleConfig: scheduleConfigSchema,
  repeatCount: z.number().int().positive().optional(),
  repeatUntil: z.string().datetime().optional(),
  mediaUrl: z.string().url().optional(),
  mediaFilename: z.string().max(255).optional(),
  category: z.string().max(64).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const testCampaignSchema = z.object({
  phone: z.string().min(5).max(20),
});

export const generateCampaignAiSchema = z.object({
  prompt: z.string().min(5).max(2000),
  type: z.enum(CAMPAIGN_TYPES).optional(),
  tone: z.string().max(100).optional(),
  language: z.enum(['so', 'en']).optional(),
  versions: z.number().int().min(1).max(4).optional(),
});

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'] as const;
export const EMPLOYEE_BROADCAST_TYPES = [
  'ANNOUNCEMENT', 'NOTIFICATION', 'EMERGENCY', 'MEETING', 'HOLIDAY', 'POLICY',
  'TRAINING', 'MOTIVATION', 'PAYROLL', 'SHIFT', 'CUSTOM',
] as const;
export const EMPLOYEE_BROADCAST_SCHEDULES = [
  'ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RECURRING',
] as const;

export const createEmployeeSchema = z.object({
  employeeCode: z.string().max(50).optional(),
  fullName: z.string().min(1).max(200),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  phone: z.string().min(5).max(20),
  whatsappNumber: z.string().min(5).max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  profilePhotoUrl: z.string().url().optional(),
  branch: z.string().max(100).optional(),
  managerId: z.string().uuid().optional(),
  hireDate: z.string().datetime().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(64).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional(),
  emergencyContact: z.string().max(100).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const createEmployeeGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  department: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  ownerId: z.string().uuid().optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
});

export const updateEmployeeGroupSchema = createEmployeeGroupSchema.partial();

const employeeAudienceFilterSchema = z.object({
  department: z.string().max(100).optional(),
  branch: z.string().max(100).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  role: z.string().max(100).optional(),
  roles: z.array(z.string().max(100)).optional(),
  tags: z.array(z.string().max(50)).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
  logic: z.enum(['AND', 'OR']).optional(),
}).optional();

export const createEmployeeBroadcastSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(4096),
  type: z.enum(EMPLOYEE_BROADCAST_TYPES).default('ANNOUNCEMENT'),
  schedule: z.enum(EMPLOYEE_BROADCAST_SCHEDULES).default('ONE_TIME'),
  messageType: z.enum(CAMPAIGN_MESSAGE_TYPES).default('TEXT'),
  groupId: z.string().uuid().optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  department: z.string().max(100).optional(),
  branch: z.string().max(100).optional(),
  roles: z.array(z.string().max(100)).optional(),
  tags: z.array(z.string().max(50)).optional(),
  audienceFilter: employeeAudienceFilterSchema,
  employeeIds: z.array(z.string().uuid()).optional(),
  sendToAll: z.boolean().optional(),
  templateId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  cronExpression: z.string().max(100).optional(),
  scheduleConfig: scheduleConfigSchema,
  repeatCount: z.number().int().positive().optional(),
  repeatUntil: z.string().datetime().optional(),
  mediaUrl: z.string().url().optional(),
  mediaFilename: z.string().max(255).optional(),
  isEmergency: z.boolean().optional(),
});

export const createEmployeeTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(4096),
  category: z.string().max(64).optional(),
  variables: z.array(z.string().max(50)).optional(),
});

export const updateEmployeeTemplateSchema = createEmployeeTemplateSchema.partial();

export const generateEmployeeMessageSchema = z.object({
  prompt: z.string().min(5).max(2000),
  tone: z.string().max(100).optional(),
  type: z.string().max(64).optional(),
  language: z.enum(['so', 'en']).optional(),
});

export const sendEmployeeReplySchema = z.object({
  content: z.string().min(1).max(4096),
});

export const bulkEmployeeIdsSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
});

export const bulkAssignGroupsSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  groupIds: z.array(z.string().uuid()).min(1).max(50),
});

export const bulkRemoveGroupsSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  groupIds: z.array(z.string().uuid()).min(1).max(50),
});

export const bulkUpdateEmployeeStatusSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(EMPLOYEE_STATUSES),
});

export const moveEmployeesGroupSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  fromGroupId: z.string().uuid(),
  toGroupId: z.string().uuid(),
});

export const mergeGroupsSchema = z.object({
  sourceGroupId: z.string().uuid(),
  targetGroupId: z.string().uuid(),
});

export const groupMembersSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
});

export const employeeExportSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  employeeIds: z.array(z.string().uuid()).optional(),
  groupId: z.string().uuid().optional(),
  department: z.string().max(100).optional(),
  branch: z.string().max(100).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
});

export const employeeImportPasteSchema = z.object({
  content: z.string().min(10).max(500000),
});

export const previewRecipientsSchema = createEmployeeBroadcastSchema.pick({
  sendToAll: true,
  groupId: true,
  groupIds: true,
  department: true,
  branch: true,
  roles: true,
  tags: true,
  employeeIds: true,
  audienceFilter: true,
}).partial();

export const createJourneySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  triggerType: z.string().max(64).optional(),
  steps: z.array(z.object({
    delayMinutes: z.number().int().min(0).max(525600),
    message: z.string().min(1).max(4096),
    messageType: z.enum(CAMPAIGN_MESSAGE_TYPES).optional(),
    mediaUrl: z.string().url().optional(),
    templateId: z.string().uuid().optional(),
  })).min(1).max(20),
});

export const enrollJourneySchema = z.object({
  customerId: z.string().uuid(),
});

export const createMessageTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(4096),
  type: z.enum(CAMPAIGN_TYPES).default('MARKETING'),
  variables: z.array(z.string().max(50)).optional(),
  whatsappTemplateName: z.string().max(200).optional().nullable(),
  whatsappTemplateLanguage: z.string().max(20).optional().nullable(),
});

export const updateMessageTemplateSchema = createMessageTemplateSchema.partial();

/**
 * The Business Profile GET endpoint returns the full row (with many `null`
 * columns). The frontend seeds its form from that response and PATCHes the whole
 * form back, so every empty field arrives as `null` (or `''`), NOT `undefined`.
 *
 * A plain `.optional()` field only accepts `string | undefined` and throws on
 * `null` — which is the ROOT CAUSE of "Failed to save Business Profile": a single
 * unset column (website, email, mission, …) failed Zod validation and returned a
 * 400 for the entire save. These helpers accept `null` and `''`, treat blanks as
 * "clear this field" (→ `null`), and keep real validation for non-empty values.
 */
const blankToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v;

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().max(max).nullable().optional());

const optionalUrl = () =>
  z.preprocess(blankToNull, z.string().url().max(2000).nullable().optional());

const optionalEmail = () =>
  z.preprocess(blankToNull, z.string().email().max(200).nullable().optional());

const optionalStringArray = (max = 200) =>
  z.preprocess(
    (v) => (v == null ? v : v),
    z.array(z.string().max(max)).nullable().optional()
  );

export const updateBusinessProfileSchema = z.object({
  businessName: optionalText(200),
  logoUrl: optionalUrl(),
  coverImageUrl: optionalUrl(),
  businessCategory: optionalText(100),
  industryLabel: optionalText(100),
  companyOverview: optionalText(5000),
  aboutUs: optionalText(5000),
  mission: optionalText(2000),
  vision: optionalText(2000),
  coreValues: optionalStringArray(),
  businessDescription: optionalText(5000),
  targetAudience: optionalText(2000),
  founder: optionalText(200),
  website: optionalUrl(),
  email: optionalEmail(),
  supportEmail: optionalEmail(),
  phone: optionalText(30),
  whatsapp: optionalText(30),
  address: optionalText(500),
  country: optionalText(100),
  city: optionalText(100),
  timezone: optionalText(100),
  latitude: z.preprocess(blankToNull, z.number().min(-90).max(90).nullable().optional()),
  longitude: z.preprocess(blankToNull, z.number().min(-180).max(180).nullable().optional()),
  workingHours: optionalText(500),
  googleMapsUrl: optionalUrl(),
  socialMedia: z.record(z.string()).nullable().optional(),
  yearsInBusiness: z.preprocess(blankToNull, z.number().int().min(0).max(200).nullable().optional()),
  certifications: optionalStringArray(),
  awards: optionalStringArray(),
  brandTone: optionalText(200),
  languages: optionalStringArray(20),
  callToAction: optionalText(500),
  whyChooseUs: optionalText(3000),
  companyIntroduction: optionalText(5000),
  companySummary: optionalText(3000),
  shortIntroduction: optionalText(1500),
  longIntroduction: optionalText(8000),
});

// ─── Structured Working Hours + Appointment Settings + Exceptions ─────────────

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24-hour)');

export const dayHoursSchema = z
  .object({
    isOpen: z.boolean().default(true),
    openTime: HHMM.default('09:00'),
    closeTime: HHMM.default('18:00'),
    breakStart: z.preprocess(blankToNull, HHMM.nullable().optional()),
    breakEnd: z.preprocess(blankToNull, HHMM.nullable().optional()),
  })
  .refine((d) => !d.isOpen || d.closeTime > d.openTime, {
    message: 'Closing time must be after opening time',
    path: ['closeTime'],
  })
  .refine(
    (d) => (!d.breakStart && !d.breakEnd) || (!!d.breakStart && !!d.breakEnd && d.breakEnd > d.breakStart),
    { message: 'Break end must be after break start', path: ['breakEnd'] }
  );

export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const weeklyHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

export function defaultDayHours(isOpen: boolean): z.infer<typeof dayHoursSchema> {
  return { isOpen, openTime: '09:00', closeTime: '18:00', breakStart: null, breakEnd: null };
}

/** Sensible default week: open Mon–Sat, closed Sunday. */
export function defaultWeeklyHours(): z.infer<typeof weeklyHoursSchema> {
  return {
    monday: defaultDayHours(true),
    tuesday: defaultDayHours(true),
    wednesday: defaultDayHours(true),
    thursday: defaultDayHours(true),
    friday: defaultDayHours(true),
    saturday: defaultDayHours(true),
    sunday: defaultDayHours(false),
  };
}

export const appointmentSettingsSchema = z.object({
  timezone: z.string().max(100).default('Africa/Mogadishu'),
  slotDurationMinutes: z.number().int().min(5).max(480).default(30),
  bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(0),
  minNoticeMinutes: z.number().int().min(0).max(20160).default(60),
  maxAdvanceDays: z.number().int().min(1).max(365).default(60),
  maxDailyBookings: z.preprocess(blankToNull, z.number().int().min(0).max(1000).nullable().optional()),
  allowSameDay: z.boolean().default(true),
  weeklyHours: weeklyHoursSchema.optional(),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(365).optional(),
  unavailableSlots: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start: HHMM,
        end: HHMM,
      })
    )
    .max(500)
    .optional(),
});

export const updateAppointmentSettingsSchema = appointmentSettingsSchema.partial();

export const BUSINESS_EXCEPTION_TYPES = [
  'NATIONAL_HOLIDAY',
  'RELIGIOUS_HOLIDAY',
  'EMERGENCY_CLOSURE',
  'MAINTENANCE',
  'VACATION',
  'SPECIAL_HOURS',
  'HALF_DAY',
  'TEMPORARY_CLOSURE',
] as const;

const businessExceptionBaseSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(BUSINESS_EXCEPTION_TYPES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.preprocess(
    blankToNull,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
  ),
  isClosed: z.boolean().default(true),
  openTime: z.preprocess(blankToNull, HHMM.nullable().optional()),
  closeTime: z.preprocess(blankToNull, HHMM.nullable().optional()),
  note: optionalText(1000),
});

const requireSpecialHours = (e: { isClosed?: boolean; openTime?: unknown; closeTime?: unknown }) =>
  e.isClosed !== false || (!!e.openTime && !!e.closeTime);

export const businessExceptionSchema = businessExceptionBaseSchema.refine(requireSpecialHours, {
  message: 'Special/half-day hours require both open and close time',
  path: ['openTime'],
});

export const updateBusinessExceptionSchema = businessExceptionBaseSchema.partial();

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
export type OnboardingBusinessInfoInput = z.infer<typeof onboardingBusinessInfoSchema>;
export type OnboardingDescriptionInput = z.infer<typeof onboardingDescriptionSchema>;
export type OnboardingServicesInput = z.infer<typeof onboardingServicesSchema>;
export type OnboardingWorkingHoursInput = z.infer<typeof onboardingWorkingHoursSchema>;
export type OnboardingLanguagesInput = z.infer<typeof onboardingLanguagesSchema>;
export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type OnboardingDiscoveryInput = z.infer<typeof onboardingDiscoverySchema>;
export type OnboardingPlanInput = z.infer<typeof onboardingPlanSchema>;
export type OnboardingWhatsAppInput = z.infer<typeof onboardingWhatsAppSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConversationAssignInput = z.infer<typeof conversationAssignSchema>;
export type ConversationTransferInput = z.infer<typeof conversationTransferSchema>;
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
export type UpdateWhatsAppAccountInput = z.infer<typeof updateWhatsAppAccountSchema>;
export type WhatsAppOAuthExchangeInput = z.infer<typeof whatsappOAuthExchangeSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorSetupVerifyInput = z.infer<typeof twoFactorSetupVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
export type AppointmentActionInput = z.infer<typeof appointmentActionSchema>;
export type AddInternalNoteInput = z.infer<typeof addInternalNoteSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type TestCampaignInput = z.infer<typeof testCampaignSchema>;
export type GenerateCampaignAiInput = z.infer<typeof generateCampaignAiSchema>;
export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type CreateMessageTemplateInput = z.infer<typeof createMessageTemplateSchema>;
export type UpdateMessageTemplateInput = z.infer<typeof updateMessageTemplateSchema>;
export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;
export type DayHours = z.infer<typeof dayHoursSchema>;
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;
export type AppointmentSettingsInput = z.infer<typeof appointmentSettingsSchema>;
export type UpdateAppointmentSettingsInput = z.infer<typeof updateAppointmentSettingsSchema>;
export type BusinessExceptionType = (typeof BUSINESS_EXCEPTION_TYPES)[number];
export type BusinessExceptionInput = z.infer<typeof businessExceptionSchema>;
export type UpdateBusinessExceptionInput = z.infer<typeof updateBusinessExceptionSchema>;
export type SuperAdminCreateBusinessInput = z.infer<typeof superAdminCreateBusinessSchema>;
export type SuperAdminUpdateBusinessInput = z.infer<typeof superAdminUpdateBusinessSchema>;
export type SuperAdminCreateUserInput = z.infer<typeof superAdminCreateUserSchema>;
export type SuperAdminUpdateUserInput = z.infer<typeof superAdminUpdateUserSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateEmployeeGroupInput = z.infer<typeof createEmployeeGroupSchema>;
export type UpdateEmployeeGroupInput = z.infer<typeof updateEmployeeGroupSchema>;
export type CreateEmployeeBroadcastInput = z.infer<typeof createEmployeeBroadcastSchema>;
export type CreateEmployeeTemplateInput = z.infer<typeof createEmployeeTemplateSchema>;
export type UpdateEmployeeTemplateInput = z.infer<typeof updateEmployeeTemplateSchema>;
export type GenerateEmployeeMessageInput = z.infer<typeof generateEmployeeMessageSchema>;
