import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SectionErrorBoundaryProps {
  /** Changing this value clears the error state (e.g. the active section key). */
  resetKey?: string;
  /** Human label for the failing area, shown in the fallback. */
  label?: string;
  /** Compact fallback for chrome (sidebar / top bar) instead of a tall card. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

/**
 * Isolates a widget or section. A render error shows a localized retry card
 * instead of blanking the entire page, so the rest of the shell stays usable.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): SectionErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[Section] "${this.props.label ?? 'unknown'}" failed:`,
      error,
      info.componentStack
    );
  }

  componentDidUpdate(prev: SectionErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  private retry = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2 text-center',
              this.props.className
            )}
          >
            <p className="text-xs text-muted-foreground">Couldn&apos;t load this</p>
            <Button variant="outline" size="sm" onClick={this.retry} className="h-7 gap-1 px-2 text-xs">
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        );
      }

      return (
        <div
          className={cn(
            'flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center',
            this.props.className
          )}
        >
          <AlertTriangle className="h-8 w-8 text-destructive/70" />
          <div>
            <p className="text-sm font-medium">
              Couldn&apos;t load this{this.props.label ? ` (${this.props.label})` : ''}.
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
