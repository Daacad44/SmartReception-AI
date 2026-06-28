export type ConversationHandoffStatus =
  | 'ai_handling'
  | 'human_needed'
  | 'human_handling'
  | 'waiting_for_customer'
  | 'resolved'
  | 'closed'
  | 'escalated'
  | 'transferred'
  | 'open'
  | 'pending';

export const CONVERSATION_STATUS_LABELS: Record<ConversationHandoffStatus, string> = {
  ai_handling: 'AI Handling',
  human_needed: 'Human Needed',
  human_handling: 'Human Handling',
  waiting_for_customer: 'Waiting for Customer',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
  transferred: 'Transferred',
  open: 'Open',
  pending: 'Pending',
};

export const CONVERSATION_STATUS_COLORS: Record<ConversationHandoffStatus, string> = {
  ai_handling: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  human_needed: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  human_handling: 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  waiting_for_customer: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  resolved: 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:text-gray-400',
  closed: 'bg-gray-700/10 text-gray-700 border-gray-700/20 dark:text-gray-300',
  escalated: 'bg-orange-600/10 text-orange-700 border-orange-600/20',
  transferred: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  open: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  pending: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

export const CONVERSATION_STATUS_FILTERS: Array<ConversationHandoffStatus | 'all'> = [
  'all',
  'ai_handling',
  'human_needed',
  'human_handling',
  'waiting_for_customer',
  'resolved',
  'closed',
];

const DB_STATUS_MAP: Record<string, ConversationHandoffStatus> = {
  AI_HANDLING: 'ai_handling',
  HUMAN_NEEDED: 'human_needed',
  HUMAN_HANDLING: 'human_handling',
  WAITING_FOR_CUSTOMER: 'waiting_for_customer',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  ESCALATED: 'escalated',
  TRANSFERRED: 'transferred',
  OPEN: 'ai_handling',
  PENDING: 'human_needed',
};

const API_STATUS_MAP: Record<string, string> = {
  ai_handling: 'AI_HANDLING',
  human_needed: 'HUMAN_NEEDED',
  human_handling: 'HUMAN_HANDLING',
  waiting_for_customer: 'WAITING_FOR_CUSTOMER',
  resolved: 'RESOLVED',
  closed: 'CLOSED',
  escalated: 'ESCALATED',
  transferred: 'TRANSFERRED',
};

export function mapDbConversationStatus(status: string): ConversationHandoffStatus {
  return DB_STATUS_MAP[status] ?? 'ai_handling';
}

export function toApiConversationStatus(filter: string): string | undefined {
  if (!filter || filter === 'all') return undefined;
  return API_STATUS_MAP[filter];
}

export function getStatusLabel(status: string): string {
  const key = status as ConversationHandoffStatus;
  return CONVERSATION_STATUS_LABELS[key] ?? status.replace(/_/g, ' ');
}
