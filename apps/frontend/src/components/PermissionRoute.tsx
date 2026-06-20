import { RequirePermission } from '@/components/RequirePermission';
import { LazyRoute } from '@/components/LazyRoute';
import type { Permission } from '@/lib/permissions';

interface PermissionRouteProps {
  permission: Permission;
  children: React.ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  return (
    <RequirePermission permission={permission}>
      <LazyRoute>{children}</LazyRoute>
    </RequirePermission>
  );
}
