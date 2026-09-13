import { useAuthStore } from '@/stores/auth.store';
import { ROLE_PERMISSIONS, type Permission, type Role, PERMISSIONS } from '@/lib/permissions';

export function usePermissions() {
  const businesses = useAuthStore((s) => s.businesses);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const currentBusiness = businesses.find((b) => b.id === currentBusinessId) ?? businesses[0];
  const role = (isSuperAdmin ? 'SUPER_ADMIN' : (currentBusiness?.role ?? 'VIEWER')) as Role;
  let permissions = isSuperAdmin
    ? (Object.values(PERMISSIONS) as Permission[])
    : [...(ROLE_PERMISSIONS[role] ?? [])];

  const hasPermission = (permission: Permission) =>
    isSuperAdmin || permissions.includes(permission);
  const hasAnyPermission = (...perms: Permission[]) =>
    isSuperAdmin || perms.some((p) => hasPermission(p));

  return { role, permissions, hasPermission, hasAnyPermission, isSuperAdmin };
}
