import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/LoadingState';
import api, { extractData } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { appointmentStatusStyles } from './AppointmentCard';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
  FileText,
  Sparkles,
} from 'lucide-react';

interface AppointmentDetailProps {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    MISSED: 'missed',
    NO_SHOW: 'no_show',
  };
  return map[status] ?? 'pending';
}

export function AppointmentDetailSheet({ appointmentId, open, onClose }: AppointmentDetailProps) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId, 'detail'],
    enabled: Boolean(appointmentId && open),
    queryFn: async () => {
      const res = await api.get(`/appointments/${appointmentId}`, { params: { detail: true } });
      return extractData<Record<string, unknown>>(res);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, extra }: { action: string; extra?: Record<string, unknown> }) => {
      await api.post(`/appointments/${appointmentId}/actions`, { action, ...extra });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      toast.success('Appointment updated');
    },
    onError: () => toast.error('Action failed'),
  });

  const customer = detail?.customer as Record<string, string> | undefined;
  const assignedTo = detail?.assignedTo as { firstName?: string; lastName?: string } | undefined;
  const createdBy = detail?.createdBy as { firstName?: string; lastName?: string } | undefined;
  const service = detail?.service as { name?: string; duration?: number } | undefined;
  const comms = detail?.communicationHistory as {
    whatsapp?: Array<Record<string, unknown>>;
    appointmentHistory?: Array<Record<string, unknown>>;
    internalNotes?: Array<Record<string, unknown>>;
  } | undefined;
  const aiSummary = detail?.aiConversationSummary as Record<string, string> | null;
  const requirements = detail?.requirementsCollected as Record<string, unknown> | null;
  const messages = comms?.whatsapp ?? [];
  const aptHistory = comms?.appointmentHistory ?? [];
  const internalNotes = comms?.internalNotes ?? (detail?.internalNotes as Array<Record<string, unknown>>) ?? [];

  const startTime = detail?.startTime ? new Date(String(detail.startTime)) : null;
  const endTime = detail?.endTime ? new Date(String(detail.endTime)) : null;
  const durationMins = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null;
  const uiStatus = statusLabel(String(detail?.status ?? 'SCHEDULED'));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left text-xl">{String(detail?.title ?? 'Appointment Details')}</SheetTitle>
          {detail && (
            <Badge variant="outline" className={cn('w-fit capitalize', appointmentStatusStyles[uiStatus])}>
              {uiStatus.replace('_', ' ')}
            </Badge>
          )}
        </SheetHeader>

        {isLoading ? (
          <LoadingState rows={6} />
        ) : detail ? (
          <div className="space-y-6 pb-8">
            <section className="rounded-xl border bg-muted/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-accent" />
                Customer Information
              </h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Full Name</dt><dd className="font-medium">{customer?.name}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer?.phone}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer?.email || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Company</dt><dd className="flex items-center gap-1"><Building2 className="h-3 w-3" />{String(detail.companyName || customer?.companyName || '—')}</dd></div>
                <div><dt className="text-muted-foreground">WhatsApp</dt><dd>{customer?.whatsappNumber || customer?.phone}</dd></div>
                <div><dt className="text-muted-foreground">Customer Type</dt><dd className="capitalize">{String(customer?.customerType ?? 'regular').replace(/_/g, ' ').toLowerCase()}</dd></div>
                {customer?.notes && <div className="sm:col-span-2"><dt className="text-muted-foreground">Notes</dt><dd>{customer.notes}</dd></div>}
              </dl>
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold">Service Information</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Requested Service</dt><dd className="font-medium">{String(detail.serviceRequested || service?.name || detail.title)}</dd></div>
                <div><dt className="text-muted-foreground">Category</dt><dd>{String(detail.serviceCategory || '—')}</dd></div>
                <div><dt className="text-muted-foreground">Budget</dt><dd>{detail.budget ? `$${detail.budget}` : '—'}</dd></div>
                {requirements && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground mb-1">Requirements (AI)</dt>
                    <dd className="rounded-lg bg-muted p-2 text-xs">{JSON.stringify(requirements, null, 2)}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-accent" />
                Appointment Information
              </h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Date</dt><dd>{startTime?.toLocaleDateString()}</dd></div>
                <div><dt className="text-muted-foreground">Time</dt><dd>{startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd></div>
                <div><dt className="text-muted-foreground">Duration</dt><dd>{durationMins ? `${durationMins} min` : '—'}</dd></div>
                <div><dt className="text-muted-foreground">Assigned Staff</dt><dd>{assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : '—'}</dd></div>
                <div><dt className="text-muted-foreground">Priority</dt><dd className="uppercase">{String(detail.priority ?? 'MEDIUM')}</dd></div>
                <div><dt className="text-muted-foreground">Created By</dt><dd>{createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : '—'}</dd></div>
                <div><dt className="text-muted-foreground">Created Date</dt><dd>{detail.createdAt ? new Date(String(detail.createdAt)).toLocaleString() : '—'}</dd></div>
              </dl>
            </section>

            {aiSummary && (
              <section className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI Conversation Summary
                </h3>
                <div className="space-y-2 text-sm">
                  {['customerNeeds', 'goals', 'requirements', 'painPoints', 'recommendations'].map((key) =>
                    aiSummary[key] ? (
                      <div key={key}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p>{aiSummary[key]}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {uiStatus === 'pending' && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => actionMutation.mutate({ action: 'approve' })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate({ action: 'reject', extra: { rejectionReason: 'Not available' } })}>
                      Reject
                    </Button>
                  </>
                )}
                {['complete', 'mark_missed', 'cancel'].map((action) => (
                  <Button key={action} size="sm" variant="outline" onClick={() => actionMutation.mutate({ action })}>
                    {action.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </section>

            <Separator />

            <Tabs defaultValue="whatsapp">
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1"><MessageSquare className="mr-1 h-3 w-3" />WhatsApp</TabsTrigger>
                <TabsTrigger value="history" className="flex-1"><Calendar className="mr-1 h-3 w-3" />History</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1"><FileText className="mr-1 h-3 w-3" />Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No WhatsApp messages.</p>
                ) : (
                  messages.slice(-15).map((m) => (
                    <div key={String(m.id)} className={cn('rounded-lg p-2.5 text-xs', m.direction === 'INBOUND' ? 'bg-muted' : 'bg-accent/10')}>
                      <p>{String(m.content)}</p>
                      <p className="mt-1 text-muted-foreground">{formatRelativeTime(String(m.createdAt))}</p>
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-3 space-y-2">
                {aptHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prior appointments.</p>
                ) : (
                  aptHistory.map((a) => (
                    <div key={String(a.id)} className="rounded-lg border p-2 text-xs">
                      <p className="font-medium">{String(a.title)}</p>
                      <p className="text-muted-foreground">{new Date(String(a.startTime)).toLocaleString()} · {String(a.status)}</p>
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="notes" className="mt-3 space-y-3">
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {internalNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No internal notes.</p>
                  ) : (
                    internalNotes.map((n) => (
                      <div key={String(n.id)} className="rounded-lg bg-muted p-2 text-xs">
                        <p>{String(n.content)}</p>
                        <p className="mt-1 text-muted-foreground">{formatRelativeTime(String(n.createdAt))}</p>
                      </div>
                    ))
                  )}
                </div>
                <Textarea
                  placeholder="Add internal note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onClick={() => {
                    api.post(`/appointments/${appointmentId}/notes`, { content: note }).then(() => {
                      setNote('');
                      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
                      toast.success('Note added');
                    });
                  }}
                >
                  Add Note
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
