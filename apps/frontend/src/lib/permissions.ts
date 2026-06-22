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
  'audit:read': 'audit:read',
  'platform:admin': 'platform:admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER' | 'RECEPTIONIST' | 'STAFF';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS['platform:admin']),
  ADMIN: Object.values(PERMISSIONS).filter(
    (p) => !p.startsWith('billing:write') && p !== PERMISSIONS['platform:admin']
  ),
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
    PERMISSIONS['audit:read'],
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
  RECEPTIONIST: [
    PERMISSIONS['customers:read'],
    PERMISSIONS['customers:write'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['conversations:write'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['appointments:write'],
    PERMISSIONS['knowledge:read'],
    PERMISSIONS['analytics:read'],
  ],
  STAFF: [
    PERMISSIONS['customers:read'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['knowledge:read'],
  ],
  VIEWER: [
    PERMISSIONS['customers:read'],
    PERMISSIONS['conversations:read'],
    PERMISSIONS['appointments:read'],
    PERMISSIONS['analytics:read'],
  ],
};

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': PERMISSIONS['analytics:read'],
  '/conversations': PERMISSIONS['conversations:read'],
  '/customers': PERMISSIONS['customers:read'],
  '/appointments': PERMISSIONS['appointments:read'],
  '/knowledge': PERMISSIONS['knowledge:read'],
  '/analytics': PERMISSIONS['analytics:read'],
  '/team': PERMISSIONS['team:read'],
  '/settings': PERMISSIONS['settings:read'],
  '/billing': PERMISSIONS['billing:read'],
  '/notifications': PERMISSIONS['conversations:read'],
  '/audit-logs': PERMISSIONS['audit:read'],
  '/super-admin': PERMISSIONS['platform:admin'],
};
