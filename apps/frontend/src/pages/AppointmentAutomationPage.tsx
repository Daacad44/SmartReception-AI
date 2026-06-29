import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Workflow,
  Plus,
  Copy,
  Save,
  GripVertical,
  Bell,
  BarChart3,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import api, { extractData } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { toast } from 'sonner';
import type {
  AppointmentAnalyticsSnapshot,
  AppointmentWorkflow,
  ReminderConfig,
  WorkflowTemplate,
} from '@/lib/appointment-automation-types';

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function WorkflowCanvas({ workflow }: { workflow: AppointmentWorkflow }) {
  const enabledStages = workflow.stages.filter((s) => s.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="relative min-h-[480px] overflow-auto rounded-xl border bg-muted/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {enabledStages.map((stage) => (
          <div
            key={stage.id}
            className="group cursor-grab rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
            style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                <div>
                  <p className="font-medium">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.key}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {stage.requiresApproval && <Badge variant="outline">Approval</Badge>}
                {stage.isTerminal && <Badge variant="secondary">Terminal</Badge>}
              </div>
            </div>
            {stage.defaultActions && stage.defaultActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {stage.defaultActions.slice(0, 3).map((action) => (
                  <Badge key={action.type} variant="outline" className="text-[10px]">
                    {action.type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {workflow.transitions && workflow.transitions.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {workflow.transitions.length} automated transitions configured
        </p>
      )}
    </div>
  );
}

export function AppointmentAutomationPage() {
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading, isError, refetch } = useQuery({
    queryKey: ['appointment-automation', 'workflows'],
    queryFn: async () =>
      extractData<AppointmentWorkflow[]>(await api.get('/appointment-automation/workflows')),
  });

  const { data: templates } = useQuery({
    queryKey: ['appointment-automation', 'templates'],
    queryFn: async () =>
      extractData<WorkflowTemplate[]>(await api.get('/appointment-automation/templates')),
  });

  const activeWorkflowId = selectedWorkflowId ?? workflows?.find((w) => w.isDefault)?.id ?? workflows?.[0]?.id;

  const { data: workflowDetail } = useQuery({
    queryKey: ['appointment-automation', 'workflow', activeWorkflowId],
    enabled: Boolean(activeWorkflowId),
    queryFn: async () =>
      extractData<AppointmentWorkflow>(
        await api.get(`/appointment-automation/workflows/${activeWorkflowId}`)
      ),
  });

  const { data: reminders } = useQuery({
    queryKey: ['appointment-automation', 'reminders'],
    queryFn: async () =>
      extractData<ReminderConfig[]>(await api.get('/appointment-automation/reminders')),
  });

  const { data: analytics } = useQuery({
    queryKey: ['appointment-automation', 'analytics'],
    queryFn: async () =>
      extractData<{
        snapshot: AppointmentAnalyticsSnapshot;
        todayCount: number;
      }>(await api.get('/appointment-automation/analytics')),
    refetchInterval: 30_000,
  });

  const createFromTemplate = useMutation({
    mutationFn: async (templateKey: string) => {
      const res = await api.post('/appointment-automation/workflows/from-template', { templateKey });
      return extractData<AppointmentWorkflow>(res);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointment-automation'] });
      setSelectedWorkflowId(data.id);
      toast.success('Workflow created from template');
    },
    onError: () => toast.error('Failed to create workflow'),
  });

  const saveStageToggle = useMutation({
    mutationFn: async ({ workflowId, stages }: { workflowId: string; stages: AppointmentWorkflow['stages'] }) => {
      const res = await api.patch(`/appointment-automation/workflows/${workflowId}`, { stages });
      return extractData<AppointmentWorkflow>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-automation'] });
      toast.success('Workflow saved');
    },
  });

  const toggleStage = (stageId: string, isEnabled: boolean) => {
    if (!workflowDetail) return;
    const stages = workflowDetail.stages.map((s) =>
      s.id === stageId ? { ...s, isEnabled } : s
    );
    saveStageToggle.mutate({ workflowId: workflowDetail.id, stages });
  };

  const snapshot = analytics?.snapshot;

  if (isError) {
    return <ErrorState message="Unable to load appointment automation." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Workflow className="h-7 w-7 text-accent" />
            Appointment Automation
          </h1>
          <p className="text-muted-foreground">
            Enterprise workflow builder, smart notifications, and real-time analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(templates ?? []).slice(0, 3).map((t) => (
            <Button
              key={t.key}
              variant="outline"
              size="sm"
              onClick={() => createFromTemplate.mutate(t.key)}
              disabled={createFromTemplate.isPending}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t.name}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder"><Workflow className="mr-1 h-4 w-4" />Workflow Builder</TabsTrigger>
          <TabsTrigger value="reminders"><Bell className="mr-1 h-4 w-4" />Reminders</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1 h-4 w-4" />Analytics</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="mr-1 h-4 w-4" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(workflows ?? []).map((w) => (
              <Button
                key={w.id}
                variant={w.id === activeWorkflowId ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWorkflowId(w.id)}
              >
                {w.name}
                {w.isDefault && <Badge className="ml-2" variant="secondary">Default</Badge>}
              </Button>
            ))}
          </div>

          {isLoading || !workflowDetail ? (
            <Skeleton className="h-[500px] w-full rounded-xl" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{workflowDetail.name}</CardTitle>
                  <CardDescription>
                    {workflowDetail.description ?? 'Drag stages to customize your appointment lifecycle'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WorkflowCanvas workflow={workflowDetail} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workflow Stages</CardTitle>
                  <CardDescription>Enable or disable stages for your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {workflowDetail.stages
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <div>
                            <p className="font-medium">{stage.label}</p>
                            <p className="text-xs text-muted-foreground">{stage.key}</p>
                          </div>
                        </div>
                        <Button
                          variant={stage.isEnabled ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleStage(stage.id, !stage.isEnabled)}
                        >
                          {stage.isEnabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {workflowDetail.rules && workflowDetail.rules.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4" /> Conditional Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {workflowDetail.rules.map((rule) => (
                      <div key={rule.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Trigger: {rule.triggerEvent.replace(/_/g, ' ')} · Priority {rule.priority}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Reminder Schedule</CardTitle>
              <CardDescription>
                Automated reminders sent to all appointment contacts (phone, email, guardian)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(reminders ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.abs(r.offsetMinutes) >= 1440
                        ? `${Math.round(Math.abs(r.offsetMinutes) / 1440)} days before`
                        : Math.abs(r.offsetMinutes) >= 60
                          ? `${Math.round(Math.abs(r.offsetMinutes) / 60)} hours before`
                          : `${Math.abs(r.offsetMinutes)} minutes before`}
                      {' · '}
                      {r.channels.join(', ')}
                    </p>
                  </div>
                  <Badge variant={r.isEnabled ? 'default' : 'secondary'}>
                    {r.isEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Created (30d)" value={formatNumber(snapshot?.appointmentsCreated ?? 0)} />
            <MetricCard title="Confirmed" value={formatNumber(snapshot?.appointmentsConfirmed ?? 0)} />
            <MetricCard title="Completed" value={formatNumber(snapshot?.appointmentsCompleted ?? 0)} />
            <MetricCard title="Today" value={formatNumber(analytics?.todayCount ?? 0)} subtitle="Scheduled today" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Automation Success"
              value={`${(snapshot?.automationSuccessRate ?? 0).toFixed(1)}%`}
            />
            <MetricCard
              title="WhatsApp Delivery"
              value={`${(snapshot?.whatsappDeliveryRate ?? 0).toFixed(1)}%`}
            />
            <MetricCard
              title="Email Delivery"
              value={`${(snapshot?.emailDeliveryRate ?? 0).toFixed(1)}%`}
            />
            <MetricCard
              title="No Shows"
              value={formatNumber(snapshot?.noShows ?? 0)}
            />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Settings</CardTitle>
              <CardDescription>Business-specific booking and automation rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Default Duration (minutes)</Label>
                  <Input type="number" defaultValue={30} disabled className="mt-1" />
                </div>
                <div>
                  <Label>Buffer Time (minutes)</Label>
                  <Input type="number" defaultValue={0} disabled className="mt-1" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Advanced booking rules, working hours, holidays, and AI automation rules are configured
                per business via the automation API.
              </p>
              <Button variant="outline" size="sm" disabled>
                <Save className="mr-1 h-4 w-4" />
                Save Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Enterprise Templates</CardTitle>
              <CardDescription>Duplicate and customize industry workflows</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(templates ?? []).map((t) => (
                <div key={t.key} className="rounded-lg border p-4">
                  <p className="font-medium">{t.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => createFromTemplate.mutate(t.key)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Use Template
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
