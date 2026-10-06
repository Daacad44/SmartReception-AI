import { z } from 'zod';

const jsonObject = z.record(z.unknown());

export const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  type: z.enum(['RECEPTION', 'SALES', 'SUPPORT', 'BOOKING', 'MIXED']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  supportedLanguages: z.array(z.string().trim().min(2).max(10)).min(1).max(10).optional(),
});

export const updateAgentDraftSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  instructions: jsonObject.optional(),
  behaviorConfig: jsonObject.optional(),
  knowledgeConfig: jsonObject.optional(),
  escalationPolicy: jsonObject.optional(),
  modelConfig: jsonObject.optional(),
}).refine((value) => Object.keys(value).some((key) => key !== 'expectedRevision'), 'At least one draft section is required');

export const createAgentReleaseSchema = z.object({
  changeSummary: z.string().trim().min(3).max(1000),
});

export const upsertAgentSkillSchema = z.object({
  enabled: z.boolean(),
  riskLevel: z.enum(['READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  requiresConfirmation: z.boolean().default(false),
  configuration: jsonObject.default({}),
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type UpdateAgentDraftInput = z.infer<typeof updateAgentDraftSchema>;
export type CreateAgentReleaseInput = z.infer<typeof createAgentReleaseSchema>;
export type UpsertAgentSkillInput = z.infer<typeof upsertAgentSkillSchema>;
