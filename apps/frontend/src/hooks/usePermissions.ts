import { useAuthStore } from '@/stores/auth.store';
import { ROLE_PERMISSIONS, type Permission, type Role } from '@/lib/permissions';

export function usePermissions() {
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);

  const currentBusiness = businesses.find((b) => b.id === currentBusinessId) ?? businesses[0];
  const role = (currentBusiness?.role ?? 'VIEWER') as Role;
  const permissions = ROLE_PERMISSIONS[role] ?? [];

  const hasPermission = (permission: Permission) => permissions.includes(permission);
  const hasAnyPermission = (...perms: Permission[]) => perms.some((p) => hasPermission(p));

  return { role, permissions, hasPermission, hasAnyPermission };
}
