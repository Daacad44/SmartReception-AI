import { Bell, CheckCheck, Calendar, MessageSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications, useMarkAllNotificationsRead } from '@/hooks/useApi';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/lib/entities';

const typeIcons: Record<string, typeof Bell> = {
  info: MessageSquare,
  success: Calendar,
  warning: AlertTriangle,
  error: AlertTriangle,
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const handleClick = (notif: Notification) => {
    const data = notif.data as Record<string, string> | null | undefined;
    if (data?.conversationId) navigate(`/conversations?conversation=${data.conversationId}`);
    else if (data?.appointmentId) navigate(`/appointments?id=${data.appointmentId}`);
    else if (data?.customerId) navigate('/customers');
    else if (notif.title.toLowerCase().includes('billing')) navigate('/billing');
  };

  if (isLoading) return <LoadingState rows={5} />;

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification Center</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread notifications` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} className="shrink-0">
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {!notifications?.length ? (
        <EmptyState
          title="No notifications"
          description="You'll see appointment updates, messages, and system alerts here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] ?? Bell;
            return (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notif.read ? 'border-accent/40 bg-accent/5' : ''}`}
                onClick={() => handleClick(notif)}
              >
                <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4 pb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/10">
                    <Icon className="h-4 w-4 text-navy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold">{notif.title}</CardTitle>
                      {!notif.read && <Badge variant="accent" className="shrink-0 text-[10px]">New</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notif.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
