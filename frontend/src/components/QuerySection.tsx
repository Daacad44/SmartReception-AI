import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

interface ChartEmptyStateProps {
  message?: string;
  className?: string;
}

export function ChartEmptyState({
  message = 'No data available yet',
  className = 'h-[240px]',
}: ChartEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-center ${className}`}
    >
      <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

interface QuerySectionProps {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  skeleton: ReactNode;
  children: ReactNode;
  onRetry?: () => void;
}

export function QuerySection({
  isLoading,
  isError,
  errorMessage = 'Failed to load data',
  isEmpty = false,
  emptyMessage,
  skeleton,
  children,
  onRetry,
}: QuerySectionProps) {
  if (isLoading) return <>{skeleton}</>;
  if (isError) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 text-center">
        <p className="text-sm text-destructive">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-accent hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return <ChartEmptyState message={emptyMessage} className="h-[240px]" />;
  }
  return <>{children}</>;
}
