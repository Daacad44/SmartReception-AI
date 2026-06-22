/** Active sales consultant conversation state (persisted in message metadata). */

export type SalesFlowPhase =
  | 'intro'
  | 'website_type'
  | 'questions'
  | 'portfolio'
  | 'appointment_offer'
  | 'appointment_collect'
  | 'completed';

export interface SalesFlowState {
  serviceOption: number;
  serviceName: string;
  phase: SalesFlowPhase;
  questionIndex: number;
  questionKeys: string[];
  answers: Record<string, string>;
  websiteType?: string;
  customSystemType?: string;
  startedAt: string;
}

export interface SalesFlowContext {
  businessId: string;
  conversationId: string;
  customerId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
}

export interface SalesFlowResult {
  handled: boolean;
  reply?: string;
  nextState?: SalesFlowState | null;
  metadata?: Record<string, unknown>;
}
