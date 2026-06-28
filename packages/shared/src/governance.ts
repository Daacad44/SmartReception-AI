export const GOVERNANCE_ACTION_TYPES = {
  AI_UPLOAD_DOCUMENT: 'AI_UPLOAD_DOCUMENT',
  AI_DELETE_DOCUMENT: 'AI_DELETE_DOCUMENT',
  AI_CREATE_FAQ: 'AI_CREATE_FAQ',
  AI_UPDATE_FAQ: 'AI_UPDATE_FAQ',
  AI_DELETE_FAQ: 'AI_DELETE_FAQ',
  AI_CLEAR_KNOWLEDGE: 'AI_CLEAR_KNOWLEDGE',
  AI_UPDATE_PROFILE: 'AI_UPDATE_PROFILE',
  AI_UPLOAD_PROFILE_PDF: 'AI_UPLOAD_PROFILE_PDF',
  AI_DELETE_PROFILE_PDF: 'AI_DELETE_PROFILE_PDF',
  AI_CLEAR_PROFILE: 'AI_CLEAR_PROFILE',
  AI_REINDEX: 'AI_REINDEX',
  AI_RESET_MEMORY: 'AI_RESET_MEMORY',
  AI_DELETE_EMBEDDINGS: 'AI_DELETE_EMBEDDINGS',
  WHATSAPP_CONNECT: 'WHATSAPP_CONNECT',
  WHATSAPP_DISCONNECT: 'WHATSAPP_DISCONNECT',
} as const;

export type GovernanceActionType =
  (typeof GOVERNANCE_ACTION_TYPES)[keyof typeof GOVERNANCE_ACTION_TYPES];

export const GOVERNANCE_APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ACTIVATED: 'ACTIVATED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type GovernanceApprovalStatus =
  (typeof GOVERNANCE_APPROVAL_STATUSES)[keyof typeof GOVERNANCE_APPROVAL_STATUSES];

export type AiTrainingAccessMode = 'readonly' | 'approval_required' | 'full';

export type WhatsAppAccessMode = 'hidden' | 'approval_required' | 'full';

export interface GovernanceCapabilities {
  planCode: string;
  aiTrainingAccess: AiTrainingAccessMode;
  whatsappAccess: WhatsAppAccessMode;
  canRequestAiChanges: boolean;
  canRequestWhatsAppConnect: boolean;
  requiresSuperAdminForAi: boolean;
}

export const GOVERNANCE_ACTIVATION_CODE_LENGTH = 6;
export const GOVERNANCE_ACTIVATION_TTL_MS = 10 * 60 * 1000;
