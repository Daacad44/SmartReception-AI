import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorState } from '@/components/ErrorState';
import { resolveLandingRoute, type Permission } from '@/lib/permissions';

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: string;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const location = useLocation();
  const { hasPermission } = usePermissions();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  const target = fallback ?? resolveLandingRoute(hasPermission);

  // Redirecting to the page we are already on — or to another page this role
  // cannot open either — renders an empty screen forever, so say no instead.
  if (!target || target === location.pathname) {
    return (
      <ErrorState
        title="You don't have access to this page"
        message="Ask a workspace owner or admin to grant you permission."
      />
    );
  }

  return <Navigate to={target} replace />;
}
