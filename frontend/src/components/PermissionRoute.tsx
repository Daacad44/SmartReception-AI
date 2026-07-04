import { useLocation } from 'react-router-dom';
import { RequirePermission } from '@/components/RequirePermission';
import { LazyRoute } from '@/components/LazyRoute';
import type { Permission } from '@/lib/permissions';

interface PermissionRouteProps {
  permission: Permission;
  children: React.ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const location = useLocation();

  return (
    <RequirePermission permission={permission}>
      <LazyRoute resetKey={location.pathname}>{children}</LazyRoute>
    </RequirePermission>
  );
}
