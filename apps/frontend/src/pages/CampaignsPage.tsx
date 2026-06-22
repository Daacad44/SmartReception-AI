import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Send, Calendar, Radio, Plus, BarChart3, FileText, Trash2, Pencil,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

const CAMPAIGN_TYPES = ['PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING'];
const SCHEDULES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];

interface Segment {
  id: string;
  name: string;
  memberCount: number;
  customerType?: string;
  isSystem: boolean;
}

interface Template {
  id: string;
  name: string;
  content: string;
  type: string;
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
  responseCount?: number;
  linkClickCount?: number;
  scheduledAt?: string;
  segment?: { name: string };
  sendToAll?: boolean;
  _count?: { recipients: number };
}

interface Analytics {
  totals: { sent: number; delivered: number; failed: number; read: number; responses: number; linkClicks: number };
  responseRate: number;
  deliveryRate: number;
  readRate: number;
  byType: Array<{ type: string; count: number; sent: number }>;
  recentActivity: Array<{
    id: string;
    name: string;
    status: string;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    readCount: number;
    lastRunAt?: string;
  }>;
}

export function CampaignsPage() {
  const [tab, setTab] = useState('broadcasts');
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({
    name: '', message: '', type: 'MARKETING', schedule: 'ONE_TIME',
    segmentId: '', templateId: '', sendToAll: false, sendNow: true, scheduledAt: '',
  });
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', type: 'MARKETING' });
  const queryClient = useQueryClient();

  const { data: segments } = useQuery({
    queryKey: ['segments'],
    queryFn: async () => extractData<Segment[]>(await api.get('/segments')),
  });

  const { data: templates } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => extractData<Template[]>(await api.get('/message-templates')),
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => extractData<Campaign[]>(await api.get('/campaigns', { params: { limit: 50 } })),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['campaign-analytics'],
    queryFn: async () => extractData<Analytics>(await api.get('/campaigns/analytics')),
    enabled: tab === 'analytics',
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post('/campaigns', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-analytics'] });
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

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post('/message-templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      setTemplateOpen(false);
      setEditingTemplate(null);
      toast.success('Template saved');
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown>) =>
      api.patch(`/message-templates/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      setTemplateOpen(false);
      setEditingTemplate(null);
      toast.success('Template updated');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/message-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template deleted');
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

  const handleBroadcast = (sendNow: boolean) => {
    createMutation.mutate({
      name: form.name,
      message: form.message,
      type: form.type,
      schedule: form.schedule,
      segmentId: form.sendToAll ? undefined : form.segmentId || undefined,
      templateId: form.templateId || undefined,
      sendToAll: form.sendToAll,
      sendNow,
      scheduledAt: !sendNow && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
    });
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates?.find((t) => t.id === templateId);
    if (tpl) {
      setForm({ ...form, templateId, message: tpl.content, type: tpl.type });
    }
  };

  const openTemplateEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setTemplateForm({ name: tpl.name, content: tpl.content, type: tpl.type });
    setTemplateOpen(true);
  };

  const saveTemplate = () => {
    if (editingTemplate && !editingTemplate.isSystem) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, ...templateForm });
    } else if (!editingTemplate) {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const scheduledCampaigns = campaigns?.filter((c) => c.status === 'SCHEDULED') ?? [];
  const broadcastCampaigns = campaigns?.filter((c) => ['COMPLETED', 'SENDING'].includes(c.status)) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-accent" />
            Campaign Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Broadcast WhatsApp messages, schedule campaigns, and track analytics.
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setBroadcastOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="broadcasts"><Radio className="mr-1 h-3 w-3" />Broadcasts</TabsTrigger>
          <TabsTrigger value="scheduled"><Calendar className="mr-1 h-3 w-3" />Scheduled</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="mr-1 h-3 w-3" />Templates</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1 h-3 w-3" />Analytics</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts" className="mt-4">
          {isLoading ? <LoadingState rows={4} /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {broadcastCampaigns.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">No broadcasts yet. Create your first campaign.</p>
              )}
              {broadcastCampaigns.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.type} · {c.sendToAll ? 'All Customers' : c.segment?.name ?? 'Filtered'}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.message}</p>
                    <div className="grid grid-cols-4 gap-1 text-center text-xs">
                      <div><p className="font-semibold">{c.sentCount}</p><p className="text-muted-foreground">Sent</p></div>
                      <div><p className="font-semibold text-emerald-600">{c.deliveredCount}</p><p className="text-muted-foreground">Delivered</p></div>
                      <div><p className="font-semibold text-red-600">{c.failedCount}</p><p className="text-muted-foreground">Failed</p></div>
                      <div><p className="font-semibold">{c.readCount}</p><p className="text-muted-foreground">Read</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              {scheduledCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled campaigns.</p>
              ) : (
                scheduledCampaigns.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.schedule.replace('_', ' ')} · {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => sendMutation.mutate(c.id)}>
                        <Send className="mr-1 h-3 w-3" />Send Now
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {isLoading ? null : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns?.filter((c) => ['DRAFT', 'SCHEDULED'].includes(c.status)).map((c) => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => sendMutation.mutate(c.id)}>
                      <Send className="mr-1 h-3 w-3" />Send Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button variant="outline" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', content: '', type: 'MARKETING' }); setTemplateOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />New Template
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates?.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="font-medium">{t.name}</p>
                    {t.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                  </div>
                  <p className="mb-3 line-clamp-3 text-xs text-muted-foreground">{t.content}</p>
                  <div className="flex gap-1">
                    {!t.isSystem && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openTemplateEdit(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplateMutation.mutate(t.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => { applyTemplate(t.id); setBroadcastOpen(true); }}>
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          {analyticsLoading ? <LoadingState rows={4} /> : analytics ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: 'Total Sent', value: analytics.totals.sent, color: '' },
                  { label: 'Delivered', value: analytics.totals.delivered, color: 'text-emerald-600' },
                  { label: 'Read', value: analytics.totals.read, color: 'text-blue-600' },
                  { label: 'Failed', value: analytics.totals.failed, color: 'text-red-600' },
                  { label: 'Responses', value: analytics.totals.responses, color: 'text-purple-600' },
                  { label: 'Link Clicks', value: analytics.totals.linkClicks, color: 'text-amber-600' },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="mb-2 text-sm font-medium">Delivery Rate</p>
                    <p className="mb-2 text-2xl font-bold">{analytics.deliveryRate}%</p>
                    <Progress value={analytics.deliveryRate} className="h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="mb-2 text-sm font-medium">Read Rate</p>
                    <p className="mb-2 text-2xl font-bold">{analytics.readRate}%</p>
                    <Progress value={analytics.readRate} className="h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="mb-2 text-sm font-medium">Response Rate</p>
                    <p className="mb-2 text-2xl font-bold">{analytics.responseRate}%</p>
                    <Progress value={analytics.responseRate} className="h-2" />
                  </CardContent>
                </Card>
              </div>

              {analytics.byType.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Campaigns by Type</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.byType.map((t) => (
                      <div key={t.type} className="flex items-center justify-between">
                        <span className="text-sm">{t.type}</span>
                        <span className="text-sm text-muted-foreground">{t.count} campaigns · {t.sent} sent</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No analytics data yet.</p>
          )}
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Create Broadcast</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Campaign Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Recipients</Label>
              <Select
                value={form.sendToAll ? 'all' : form.segmentId || ''}
                onValueChange={(v) => {
                  if (v === 'all') setForm({ ...form, sendToAll: true, segmentId: '' });
                  else setForm({ ...form, sendToAll: false, segmentId: v });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {segments?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.memberCount})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Message Template (optional)</Label>
              <Select value={form.templateId} onValueChange={(v) => applyTemplate(v)}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
            <div className="space-y-1">
              <Label>Schedule For (optional)</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => handleBroadcast(false)} disabled={!form.scheduledAt}>
              Schedule
            </Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => handleBroadcast(true)}>
              <Send className="mr-1 h-4 w-4" />Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} disabled={editingTemplate?.isSystem} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={templateForm.type} onValueChange={(v) => setTemplateForm({ ...templateForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Content</Label>
              <Textarea rows={5} value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} placeholder="Use {{name}} for customer name..." />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-accent hover:bg-accent/90" onClick={saveTemplate} disabled={!templateForm.name || !templateForm.content}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
