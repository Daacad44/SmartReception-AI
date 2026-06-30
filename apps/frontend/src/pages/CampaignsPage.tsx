import { memo, useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Send, Calendar, Radio, Plus, BarChart3, FileText, Trash2, Pencil,
  Users, Check, ChevronRight, ChevronLeft, Truck, Clock, XCircle, Loader2,
  Sparkles, Pause, Play, Copy, Archive, Route,
} from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
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
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/LoadingState';
import { CustomerSearchSelect } from '@/components/campaigns/CustomerSearchSelect';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CAMPAIGN_TYPES = [
  'PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING',
  'WELCOME', 'APPOINTMENT_REMINDER', 'BIRTHDAY', 'PAYMENT_REMINDER', 'INVOICE',
  'PRODUCT_LAUNCH', 'SEASONAL', 'DISCOUNT', 'RETENTION', 'RE_ENGAGEMENT', 'THANK_YOU', 'CUSTOM',
];
const SCHEDULES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RECURRING', 'CUSTOM'];
const WIZARD_STEPS = ['Audience', 'Template', 'Message', 'Delivery', 'Review'] as const;
const DELIVERY_TABS = [
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
  { id: 'processing', label: 'Processing', icon: Loader2 },
  { id: 'sent', label: 'Sent', icon: Check },
  { id: 'failed', label: 'Failed', icon: XCircle },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
] as const;

type AudienceType = 'all' | 'segment' | 'group' | 'individual';

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
  whatsappTemplateName?: string | null;
  whatsappTemplateLanguage?: string | null;
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
  targetCustomer?: { id: string; name: string; phone: string };
  sendToAll?: boolean;
  _count?: { recipients: number };
}

interface Delivery {
  id: string;
  customerName: string;
  phone: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  campaignStatus: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  status: string;
  isSent: boolean;
  failedReason?: string;
}

interface CalendarData {
  campaigns: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    schedule: string;
    scheduledAt?: string;
    nextRunAt?: string;
    lastRunAt?: string;
    sentCount: number;
    _count?: { recipients: number };
  }>;
}

interface Journey {
  id: string;
  name: string;
  description?: string;
  status: string;
  triggerType: string;
  steps: Array<{ orderIndex: number; delayMinutes: number; message: string }>;
  _count?: { enrollments: number };
}

interface AiVersion {
  title: string;
  message: string;
  callToAction: string;
  tone: string;
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

const INITIAL_FORM = {
  name: '',
  message: '',
  type: 'MARKETING',
  schedule: 'ONE_TIME',
  segmentId: '',
  templateId: '',
  targetCustomerId: '',
  audienceType: 'all' as AudienceType,
  scheduledAt: '',
  deliveryMode: 'now' as 'now' | 'schedule',
};

function statusColor(status: string) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-600',
    SENDING: 'bg-blue-500/10 text-blue-600',
    RUNNING: 'bg-blue-500/10 text-blue-600',
    SCHEDULED: 'bg-amber-500/10 text-amber-600',
    PAUSED: 'bg-orange-500/10 text-orange-600',
    FAILED: 'bg-red-500/10 text-red-600',
    DRAFT: 'bg-gray-500/10 text-gray-600',
    CANCELLED: 'bg-gray-500/10 text-gray-500',
    ARCHIVED: 'bg-gray-500/10 text-gray-400',
    SENT: 'bg-emerald-500/10 text-emerald-600',
    DELIVERED: 'bg-emerald-500/10 text-emerald-600',
    PENDING: 'bg-amber-500/10 text-amber-600',
    ACTIVE: 'bg-emerald-500/10 text-emerald-600',
  };
  return map[status] ?? '';
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const CampaignCard = memo(function CampaignCard({
  campaign,
  onPause,
  onResume,
  onDuplicate,
  onArchive,
}: {
  campaign: Campaign;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const canPause = ['SCHEDULED', 'RUNNING', 'SENDING'].includes(campaign.status);
  const canResume = campaign.status === 'PAUSED';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <Badge variant="outline" className={statusColor(campaign.status)}>{campaign.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatLabel(campaign.type)} ·{' '}
          {campaign.sendToAll
            ? 'All Customers'
            : campaign.targetCustomer?.name
              ? `Individual: ${campaign.targetCustomer.name}`
              : campaign.segment?.name ?? 'Filtered'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{campaign.message}</p>
        <div className="grid grid-cols-4 gap-1 text-center text-xs">
          <div><p className="font-semibold">{campaign.sentCount}</p><p className="text-muted-foreground">Sent</p></div>
          <div><p className="font-semibold text-emerald-600">{campaign.deliveredCount}</p><p className="text-muted-foreground">Delivered</p></div>
          <div><p className="font-semibold text-red-600">{campaign.failedCount}</p><p className="text-muted-foreground">Failed</p></div>
          <div><p className="font-semibold">{campaign.readCount}</p><p className="text-muted-foreground">Read</p></div>
        </div>
        <div className="flex flex-wrap gap-1">
          {canPause && onPause && (
            <Button size="sm" variant="outline" onClick={() => onPause(campaign.id)}>
              <Pause className="mr-1 h-3 w-3" />Pause
            </Button>
          )}
          {canResume && onResume && (
            <Button size="sm" variant="outline" onClick={() => onResume(campaign.id)}>
              <Play className="mr-1 h-3 w-3" />Resume
            </Button>
          )}
          {onDuplicate && (
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(campaign.id)}>
              <Copy className="mr-1 h-3 w-3" />Duplicate
            </Button>
          )}
          {onArchive && campaign.status !== 'ARCHIVED' && (
            <Button size="sm" variant="ghost" onClick={() => onArchive(campaign.id)}>
              <Archive className="mr-1 h-3 w-3" />Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export function CampaignsPage() {
  const [tab, setTab] = useState('broadcasts');
  const [deliveryTab, setDeliveryTab] = useState<string>('scheduled');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    content: '',
    type: 'MARKETING',
    whatsappTemplateName: '',
    whatsappTemplateLanguage: 'en',
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiVersions, setAiVersions] = useState<AiVersion[]>([]);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyForm, setJourneyForm] = useState({
    name: '',
    description: '',
    triggerType: 'MANUAL',
    steps: [{ delayMinutes: 5, message: '' }],
  });
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

  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['campaign-deliveries', deliveryTab],
    queryFn: async () =>
      extractData<Delivery[]>(
        await api.get('/campaigns/deliveries', { params: { deliveryTab, limit: 50 } })
      ),
    enabled: tab === 'deliveries',
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['campaign-analytics'],
    queryFn: async () => extractData<Analytics>(await api.get('/campaigns/analytics')),
    enabled: tab === 'analytics',
  });

  const calendarFrom = useMemo(() => new Date().toISOString(), []);
  const calendarTo = useMemo(
    () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    []
  );

  const { data: calendar, isLoading: calendarLoading } = useQuery({
    queryKey: ['campaign-calendar', calendarFrom, calendarTo],
    queryFn: async () =>
      extractData<CalendarData>(
        await api.get('/campaigns/calendar', { params: { from: calendarFrom, to: calendarTo } })
      ),
    enabled: tab === 'calendar',
  });

  const { data: journeys, isLoading: journeysLoading } = useQuery({
    queryKey: ['campaign-journeys'],
    queryFn: async () => extractData<Journey[]>(await api.get('/campaigns/journeys/list')),
    enabled: tab === 'journeys',
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post('/campaigns', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-deliveries'] });
      resetWizard();
      toast.success('Campaign created');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Failed to create campaign'),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-deliveries'] });
      toast.success('Broadcast started');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign paused');
    },
    onError: () => toast.error('Failed to pause campaign'),
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign resumed');
    },
    onError: () => toast.error('Failed to resume campaign'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated');
    },
    onError: () => toast.error('Failed to duplicate campaign'),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign archived');
    },
    onError: () => toast.error('Failed to archive campaign'),
  });

  const generateAiMutation = useMutation({
    mutationFn: async (prompt: string) =>
      extractData<{ versions: AiVersion[] }>(
        await api.post('/campaigns/generate-ai', { prompt, type: form.type, versions: 3 })
      ),
    onSuccess: (data) => {
      setAiVersions(data.versions);
      toast.success('AI generated campaign versions');
    },
    onError: () => toast.error('AI generation failed — check your plan or try again'),
  });

  const createJourneyMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post('/campaigns/journeys', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-journeys'] });
      setJourneyOpen(false);
      setJourneyForm({ name: '', description: '', triggerType: 'MANUAL', steps: [{ delayMinutes: 5, message: '' }] });
      toast.success('Journey created');
    },
    onError: () => toast.error('Failed to create journey'),
  });

  const activateJourneyMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/campaigns/journeys/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-journeys'] });
      toast.success('Journey activated');
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.post('/message-templates', payload);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-templates'] });
      setTemplateOpen(false);
      setEditingTemplate(null);
      toast.success('Template saved');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown>) => {
      const response = await api.patch(`/message-templates/${id}`, payload);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-templates'] });
      setTemplateOpen(false);
      setEditingTemplate(null);
      toast.success('Template updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSaveTemplate = () => {
    const payload = {
      name: templateForm.name.trim(),
      content: templateForm.content.trim(),
      type: templateForm.type,
      whatsappTemplateName: templateForm.whatsappTemplateName.trim() || null,
      whatsappTemplateLanguage: templateForm.whatsappTemplateLanguage.trim() || null,
    };

    if (!payload.name || !payload.content) {
      toast.error('Name and content are required');
      return;
    }

    if (editingTemplate?.isSystem) {
      toast.error('System templates cannot be edited. Click New Template to create your own.');
      return;
    }

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, ...payload });
      return;
    }

    createTemplateMutation.mutate(payload);
  };

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/message-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardStep(0);
    setForm(INITIAL_FORM);
  }, []);

  const systemSegments = useMemo(() => segments?.filter((s) => s.isSystem) ?? [], [segments]);
  const customGroups = useMemo(() => segments?.filter((s) => !s.isSystem) ?? [], [segments]);

  const audienceLabel = useMemo(() => {
    switch (form.audienceType) {
      case 'all':
        return 'All Customers';
      case 'individual':
        return form.targetCustomerId ? 'Individual Customer' : 'Select a customer';
      case 'segment': {
        const seg = systemSegments.find((s) => s.id === form.segmentId);
        return seg ? `${seg.name} (${seg.memberCount})` : 'Select a segment';
      }
      case 'group': {
        const grp = customGroups.find((s) => s.id === form.segmentId);
        return grp ? `${grp.name} (${grp.memberCount})` : 'Select a customer group';
      }
      default:
        return '';
    }
  }, [form, systemSegments, customGroups]);

  const validateStep = useCallback(
    (step: number) => {
      if (step === 0) {
        if (form.audienceType === 'individual' && !form.targetCustomerId) return false;
        if (form.audienceType === 'segment' && !form.segmentId) return false;
        if (form.audienceType === 'group' && !form.segmentId) return false;
        return true;
      }
      if (step === 2) return form.message.trim().length > 0;
      if (step === 3) {
        if (form.deliveryMode === 'schedule' && !form.scheduledAt) return false;
        return true;
      }
      if (step === 4) return form.name.trim().length > 0;
      return true;
    },
    [form]
  );

  const buildPayload = useCallback(
    (sendNow: boolean) => ({
      name: form.name || `Campaign ${new Date().toLocaleDateString()}`,
      message: form.message,
      type: form.type,
      schedule: form.schedule,
      templateId: form.templateId || undefined,
      sendToAll: form.audienceType === 'all',
      segmentId:
        form.audienceType === 'segment' || form.audienceType === 'group'
          ? form.segmentId
          : undefined,
      targetCustomerId:
        form.audienceType === 'individual' ? form.targetCustomerId : undefined,
      sendNow,
      scheduledAt:
        !sendNow && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
    }),
    [form]
  );

  const handleSubmit = useCallback(
    (sendNow: boolean) => {
      createMutation.mutate(buildPayload(sendNow));
    },
    [buildPayload, createMutation]
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      const tpl = templates?.find((t) => t.id === templateId);
      if (tpl) {
        setForm((prev) => ({ ...prev, templateId, message: tpl.content, type: tpl.type }));
      }
    },
    [templates]
  );

  const scheduledCampaigns = useMemo(
    () => campaigns?.filter((c) => c.status === 'SCHEDULED') ?? [],
    [campaigns]
  );
  const broadcastCampaigns = useMemo(
    () => campaigns?.filter((c) => ['COMPLETED', 'SENDING', 'RUNNING', 'PAUSED'].includes(c.status)) ?? [],
    [campaigns]
  );

  const campaignActions = useMemo(
    () => ({
      onPause: (id: string) => pauseMutation.mutate(id),
      onResume: (id: string) => resumeMutation.mutate(id),
      onDuplicate: (id: string) => duplicateMutation.mutate(id),
      onArchive: (id: string) => archiveMutation.mutate(id),
    }),
    [pauseMutation, resumeMutation, duplicateMutation, archiveMutation]
  );

  const wizardProgress = ((wizardStep + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-accent" />
            Campaign Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Build, schedule, and track WhatsApp campaigns with enterprise-grade delivery controls.
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 shrink-0" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="broadcasts"><Radio className="mr-1 h-3 w-3" />Broadcasts</TabsTrigger>
          <TabsTrigger value="scheduled"><Calendar className="mr-1 h-3 w-3" />Scheduled</TabsTrigger>
          <TabsTrigger value="calendar"><Calendar className="mr-1 h-3 w-3" />Calendar</TabsTrigger>
          <TabsTrigger value="journeys"><Route className="mr-1 h-3 w-3" />Journeys</TabsTrigger>
          <TabsTrigger value="deliveries"><Truck className="mr-1 h-3 w-3" />Delivery Center</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="mr-1 h-3 w-3" />Templates</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1 h-3 w-3" />Analytics</TabsTrigger>
          <TabsTrigger value="segments"><Users className="mr-1 h-3 w-3" />Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts" className="mt-4">
          {isLoading ? <LoadingState rows={4} /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {broadcastCampaigns.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No broadcasts yet. Create your first campaign.
                </p>
              )}
              {broadcastCampaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} {...campaignActions} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              {scheduledCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled campaigns.</p>
              ) : (
                scheduledCampaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.schedule.replace('_', ' ')} ·{' '}
                        {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                      {c.status === 'PAUSED' ? (
                        <Button size="sm" variant="outline" onClick={() => resumeMutation.mutate(c.id)}>
                          <Play className="mr-1 h-3 w-3" />Resume
                        </Button>
                      ) : ['SCHEDULED', 'RUNNING'].includes(c.status) ? (
                        <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate(c.id)}>
                          <Pause className="mr-1 h-3 w-3" />Pause
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => sendMutation.mutate(c.id)}>
                        <Send className="mr-1 h-3 w-3" />Send Now
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming & Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {calendarLoading ? (
                <div className="p-6"><LoadingState rows={5} /></div>
              ) : !calendar?.campaigns?.length ? (
                <p className="p-6 text-sm text-muted-foreground">No campaigns in the next 30 days.</p>
              ) : (
                <div className="divide-y">
                  {calendar.campaigns.map((c) => {
                    const when = c.nextRunAt || c.scheduledAt || c.lastRunAt;
                    return (
                      <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatLabel(c.type)} · {formatLabel(c.schedule)}
                            {when ? ` · ${new Date(when).toLocaleString()}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                          <span className="text-xs text-muted-foreground">{c.sentCount} sent</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journeys" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setJourneyOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />New Journey
            </Button>
          </div>
          {journeysLoading ? (
            <LoadingState rows={3} />
          ) : !journeys?.length ? (
            <p className="text-sm text-muted-foreground">
              No customer journeys yet. Create automated multi-step flows for welcome sequences, follow-ups, and retention.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {journeys.map((j) => (
                <Card key={j.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{j.name}</CardTitle>
                      <Badge variant="outline" className={statusColor(j.status)}>{j.status}</Badge>
                    </div>
                    {j.description && <p className="text-xs text-muted-foreground">{j.description}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {j.steps.length} steps · {j._count?.enrollments ?? 0} enrolled · Trigger: {formatLabel(j.triggerType)}
                    </p>
                    <ol className="space-y-1 text-xs text-muted-foreground">
                      {j.steps.slice(0, 3).map((step) => (
                        <li key={step.orderIndex}>
                          Wait {step.delayMinutes}m → {step.message.slice(0, 60)}{step.message.length > 60 ? '…' : ''}
                        </li>
                      ))}
                      {j.steps.length > 3 && <li>+{j.steps.length - 3} more steps</li>}
                    </ol>
                    {j.status === 'DRAFT' && (
                      <Button size="sm" variant="outline" onClick={() => activateJourneyMutation.mutate(j.id)}>
                        <Play className="mr-1 h-3 w-3" />Activate
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {DELIVERY_TABS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={deliveryTab === id ? 'default' : 'outline'}
                className={deliveryTab === id ? 'bg-accent hover:bg-accent/90' : ''}
                onClick={() => setDeliveryTab(id)}
              >
                <Icon className="mr-1 h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {deliveriesLoading ? (
                <div className="p-6"><LoadingState rows={5} /></div>
              ) : !deliveries?.length ? (
                <p className="p-6 text-sm text-muted-foreground">No delivery records in this category.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="hidden md:table-cell">Campaign</TableHead>
                        <TableHead className="hidden lg:table-cell">Scheduled</TableHead>
                        <TableHead className="hidden lg:table-cell">Sent</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.customerName}</TableCell>
                          <TableCell className="text-muted-foreground">{d.phone}</TableCell>
                          <TableCell className="hidden md:table-cell">{d.campaignName}</TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {d.scheduledAt ? new Date(d.scheduledAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {d.sentAt ? new Date(d.sentAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor(d.status)}>{d.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({
                  name: '',
                  content: '',
                  type: 'MARKETING',
                  whatsappTemplateName: '',
                  whatsappTemplateLanguage: 'en',
                });
                setTemplateOpen(true);
              }}
            >
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
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingTemplate(t);
                          setTemplateForm({
                            name: t.name,
                            content: t.content,
                            type: t.type,
                            whatsappTemplateName: t.whatsappTemplateName ?? '',
                            whatsappTemplateLanguage: t.whatsappTemplateLanguage ?? 'en',
                          });
                          setTemplateOpen(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplateMutation.mutate(t.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => { applyTemplate(t.id); setWizardOpen(true); }}
                    >
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
                {[
                  { label: 'Delivery Rate', value: analytics.deliveryRate },
                  { label: 'Read Rate', value: analytics.readRate },
                  { label: 'Response Rate', value: analytics.responseRate },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4">
                      <p className="mb-2 text-sm font-medium">{stat.label}</p>
                      <p className="mb-2 text-2xl font-bold">{stat.value}%</p>
                      <Progress value={stat.value} className="h-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                  {s.isSystem ? (
                    <Badge variant="secondary" className="mt-2">System Segment</Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2">Customer Group</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) resetWizard(); else setWizardOpen(true); }}>
        <DialogContent scrollable className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {WIZARD_STEPS.map((step, i) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => i < wizardStep && setWizardStep(i)}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      i === wizardStep
                        ? 'bg-accent text-accent-foreground'
                        : i < wizardStep
                          ? 'bg-accent/10 text-accent'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i < wizardStep ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                    {step}
                  </button>
                ))}
              </div>
              <Progress value={wizardProgress} className="h-1.5" />
            </div>
          </DialogHeader>

          <DialogBody>
            {wizardStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Send To</Label>
                  <Select
                    value={form.audienceType}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        audienceType: v as AudienceType,
                        segmentId: '',
                        targetCustomerId: '',
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="group">Customer Group</SelectItem>
                      <SelectItem value="segment">Segment</SelectItem>
                      <SelectItem value="individual">Individual Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.audienceType === 'segment' && (
                  <div className="space-y-2">
                    <Label>Select Segment</Label>
                    <Select value={form.segmentId} onValueChange={(v) => setForm({ ...form, segmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose a segment" /></SelectTrigger>
                      <SelectContent>
                        {systemSegments.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.memberCount})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.audienceType === 'group' && (
                  <div className="space-y-2">
                    <Label>Select Customer Group</Label>
                    <Select value={form.segmentId} onValueChange={(v) => setForm({ ...form, segmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                      <SelectContent>
                        {customGroups.length === 0 ? (
                          <SelectItem value="__none" disabled>No custom groups yet</SelectItem>
                        ) : (
                          customGroups.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.memberCount})</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.audienceType === 'individual' && (
                  <div className="space-y-2">
                    <Label>Search Customer</Label>
                    <CustomerSearchSelect
                      value={form.targetCustomerId}
                      onSelect={(c) => setForm({ ...form, targetCustomerId: c?.id ?? '' })}
                    />
                  </div>
                )}
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose a template to pre-fill your message, or skip to compose from scratch.
                </p>
                <Select value={form.templateId} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.message && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 text-sm whitespace-pre-wrap">{form.message}</CardContent>
                  </Card>
                )}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Summer Promotion"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-accent/30 bg-accent/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <Label>Generate with AI</Label>
                  </div>
                  <Textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe your campaign goal, e.g. 'Welcome new customers with a 10% discount offer'"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={aiPrompt.trim().length < 5 || generateAiMutation.isPending}
                    onClick={() => generateAiMutation.mutate(aiPrompt)}
                  >
                    {generateAiMutation.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Generate Campaign with AI
                  </Button>
                  {aiVersions.length > 0 && (
                    <div className="space-y-2">
                      {aiVersions.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full rounded-lg border bg-background p-3 text-left text-sm hover:border-accent"
                          onClick={() => setForm((prev) => ({ ...prev, name: v.title, message: v.message }))}
                        >
                          <p className="font-medium">{v.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.message}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Write your WhatsApp message... Use {{customer_name}} for personalization."
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{{customer_name}}'}, {'{{business_name}}'}, {'{{appointment_date}}'}, {'{{discount_code}}'}
                  </p>
                  <p className="text-xs text-muted-foreground">{form.message.length} characters</p>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Delivery Type</Label>
                  <Select
                    value={form.deliveryMode}
                    onValueChange={(v) => setForm({ ...form, deliveryMode: v as 'now' | 'schedule' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Send Immediately</SelectItem>
                      <SelectItem value="schedule">Schedule for Later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.deliveryMode === 'schedule' && (
                  <>
                    <div className="space-y-2">
                      <Label>Schedule Frequency</Label>
                      <Select value={form.schedule} onValueChange={(v) => setForm({ ...form, schedule: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SCHEDULES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scheduled Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {wizardStep === 4 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Review</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Audience</dt>
                      <dd className="text-right font-medium">{audienceLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd>{form.type}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Delivery</dt>
                      <dd>
                        {form.deliveryMode === 'now'
                          ? 'Send immediately'
                          : `${form.schedule.replace('_', ' ')} · ${form.scheduledAt ? new Date(form.scheduledAt).toLocaleString() : 'Not set'}`}
                      </dd>
                    </div>
                  </dl>
                  {!form.name && (
                    <div className="space-y-2">
                      <Label>Campaign Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Required before sending"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Message Preview</h3>
                  <Card className="border-accent/20 bg-muted/20">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                          WA
                        </div>
                        <span className="text-xs text-muted-foreground">WhatsApp Preview</span>
                      </div>
                      <p className="whitespace-pre-wrap rounded-lg bg-background p-3 text-sm shadow-sm">
                        {form.message || 'Your message will appear here...'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="gap-2">
            {wizardStep > 0 ? (
              <Button type="button" variant="outline" onClick={() => setWizardStep((s) => s - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={resetWizard}>Cancel</Button>
            )}
            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <Button
                type="button"
                className="bg-accent hover:bg-accent/90"
                disabled={!validateStep(wizardStep)}
                onClick={() => setWizardStep((s) => s + 1)}
              >
                Next<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                {form.deliveryMode === 'schedule' && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!validateStep(4) || createMutation.isPending}
                    onClick={() => handleSubmit(false)}
                  >
                    <Calendar className="mr-1 h-4 w-4" />Schedule
                  </Button>
                )}
                <Button
                  type="button"
                  className="bg-accent hover:bg-accent/90"
                  disabled={!validateStep(4) || createMutation.isPending}
                  onClick={() => handleSubmit(true)}
                >
                  <Send className="mr-1 h-4 w-4" />
                  {form.deliveryMode === 'now' ? 'Send Now' : 'Send Now Anyway'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent scrollable className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                disabled={editingTemplate?.isSystem}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={templateForm.type} onValueChange={(v) => setTemplateForm({ ...templateForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                rows={5}
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                placeholder="Use {{name}} for customer name..."
              />
            </div>
            <div className="space-y-2">
              <Label>Meta WhatsApp Template Name (optional)</Label>
              <Input
                value={templateForm.whatsappTemplateName}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, whatsappTemplateName: e.target.value })
                }
                placeholder="smartreception_welcome"
              />
              <p className="text-xs text-muted-foreground">
                Exact name from Meta Business Manager — used when sending outside the 24-hour session.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Meta Template Language (optional)</Label>
              <Input
                value={templateForm.whatsappTemplateLanguage}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, whatsappTemplateLanguage: e.target.value })
                }
                placeholder="en"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              className="bg-accent hover:bg-accent/90"
              onClick={handleSaveTemplate}
              disabled={
                !templateForm.name.trim() ||
                !templateForm.content.trim() ||
                createTemplateMutation.isPending ||
                updateTemplateMutation.isPending
              }
            >
              {createTemplateMutation.isPending || updateTemplateMutation.isPending
                ? 'Saving…'
                : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={journeyOpen} onOpenChange={setJourneyOpen}>
        <DialogContent scrollable className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Customer Journey</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Journey Name</Label>
              <Input
                value={journeyForm.name}
                onChange={(e) => setJourneyForm({ ...journeyForm, name: e.target.value })}
                placeholder="e.g. Welcome Sequence"
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={journeyForm.triggerType}
                onValueChange={(v) => setJourneyForm({ ...journeyForm, triggerType: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual Enrollment</SelectItem>
                  <SelectItem value="CUSTOMER_CREATED">New Customer Registered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Steps</Label>
              {journeyForm.steps.map((step, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      className="w-28"
                      value={step.delayMinutes}
                      onChange={(e) => {
                        const steps = [...journeyForm.steps];
                        steps[index] = { ...steps[index], delayMinutes: Number(e.target.value) };
                        setJourneyForm({ ...journeyForm, steps });
                      }}
                    />
                    <span className="self-center text-xs text-muted-foreground">minutes wait</span>
                  </div>
                  <Textarea
                    rows={3}
                    value={step.message}
                    onChange={(e) => {
                      const steps = [...journeyForm.steps];
                      steps[index] = { ...steps[index], message: e.target.value };
                      setJourneyForm({ ...journeyForm, steps });
                    }}
                    placeholder="WhatsApp message for this step..."
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setJourneyForm({
                    ...journeyForm,
                    steps: [...journeyForm.steps, { delayMinutes: 1440, message: '' }],
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />Add Step
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              className="bg-accent hover:bg-accent/90"
              disabled={!journeyForm.name || journeyForm.steps.some((s) => !s.message.trim())}
              onClick={() => createJourneyMutation.mutate(journeyForm)}
            >
              Create Journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
