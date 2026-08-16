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
  // Versioned training pipeline (train → sandbox → deployment). These ALWAYS
  // require Super Admin approval regardless of plan — a business may never
  // start AI training immediately.
  AI_TRAIN: 'AI_TRAIN',
  AI_RETRAIN: 'AI_RETRAIN',
  AI_REBUILD_EMBEDDINGS: 'AI_REBUILD_EMBEDDINGS',
  WHATSAPP_CONNECT: 'WHATSAPP_CONNECT',
  WHATSAPP_DISCONNECT: 'WHATSAPP_DISCONNECT',
} as const;

// AI actions that require Super Admin approval for EVERY business regardless of
// plan capability (spec: "Businesses must NEVER immediately start AI Training").
export const ALWAYS_APPROVAL_ACTION_TYPES = [
  'AI_TRAIN',
  'AI_RETRAIN',
  'AI_REBUILD_EMBEDDINGS',
] as const;

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

export const WHATSAPP_CONNECTION_REQUEST_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CONNECTED: 'CONNECTED',
} as const;

export type WhatsAppConnectionRequestStatus =
  (typeof WHATSAPP_CONNECTION_REQUEST_STATUSES)[keyof typeof WHATSAPP_CONNECTION_REQUEST_STATUSES];

// Snapshot of a business's current WhatsApp connection-access request, surfaced
// on the governance capabilities response so the business tab can render its
// request button / status / open-window banner from a single source of truth.
export interface WhatsAppConnectionWindow {
  id: string;
  status: WhatsAppConnectionRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  windowExpiresAt: string | null;
  rejectionReason: string | null;
  connectedAt: string | null;
  // Derived: an APPROVED window that is still open (now < windowExpiresAt) and
  // not yet connected. When true, the full self-serve WhatsApp UI is unlocked.
  windowOpen: boolean;
}

export interface GovernanceCapabilities {
  planCode: string;
  aiTrainingAccess: AiTrainingAccessMode;
  whatsappAccess: WhatsAppAccessMode;
  canRequestAiChanges: boolean;
  canRequestWhatsAppConnect: boolean;
  requiresSuperAdminForAi: boolean;
  // Present when the business is on a plan where WhatsApp is admin-managed
  // ('hidden'): describes their latest connection-access request, if any.
  whatsappConnectionWindow?: WhatsAppConnectionWindow | null;
}

export const GOVERNANCE_ACTIVATION_CODE_LENGTH = 6;
export const GOVERNANCE_ACTIVATION_TTL_MS = 10 * 60 * 1000;
