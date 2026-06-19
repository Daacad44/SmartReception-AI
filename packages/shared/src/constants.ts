export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  AGENT: 'AGENT',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  'business:read': 'business:read',
  'business:write': 'business:write',
  'team:read': 'team:read',
  'team:write': 'team:write',
  'customers:read': 'customers:read',
  'customers:write': 'customers:write',
  'conversations:read': 'conversations:read',
  'conversations:write': 'conversations:write',
  'appointments:read': 'appointments:read',
  'appointments:write': 'appointments:write',
  'knowledge:read': 'knowledge:read',
  'knowledge:write': 'knowledge:write',
  'analytics:read': 'analytics:read',
  'billing:read': 'billing:read',
  'billing:write': 'billing:write',
  'settings:read': 'settings:read',
  'settings:write': 'settings:write',
  'ai:configure': 'ai:configure',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS).filter((p) => !p.startsWith('billing:write')),
  MANAGER: [
    PERMISSIONS['business:read'],
    PERMISSIONS['team:read'],
    PERMISSIONS['customers:read'],
    PERMISSIONS['customers:write'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['conversations:write'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['appointments:write'],
    PERMISSIONS['knowledge:read'],
    PERMISSIONS['knowledge:write'],
    PERMISSIONS['analytics:read'],
    PERMISSIONS['settings:read'],
  ],
  AGENT: [
    PERMISSIONS['customers:read'],
    PERMISSIONS['customers:write'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['conversations:write'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['appointments:write'],
    PERMISSIONS['knowledge:read'],
  ],
  VIEWER: [
    PERMISSIONS['customers:read'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['analytics:read'],
  ],
};

export const SUBSCRIPTION_PLANS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  BUSINESS: 'BUSINESS',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export const INDUSTRIES = [
  'CLINIC',
  'HOSPITAL',
  'HOTEL',
  'RESTAURANT',
  'SALON',
  'UNIVERSITY',
  'TRAVEL_AGENCY',
  'REAL_ESTATE',
  'CONSULTING',
  'SERVICE_BUSINESS',
  'OTHER',
] as const;
