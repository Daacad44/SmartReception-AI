import { User, Calendar, BookOpen, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuditLogs } from '@/hooks/useApi';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/utils';

const actionColors: Record<string, string> = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-primary/10 text-primary',
  DELETE: 'bg-danger/10 text-danger',
  LOGIN: 'bg-accent/10 text-accent',
  LOGOUT: 'bg-muted text-muted-foreground',
};

export function AuditLogsPage() {
  const { data: logs, isLoading } = useAuditLogs();

  if (isLoading) return <LoadingState rows={5} />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Track login, appointments, settings, and team activity.</p>
      </div>

      {!logs?.length ? (
        <EmptyState title="No audit entries" description="Activity will appear here as your team uses the platform." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/10">
                      {log.entity === 'Appointment' ? (
                        <Calendar className="h-4 w-4 text-navy" />
                      ) : log.entity === 'User' ? (
                        <User className="h-4 w-4 text-navy" />
                      ) : log.entity === 'KnowledgeDocument' ? (
                        <BookOpen className="h-4 w-4 text-navy" />
                      ) : (
                        <Settings className="h-4 w-4 text-navy" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.action} — {log.entity}
                        {log.entityId && <span className="text-muted-foreground font-normal"> #{log.entityId.slice(0, 8)}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</p>
                    </div>
                  </div>
                  <Badge className={`shrink-0 ${actionColors[log.action] ?? 'bg-muted'}`}>{log.action}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
