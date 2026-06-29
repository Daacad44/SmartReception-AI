import type { WorkflowTemplateDefinition } from './types';

export const DEFAULT_WORKFLOW_STAGES = [
  { key: 'DRAFT', label: 'Draft', sortOrder: 0, color: '#6B7280' },
  { key: 'PENDING_REVIEW', label: 'Pending Review', sortOrder: 1, requiresApproval: true, color: '#F59E0B' },
  { key: 'PENDING_CONFIRMATION', label: 'Pending Confirmation', sortOrder: 2, color: '#3B82F6' },
  { key: 'CONFIRMED', label: 'Confirmed', sortOrder: 3, color: '#10B981' },
  { key: 'REMINDER_SCHEDULED', label: 'Reminder Scheduled', sortOrder: 4, color: '#8B5CF6' },
  { key: 'REMINDER_SENT', label: 'Reminder Sent', sortOrder: 5, color: '#6366F1' },
  { key: 'CUSTOMER_ARRIVED', label: 'Customer Arrived', sortOrder: 6, color: '#14B8A6' },
  { key: 'CHECKED_IN', label: 'Checked In', sortOrder: 7, color: '#0EA5E9' },
  { key: 'IN_PROGRESS', label: 'In Progress', sortOrder: 8, color: '#D97706' },
  { key: 'COMPLETED', label: 'Completed', sortOrder: 9, color: '#22C55E' },
  { key: 'FOLLOW_UP_SCHEDULED', label: 'Follow-up Scheduled', sortOrder: 10, color: '#A855F7' },
  { key: 'FEEDBACK_REQUESTED', label: 'Feedback Requested', sortOrder: 11, color: '#EC4899' },
  { key: 'CLOSED', label: 'Closed', sortOrder: 12, isTerminal: true, color: '#374151' },
  { key: 'CANCELLED', label: 'Cancelled', sortOrder: 13, isTerminal: true, color: '#EF4444' },
  { key: 'REJECTED', label: 'Rejected', sortOrder: 14, isTerminal: true, color: '#DC2626' },
  { key: 'EXPIRED', label: 'Expired', sortOrder: 15, isTerminal: true, color: '#9CA3AF' },
  { key: 'NO_SHOW', label: 'No Show', sortOrder: 16, isTerminal: true, color: '#F97316' },
  { key: 'RESCHEDULED', label: 'Rescheduled', sortOrder: 17, color: '#2563EB' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting Payment', sortOrder: 18, color: '#CA8A04' },
  { key: 'PAID', label: 'Paid', sortOrder: 19, color: '#16A34A' },
  { key: 'REFUNDED', label: 'Refunded', sortOrder: 20, isTerminal: true, color: '#78716C' },
] as const;

const DEFAULT_REMINDER_OFFSETS = [
  { label: '7 Days Before', offsetMinutes: -7 * 24 * 60 },
  { label: '3 Days Before', offsetMinutes: -3 * 24 * 60 },
  { label: '24 Hours Before', offsetMinutes: -24 * 60 },
  { label: '12 Hours Before', offsetMinutes: -12 * 60 },
  { label: '6 Hours Before', offsetMinutes: -6 * 60 },
  { label: '2 Hours Before', offsetMinutes: -2 * 60 },
  { label: '1 Hour Before', offsetMinutes: -60 },
  { label: '30 Minutes Before', offsetMinutes: -30 },
  { label: '15 Minutes Before', offsetMinutes: -15 },
];

function buildDefaultDefinition(name: string, description: string): WorkflowTemplateDefinition {
  const stages = DEFAULT_WORKFLOW_STAGES.map((s, i) => ({
    ...s,
    positionX: (i % 4) * 220,
    positionY: Math.floor(i / 4) * 120,
    defaultActions:
      s.key === 'CONFIRMED'
        ? [
            { type: 'SEND_WHATSAPP', config: { template: 'confirmation' } },
            { type: 'SEND_EMAIL', config: { template: 'confirmation' } },
            { type: 'SCHEDULE_REMINDER' },
            { type: 'UPDATE_CRM' },
            { type: 'UPDATE_ANALYTICS' },
          ]
        : s.key === 'COMPLETED'
          ? [
              { type: 'SEND_WHATSAPP', config: { template: 'thank_you' } },
              { type: 'SEND_EMAIL', config: { template: 'receipt' } },
              { type: 'REQUEST_FEEDBACK' },
              { type: 'TRIGGER_MARKETING' },
            ]
          : s.key === 'CANCELLED'
            ? [
                { type: 'SEND_WHATSAPP', config: { template: 'cancelled' } },
                { type: 'RELEASE_TIME_SLOT' },
                { type: 'NOTIFY_EMPLOYEE' },
                { type: 'UPDATE_ANALYTICS' },
              ]
            : undefined,
  }));

  return {
    name,
    description,
    stages,
    transitions: [
      { fromKey: 'DRAFT', toKey: 'PENDING_REVIEW', triggerEvent: 'APPOINTMENT_CREATED' },
      { fromKey: 'PENDING_REVIEW', toKey: 'PENDING_CONFIRMATION', triggerEvent: 'APPOINTMENT_CREATED' },
      { fromKey: 'PENDING_CONFIRMATION', toKey: 'CONFIRMED', triggerEvent: 'APPOINTMENT_CONFIRMED' },
      { fromKey: 'CONFIRMED', toKey: 'REMINDER_SCHEDULED', triggerEvent: 'REMINDER_SCHEDULED' },
      { fromKey: 'REMINDER_SCHEDULED', toKey: 'REMINDER_SENT', triggerEvent: 'REMINDER_SENT' },
      { fromKey: 'REMINDER_SENT', toKey: 'CUSTOMER_ARRIVED', triggerEvent: 'CUSTOMER_ARRIVED' },
      { fromKey: 'CUSTOMER_ARRIVED', toKey: 'CHECKED_IN', triggerEvent: 'CUSTOMER_CHECKED_IN' },
      { fromKey: 'CHECKED_IN', toKey: 'IN_PROGRESS', triggerEvent: 'APPOINTMENT_STARTED' },
      { fromKey: 'IN_PROGRESS', toKey: 'COMPLETED', triggerEvent: 'APPOINTMENT_COMPLETED' },
      { fromKey: 'COMPLETED', toKey: 'FOLLOW_UP_SCHEDULED', triggerEvent: 'FOLLOW_UP_SCHEDULED' },
      { fromKey: 'FOLLOW_UP_SCHEDULED', toKey: 'FEEDBACK_REQUESTED', triggerEvent: 'FEEDBACK_REQUESTED' },
      { fromKey: 'FEEDBACK_REQUESTED', toKey: 'CLOSED', triggerEvent: 'FEEDBACK_RECEIVED' },
      { fromKey: 'PENDING_REVIEW', toKey: 'REJECTED', triggerEvent: 'APPOINTMENT_REJECTED' },
      { fromKey: 'CONFIRMED', toKey: 'CANCELLED', triggerEvent: 'APPOINTMENT_CANCELLED' },
      { fromKey: 'CONFIRMED', toKey: 'RESCHEDULED', triggerEvent: 'APPOINTMENT_RESCHEDULED' },
      { fromKey: 'RESCHEDULED', toKey: 'CONFIRMED', triggerEvent: 'APPOINTMENT_CONFIRMED' },
      { fromKey: 'CONFIRMED', toKey: 'NO_SHOW', triggerEvent: 'APPOINTMENT_NO_SHOW' },
      { fromKey: 'CONFIRMED', toKey: 'AWAITING_PAYMENT', triggerEvent: 'PAYMENT_AWAITING' },
      { fromKey: 'AWAITING_PAYMENT', toKey: 'PAID', triggerEvent: 'PAYMENT_RECEIVED' },
      { fromKey: 'PAID', toKey: 'REFUNDED', triggerEvent: 'PAYMENT_REFUNDED' },
    ],
    rules: [
      {
        name: 'New consultation — assign senior staff',
        triggerEvent: 'APPOINTMENT_CREATED',
        conditions: [
          { field: 'serviceCategory', op: 'eq', value: 'Consultation' },
          { field: 'customerType', op: 'eq', value: 'NEW' },
        ],
        actions: [
          { type: 'ASSIGN_EMPLOYEE', config: { seniority: 'senior' } },
          { type: 'SEND_EMAIL', config: { template: 'welcome' } },
          { type: 'SCHEDULE_REMINDER' },
        ],
        priority: 10,
      },
      {
        name: 'High satisfaction — request review',
        triggerEvent: 'APPOINTMENT_COMPLETED',
        conditions: [{ field: 'customerSatisfaction', op: 'gt', value: 4 }],
        actions: [
          { type: 'SEND_WHATSAPP', config: { template: 'google_review' } },
          { type: 'TRIGGER_MARKETING', config: { campaign: 'loyalty_discount' } },
        ],
        priority: 5,
      },
    ],
    reminderOffsets: DEFAULT_REMINDER_OFFSETS,
  };
}

export const ENTERPRISE_WORKFLOW_TEMPLATES: Array<{
  key: string;
  industry: string;
  name: string;
  description: string;
  definition: WorkflowTemplateDefinition;
}> = [
  {
    key: 'default',
    industry: 'general',
    name: 'Enterprise Default',
    description: 'Full lifecycle workflow with confirmations, reminders, and follow-up.',
    definition: buildDefaultDefinition('Enterprise Default', 'Full lifecycle workflow'),
  },
  {
    key: 'healthcare',
    industry: 'healthcare',
    name: 'Healthcare / Clinic',
    description: 'Patient intake, check-in, and follow-up care workflow.',
    definition: buildDefaultDefinition('Healthcare Clinic', 'Patient appointment lifecycle'),
  },
  {
    key: 'dental',
    industry: 'healthcare',
    name: 'Dental Practice',
    description: 'Dental appointment workflow with pre-visit reminders.',
    definition: buildDefaultDefinition('Dental Practice', 'Dental appointment lifecycle'),
  },
  {
    key: 'salon',
    industry: 'beauty',
    name: 'Salon & Spa',
    description: 'Beauty service booking with upsell and loyalty follow-up.',
    definition: buildDefaultDefinition('Salon & Spa', 'Beauty service lifecycle'),
  },
  {
    key: 'legal',
    industry: 'professional',
    name: 'Legal Office',
    description: 'Consultation scheduling with document prep reminders.',
    definition: buildDefaultDefinition('Legal Office', 'Legal consultation lifecycle'),
  },
  {
    key: 'accounting',
    industry: 'professional',
    name: 'Accounting Firm',
    description: 'Tax and advisory appointment workflow.',
    definition: buildDefaultDefinition('Accounting Firm', 'Advisory appointment lifecycle'),
  },
  {
    key: 'education',
    industry: 'education',
    name: 'Education / University',
    description: 'Student advising and enrollment appointments.',
    definition: buildDefaultDefinition('Education', 'Student appointment lifecycle'),
  },
  {
    key: 'consulting',
    industry: 'professional',
    name: 'Consulting',
    description: 'Client discovery and strategy session workflow.',
    definition: buildDefaultDefinition('Consulting', 'Client session lifecycle'),
  },
  {
    key: 'real_estate',
    industry: 'real_estate',
    name: 'Real Estate',
    description: 'Property viewing and closing appointment workflow.',
    definition: buildDefaultDefinition('Real Estate', 'Property viewing lifecycle'),
  },
  {
    key: 'automotive',
    industry: 'automotive',
    name: 'Automotive Service',
    description: 'Vehicle service and test drive appointments.',
    definition: buildDefaultDefinition('Automotive', 'Service appointment lifecycle'),
  },
  {
    key: 'government',
    industry: 'government',
    name: 'Government Services',
    description: 'Citizen service appointment with compliance steps.',
    definition: buildDefaultDefinition('Government', 'Citizen service lifecycle'),
  },
];

export const DEFAULT_REMINDER_SCHEDULE = DEFAULT_REMINDER_OFFSETS;
