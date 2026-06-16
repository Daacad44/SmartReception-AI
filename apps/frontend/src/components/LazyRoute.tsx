import { Component, type ReactNode, Suspense } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LazyRouteProps {
  children: ReactNode;
}

interface LazyRouteState {
  hasError: boolean;
}

class LazyErrorBoundary extends Component<LazyRouteProps, LazyRouteState> {
  state: LazyRouteState = { hasError: false };

  static getDerivedStateFromError(): LazyRouteState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Failed to load this page.</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading page" />
    </div>
  );
}

export function LazyRoute({ children }: LazyRouteProps) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}
