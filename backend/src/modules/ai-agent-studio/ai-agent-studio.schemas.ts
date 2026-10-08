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

export const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['RECEPTION', 'SALES', 'SUPPORT', 'BOOKING', 'MIXED']),
  defaultLanguage: z.string().trim().min(2).max(10).default('so'),
  supportedLanguages: z.array(z.string().trim().min(2).max(10)).min(1).max(10).default(['so', 'en']),
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

export const applyAgentDiscoverySchema = z.object({
  expectedRevision: z.number().int().positive(),
  templateId: z.string().trim().min(2).max(80),
  answers: z.object({
    primaryGoal: z.string().trim().min(10).max(1000),
    customerTypes: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
    commonQuestions: z.array(z.string().trim().min(3).max(500)).min(1).max(50),
    prohibitedTopics: z.array(z.string().trim().min(2).max(300)).max(30).default([]),
    handoverRules: z.array(z.string().trim().min(3).max(500)).min(1).max(30),
    tone: z.enum(['PROFESSIONAL', 'FRIENDLY', 'FORMAL', 'CONCISE']),
    languages: z.array(z.string().trim().min(2).max(10)).min(1).max(10),
    operatingNotes: z.string().trim().max(2000).default(''),
  }),
});

export const attachAgentKnowledgeSchema = z.object({
  documentId: z.string().uuid(),
  freshnessDays: z.number().int().min(7).max(730).default(90),
});

export const reviewAgentKnowledgeSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().trim().min(3).max(1000),
  freshnessDays: z.number().int().min(7).max(730).default(90),
});

export const agentAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const updateAgentGovernanceSchema = z.object({
  expectedRevision: z.number().int().positive(),
  minimumConfidence: z.number().min(0).max(1),
  maximumHallucinationRisk: z.number().min(0).max(1),
  requireHumanReleaseApproval: z.boolean(),
  requireSeparateApprover: z.boolean(),
  highRiskActionConfirmation: z.boolean(),
  executionRetentionDays: z.number().int().min(7).max(730),
  evidenceRetentionDays: z.number().int().min(30).max(2555),
});

export const reviewAgentReleaseSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNotes: z.string().trim().min(5).max(2000),
});

export const updateAgentRolloutSchema = z.object({
  enabled: z.boolean(),
  trafficPercentage: z.number().int().min(0).max(100),
  killSwitch: z.boolean(),
  fallbackToLegacy: z.boolean(),
  maxFailureRate: z.number().min(0).max(100),
  maxHandoffRate: z.number().min(0).max(100),
  minConfidence: z.number().min(0).max(100),
  observationWindowMins: z.number().int().min(5).max(1440),
});

export const upsertAgentRoutingRuleSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  priority: z.number().int().min(1).max(10_000).default(100),
  intents: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  keywords: z.array(z.string().trim().min(2).max(100)).max(50).default([]),
  isFallback: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

const workflowNodeSchema = z.object({ id: z.string().trim().min(1).max(80), type: z.enum(['TRIGGER', 'CONDITION', 'AI_RESPONSE', 'ACTION', 'HANDOVER', 'DELAY', 'END']), config: jsonObject.default({}) });
const workflowEdgeSchema = z.object({ id: z.string().trim().min(1).max(80), source: z.string().trim().min(1).max(80), target: z.string().trim().min(1).max(80) });
export const saveWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), triggerType: z.enum(['MESSAGE_RECEIVED', 'INTENT_MATCHED', 'HANDOFF_RESOLVED']).default('MESSAGE_RECEIVED'),
  expectedRevision: z.number().int().positive().optional(), nodes: z.array(workflowNodeSchema).min(2).max(100), edges: z.array(workflowEdgeSchema).max(200), publish: z.boolean().default(false),
});
const simulationScenarioSchema = z.object({ key: z.string().trim().min(2).max(100), input: z.string().trim().min(1).max(4000), mockResponse: z.string().max(8000), forbidden: z.array(z.string().min(1).max(200)).max(30).default([]), required: z.array(z.string().min(1).max(200)).max(30).default([]), critical: z.boolean().default(true) });
export const runSimulationSchema = z.object({ releaseId: z.string().uuid().optional(), suiteType: z.enum(['REGRESSION', 'RED_TEAM', 'CUSTOM']), scenarios: z.array(simulationScenarioSchema).max(200).default([]) }).refine((value) => value.suiteType === 'RED_TEAM' || value.scenarios.length > 0, 'At least one scenario is required');
export const resolveIncidentSchema = z.object({ action: z.enum(['ACKNOWLEDGE', 'RESOLVE']), notes: z.string().trim().max(2000).default('') }).refine((value) => value.action !== 'RESOLVE' || value.notes.length >= 5, 'Resolution notes are required');
export const upsertChannelBindingSchema = z.object({ channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK', 'WEBCHAT']), status: z.enum(['DISCONNECTED', 'CONFIGURED', 'ACTIVE', 'DEGRADED', 'PAUSED']), externalRef: z.string().trim().min(1).max(255).default('default'), configuration: jsonObject.default({}) });

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentDraftInput = z.infer<typeof updateAgentDraftSchema>;
export type CreateAgentReleaseInput = z.infer<typeof createAgentReleaseSchema>;
export type UpsertAgentSkillInput = z.infer<typeof upsertAgentSkillSchema>;
export type ApplyAgentDiscoveryInput = z.infer<typeof applyAgentDiscoverySchema>;
export type AttachAgentKnowledgeInput = z.infer<typeof attachAgentKnowledgeSchema>;
export type ReviewAgentKnowledgeInput = z.infer<typeof reviewAgentKnowledgeSchema>;
export type UpdateAgentGovernanceInput = z.infer<typeof updateAgentGovernanceSchema>;
export type ReviewAgentReleaseInput = z.infer<typeof reviewAgentReleaseSchema>;
export type UpdateAgentRolloutInput = z.infer<typeof updateAgentRolloutSchema>;
export type UpsertAgentRoutingRuleInput = z.infer<typeof upsertAgentRoutingRuleSchema>;
export type SaveWorkflowInput = z.infer<typeof saveWorkflowSchema>;
export type RunSimulationInput = z.infer<typeof runSimulationSchema>;
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;
export type UpsertChannelBindingInput = z.infer<typeof upsertChannelBindingSchema>;
