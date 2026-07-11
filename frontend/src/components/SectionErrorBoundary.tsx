import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionErrorBoundaryProps {
  /** Changing this value clears the error state (e.g. the active section key). */
  resetKey?: string;
  /** Human label for the failing area, shown in the fallback. */
  label?: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

/**
 * Isolates a single workspace section. A render error in one section shows a
 * localized retry card instead of blanking the entire page, so the header and
 * navigation stay usable and other sections keep working.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real error for diagnostics — never silently swallow it.
    console.error(`[AI Workspace] section "${this.props.label ?? 'unknown'}" failed:`, error, info.componentStack);
  }

  componentDidUpdate(prev: SectionErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  private retry = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/70" />
          <div>
            <p className="text-sm font-medium">
              This section could not be displayed{this.props.label ? ` (${this.props.label})` : ''}.
            </p>
            {import.meta.env.DEV && this.state.message && (
              <p className="mt-1 max-w-md text-xs text-destructive">{this.state.message}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={this.retry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
