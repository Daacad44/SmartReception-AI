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
