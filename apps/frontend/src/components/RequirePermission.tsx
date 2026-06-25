import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/permissions';

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: string;
}

export function RequirePermission({
  permission,
  children,
  fallback = '/dashboard',
}: RequirePermissionProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
