import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '@/lib/types';

export interface GovernanceApprovalRequest {
  id: string;
  businessId: string;
  businessName?: string;
  actionType: string;
  actionLabel: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVATED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  approvedAt?: string | null;
  activationCodeExpiresAt?: string | null;
  executedAt?: string | null;
  rejectionReason?: string | null;
}

export type WhatsAppConnectionRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONNECTED';

export interface WhatsAppConnectionWindow {
  id: string;
  status: WhatsAppConnectionRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  windowExpiresAt: string | null;
  rejectionReason: string | null;
  connectedAt: string | null;
  windowOpen: boolean;
}

export interface GovernanceCapabilities {
  planCode: string;
  aiTrainingAccess: 'readonly' | 'approval_required' | 'full';
  whatsappAccess: 'hidden' | 'approval_required' | 'full';
  canRequestAiChanges: boolean;
  canRequestWhatsAppConnect: boolean;
  requiresSuperAdminForAi: boolean;
  whatsappConnectionWindow?: WhatsAppConnectionWindow | null;
}

// Admin queue row (super-admin listing).
export interface WhatsAppConnectionRequestAdmin extends WhatsAppConnectionWindow {
  businessId: string;
  businessName?: string;
  requester?: { firstName: string; lastName: string; email: string };
  approver?: { firstName: string; lastName: string; email: string } | null;
}

export type MutationResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'approval'; request: GovernanceApprovalRequest };

export function parseMutationResponse<T>(
  response: AxiosResponse<ApiResponse<T> & { approvalRequired?: boolean }>
): MutationResult<T> {
  const body = response.data;
  if (body.approvalRequired && body.data) {
    return {
      kind: 'approval',
      request: body.data as unknown as GovernanceApprovalRequest,
    };
  }
  if (!body.success || body.data === undefined) {
    throw new Error(body.error || body.message || 'Request failed');
  }
  return { kind: 'success', data: body.data };
}
