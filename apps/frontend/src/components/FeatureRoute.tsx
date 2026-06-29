import { Navigate } from 'react-router-dom';
import { usePlatformFeatures } from '@/hooks/usePlatformFeatures';
import { LoadingState } from '@/components/LoadingState';

interface FeatureRouteProps {
  featureKey: string;
  children: React.ReactNode;
  fallbackTo?: string;
}

export function FeatureRoute({ featureKey, children, fallbackTo = '/dashboard' }: FeatureRouteProps) {
  const { isFeatureEnabled, isLoading } = usePlatformFeatures();

  if (isLoading) {
    return <LoadingState rows={3} />;
  }

  if (!isFeatureEnabled(featureKey)) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}
