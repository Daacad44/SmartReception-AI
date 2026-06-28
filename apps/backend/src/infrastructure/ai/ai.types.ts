export interface AIResponse {
  content: string;
  intent: string;
  actions: AIAction[];
  confidence: number;
  language?: 'so' | 'en' | 'mixed';
}

export interface AIAction {
  type: 'book_appointment' | 'qualify_lead' | 'collect_lead' | 'escalate' | 'request_feedback' | 'none';
  data?: Record<string, unknown>;
}

export interface LeadData {
  fullName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  service?: string;
  complete?: boolean;
}
