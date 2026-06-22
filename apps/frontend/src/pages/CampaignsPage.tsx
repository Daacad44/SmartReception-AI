import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Calendar, Radio, Plus } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

const CAMPAIGN_TYPES = ['PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING'];
const SCHEDULES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'];

interface Segment {
  id: string;
  name: string;
  memberCount: number;
  customerType?: string;
  isSystem: boolean;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  type: string;
  schedule: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  scheduledAt?: string;
  segment?: { name: string };
  _count?: { recipients: number };
}

export function CampaignsPage() {
  const [tab, setTab] = useState('campaigns');
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', message: '', type: 'MARKETING', schedule: 'ONE_TIME', segmentId: '', sendNow: true, scheduledAt: '',
  });
  const queryClient = useQueryClient();

  const { data: segments } = useQuery({
    queryKey: ['segments'],
    queryFn: async () => extractData<Segment[]>(await api.get('/segments')),
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => extractData<Campaign[]>(await api.get('/campaigns', { params: { limit: 50 } })),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post('/campaigns', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setBroadcastOpen(false);
      toast.success('Campaign created');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Broadcast started');
    },
  });

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'bg-emerald-500/10 text-emerald-600',
      SENDING: 'bg-blue-500/10 text-blue-600',
      SCHEDULED: 'bg-amber-500/10 text-amber-600',
      FAILED: 'bg-red-500/10 text-red-600',
      DRAFT: 'bg-gray-500/10 text-gray-600',
      CANCELLED: 'bg-gray-500/10 text-gray-500',
    };
    return map[status] ?? '';
  };

  const handleBroadcast = () => {
    createMutation.mutate({
      name: form.name,
      message: form.message,
      type: form.type,
      schedule: form.schedule,
      segmentId: form.segmentId || undefined,
      sendNow: form.sendNow,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-accent" />
            Scheduler & Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">Broadcast WhatsApp messages to customer segments.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setBroadcastOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns"><Megaphone className="mr-1 h-3 w-3" />Campaigns</TabsTrigger>
          <TabsTrigger value="scheduler"><Calendar className="mr-1 h-3 w-3" />Scheduler</TabsTrigger>
          <TabsTrigger value="broadcasts"><Radio className="mr-1 h-3 w-3" />Broadcasts</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          {isLoading ? <LoadingState rows={4} /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns?.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.type} · {c.schedule.replace('_', ' ')}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.message}</p>
                    <div className="grid grid-cols-4 gap-1 text-center text-xs">
                      <div><p className="font-semibold">{c.sentCount}</p><p className="text-muted-foreground">Sent</p></div>
                      <div><p className="font-semibold text-emerald-600">{c.deliveredCount}</p><p className="text-muted-foreground">Delivered</p></div>
                      <div><p className="font-semibold text-red-600">{c.failedCount}</p><p className="text-muted-foreground">Failed</p></div>
                      <div><p className="font-semibold">{c.readCount}</p><p className="text-muted-foreground">Read</p></div>
                    </div>
                    {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => sendMutation.mutate(c.id)}>
                        <Send className="mr-1 h-3 w-3" />Send Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduler" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="mb-4 text-sm text-muted-foreground">Scheduled campaigns run automatically via the job queue.</p>
              {campaigns?.filter((c) => c.status === 'SCHEDULED').map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b py-3 last:border-0">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.schedule} · {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'Pending'}</p>
                  </div>
                  <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                </div>
              ))}
              {!campaigns?.some((c) => c.status === 'SCHEDULED') && (
                <p className="text-sm text-muted-foreground">No scheduled campaigns.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {campaigns?.filter((c) => ['COMPLETED', 'SENDING'].includes(c.status)).map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b py-3 last:border-0">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.segment?.name ?? 'All matching customers'} · {c.sentCount} recipients</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-emerald-600">{c.deliveredCount} delivered</p>
                    <p className="text-red-600">{c.failedCount} failed</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {segments?.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.memberCount} customers</p>
                  {s.isSystem && <Badge variant="secondary" className="mt-2">System</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Broadcast</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Campaign Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Customer Segment</Label>
              <Select value={form.segmentId} onValueChange={(v) => setForm({ ...form, segmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                <SelectContent>
                  {segments?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.memberCount})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Schedule</Label>
                <Select value={form.schedule} onValueChange={(v) => setForm({ ...form, schedule: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCHEDULES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your WhatsApp message..." />
            </div>
            {!form.sendNow && (
              <div className="space-y-1">
                <Label>Schedule For</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value, sendNow: false })} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForm({ ...form, sendNow: false })}>Schedule</Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => { setForm({ ...form, sendNow: true }); handleBroadcast(); }}>
              <Send className="mr-1 h-4 w-4" />Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
