import type { AppointmentWorkflowEventType } from '@prisma/client';

export interface WorkflowCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: string | number | boolean | string[];
}

export interface WorkflowAction {
  type: string;
  config?: Record<string, unknown>;
}

export interface WorkflowStageDefinition {
  key: string;
  label: string;
  color?: string;
  sortOrder: number;
  isEnabled?: boolean;
  isTerminal?: boolean;
  requiresApproval?: boolean;
  positionX?: number;
  positionY?: number;
  defaultActions?: WorkflowAction[];
}

export interface WorkflowTransitionDefinition {
  fromKey: string;
  toKey: string;
  triggerEvent: AppointmentWorkflowEventType;
  conditions?: WorkflowCondition[];
}

export interface WorkflowRuleDefinition {
  name: string;
  triggerEvent: AppointmentWorkflowEventType;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  priority?: number;
}

export interface WorkflowTemplateDefinition {
  name: string;
  description: string;
  stages: WorkflowStageDefinition[];
  transitions: WorkflowTransitionDefinition[];
  rules: WorkflowRuleDefinition[];
  reminderOffsets?: Array<{ label: string; offsetMinutes: number }>;
}

export interface WorkflowEventContext {
  businessId: string;
  appointmentId: string;
  triggerEvent: AppointmentWorkflowEventType;
  operatorId?: string;
  ipAddress?: string;
  device?: string;
  metadata?: Record<string, unknown>;
}

export interface AppointmentContactRecipient {
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
  value: string;
  label: string;
}

export interface AppointmentTemplateVariables {
  businessName: string;
  customerName: string;
  appointmentDate: string;
  appointmentTime: string;
  assignedEmployee: string;
  service: string;
  bookingNumber: string;
  location: string;
  rescheduleLink: string;
  cancelLink: string;
  googleCalendarLink: string;
  outlookCalendarLink: string;
  appleCalendarLink: string;
}
