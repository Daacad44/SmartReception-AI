export const isAgentStudioV2Enabled =
  String(import.meta.env.VITE_AGENT_STUDIO_V2_ENABLED).toLowerCase() === 'true';

export interface AgentStudioDraft {
  id: string;
  revision: number;
  instructions: Record<string, unknown>;
  behaviorConfig: Record<string, unknown>;
  knowledgeConfig: Record<string, unknown>;
  escalationPolicy: Record<string, unknown>;
  modelConfig: Record<string, unknown>;
  updatedAt: string;
}

export type AgentSkillRisk = 'READ_ONLY' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AgentStudioSkill {
  id: string;
  skillKey: string;
  enabled: boolean;
  riskLevel: AgentSkillRisk;
  requiresConfirmation: boolean;
  configuration: Record<string, unknown>;
}

export interface AgentStudioRelease {
  id: string;
  releaseNumber: number;
  status: string;
  changeSummary?: string | null;
  createdAt: string;
  activatedAt?: string | null;
}

export interface AgentStudioAgent {
  id: string;
  name: string;
  slug: string;
  type: 'RECEPTION' | 'SALES' | 'SUPPORT' | 'BOOKING' | 'MIXED';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  description?: string | null;
  channel: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  draft?: AgentStudioDraft | null;
  activeRelease?: AgentStudioRelease | null;
  releases: AgentStudioRelease[];
  skills: AgentStudioSkill[];
  _count?: { releases: number; executions: number };
}

export interface AgentDiscoveryTemplate {
  id: string;
  name: string;
  industries: string[];
  agentType: AgentStudioAgent['type'];
  role: string;
  objectives: string[];
  boundaries: string[];
  suggestedSkills: string[];
  requiredFacts: string[];
}

export interface AgentDiscoveryReadiness {
  recommendedTemplateId: string;
  business: { name: string; industry: string; businessType?: string | null };
  documentCount: number;
  checks: Array<{ key: string; label: string; complete: boolean }>;
  readinessPercent: number;
}

export interface AgentStudioAnalytics {
  period: { days: number; from: string; to: string };
  runtime: { executions: number; completed: number; handedOver: number; failed: number; containmentRate: number; handoffRate: number; failureRate: number; averageConfidence: number; averageLatencyMs: number; tokensUsed: number; estimatedCost: number };
  actions: { total: number; completed: number; awaitingConfirmation: number; cancelled: number; failed: number; expired: number; conversionRate: number; byType: Record<string, number> };
  handoffs: { total: number; open: number; acknowledged: number; resolved: number; urgent: number; slaBreached: number; slaComplianceRate: number; averageAcknowledgeSeconds: number };
  quality: { evaluationRuns: number; passRate: number; averageScore: number; criticalFailures: number };
  knowledge: { total: number; approved: number; pending: number; stale: number };
  timeline: Array<{ date: string; executions: number; completed: number; handedOver: number; failed: number; actions: number }>;
}

export interface AgentGovernancePolicy {
  revision: number;
  minimumConfidence: number;
  maximumHallucinationRisk: number;
  requireHumanReleaseApproval: boolean;
  requireSeparateApprover: boolean;
  highRiskActionConfirmation: boolean;
  executionRetentionDays: number;
  evidenceRetentionDays: number;
}

export interface AgentRolloutConfig {
  enabled: boolean;
  trafficPercentage: number;
  killSwitch: boolean;
  fallbackToLegacy: boolean;
  maxFailureRate: number;
  maxHandoffRate: number;
  minConfidence: number;
  observationWindowMins: number;
  health: { sampleSize: number; failureRate: number; handoffRate: number; averageConfidence: number; healthy: boolean; alerts: string[] };
}

export interface AgentRoutingRule {
  id: string;
  agentId: string;
  name: string;
  priority: number;
  intents: string[];
  keywords: string[];
  isFallback: boolean;
  enabled: boolean;
  agent: { id: string; name: string; status: string; activeReleaseId?: string | null };
}

export interface AgentWorkflow { id: string; name: string; description?: string; status: string; revision: number; nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>; edges: Array<{ id: string; source: string; target: string }>; validation?: { valid: boolean; errors: string[] }; updatedAt: string }
export interface AgentSimulationRun { id: string; suiteType: string; status: string; score?: number; criticalFailures: number; startedAt: string }
export interface AgentIncident { id: string; status: string; severity: string; type: string; summary: string; createdAt: string }
export interface AgentChannelBinding { id: string; channel: string; status: string; capabilities: Record<string, boolean>; lastHealthAt?: string }
