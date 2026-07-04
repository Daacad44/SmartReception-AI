export interface WorkflowStage {
  id: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isEnabled: boolean;
  isTerminal: boolean;
  requiresApproval: boolean;
  positionX: number;
  positionY: number;
  defaultActions?: Array<{ type: string; config?: Record<string, unknown> }>;
}

export interface WorkflowTransition {
  id: string;
  fromStageId: string;
  toStageId: string;
  triggerEvent: string;
  isActive: boolean;
  fromStage?: WorkflowStage;
  toStage?: WorkflowStage;
}

export interface WorkflowRule {
  id: string;
  name: string;
  triggerEvent: string;
  conditions: unknown;
  actions: unknown;
  priority: number;
  isActive: boolean;
}

export interface AppointmentWorkflow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  templateKey?: string | null;
  stages: WorkflowStage[];
  transitions?: WorkflowTransition[];
  rules?: WorkflowRule[];
}

export interface WorkflowTemplate {
  id: string;
  key: string;
  industry: string;
  name: string;
  description: string;
}

export interface ReminderConfig {
  id: string;
  label: string;
  offsetMinutes: number;
  channels: string[];
  template?: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

export interface AppointmentAnalyticsSnapshot {
  appointmentsCreated: number;
  appointmentsConfirmed: number;
  appointmentsCancelled: number;
  appointmentsCompleted: number;
  appointmentsRescheduled: number;
  noShows: number;
  avgDurationMinutes: number;
  reminderSuccessRate: number;
  notificationSuccessRate: number;
  emailDeliveryRate: number;
  whatsappDeliveryRate: number;
  attendanceRate: number;
  completionRate: number;
  workflowSuccessRate: number;
  automationSuccessRate: number;
  revenueGenerated: number;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  actorType: string;
  channel?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
