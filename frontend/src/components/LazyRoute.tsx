import { Component, type ReactNode, Suspense } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LazyRouteProps {
  children: ReactNode;
  resetKey?: string;
}

interface LazyRouteState {
  hasError: boolean;
  errorMessage?: string;
}

class LazyErrorBoundary extends Component<LazyRouteProps, LazyRouteState> {
  state: LazyRouteState = { hasError: false };

  static getDerivedStateFromError(error: Error): LazyRouteState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page render error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: LazyRouteProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: undefined });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Failed to load this page.</p>
          {import.meta.env.DEV && this.state.errorMessage && (
            <p className="max-w-md text-center text-xs text-destructive">{this.state.errorMessage}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              Try again
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload
            </Button>
          </div>
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

export function LazyRoute({ children, resetKey }: LazyRouteProps) {
  return (
    <LazyErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}
