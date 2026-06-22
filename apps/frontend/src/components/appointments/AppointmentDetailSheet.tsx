import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingState } from '@/components/LoadingState';
import api, { extractData } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface AppointmentDetailProps {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

export function AppointmentDetailSheet({ appointmentId, open, onClose, onAction }: AppointmentDetailProps) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId, 'detail'],
    enabled: Boolean(appointmentId && open),
    queryFn: async () => {
      const res = await api.get(`/appointments/${appointmentId}`, { params: { detail: true } });
      return extractData<Record<string, unknown>>(res);
    },
  });

  const customer = detail?.customer as Record<string, string> | undefined;
  const messages = (detail?.communicationHistory as { whatsapp?: Array<Record<string, unknown>> })?.whatsapp ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{String(detail?.title ?? 'Appointment')}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <LoadingState rows={4} />
        ) : detail ? (
          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Customer Profile</h3>
              <div className="rounded-lg border p-4 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {customer?.name}</p>
                <p><span className="text-muted-foreground">Phone:</span> {customer?.phone}</p>
                <p><span className="text-muted-foreground">Email:</span> {customer?.email || '—'}</p>
                <p><span className="text-muted-foreground">Company:</span> {String(detail.companyName || '—')}</p>
                <p><span className="text-muted-foreground">Lead Source:</span> {String(detail.leadSource || '—')}</p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Appointment Details</h3>
              <div className="rounded-lg border p-4 space-y-1 text-sm">
                <p><span className="text-muted-foreground">ID:</span> {String(detail.id).slice(0, 8)}</p>
                <p><span className="text-muted-foreground">Service:</span> {String(detail.serviceRequested || detail.title)}</p>
                <p><span className="text-muted-foreground">Status:</span> <Badge variant="secondary">{String(detail.status)}</Badge></p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {['approve', 'complete', 'mark_missed', 'cancel'].map((action) => (
                  <Button key={action} size="sm" variant="outline" onClick={() => onAction?.(action)}>
                    {action.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">WhatsApp History</h3>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  messages.slice(-10).map((m) => (
                    <div key={String(m.id)} className={`rounded-lg p-2 text-xs ${m.direction === 'INBOUND' ? 'bg-muted' : 'bg-accent/10'}`}>
                      <p>{String(m.content)}</p>
                      <p className="text-muted-foreground mt-1">{formatRelativeTime(String(m.createdAt))}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
