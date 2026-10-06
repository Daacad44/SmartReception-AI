import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, History, Loader2, MessageCircle, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { AgentDiscoveryReadiness, AgentDiscoveryTemplate, AgentStudioAgent, AgentStudioSkill } from '@/lib/agent-studio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

const riskTone: Record<AgentStudioSkill['riskLevel'], string> = {
  READ_ONLY: 'bg-slate-100 text-slate-700',
  LOW: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-700',
};

function readableSkill(skillKey: string) {
  return skillKey.split('.').map((part) => part.replace(/_/g, ' ')).join(' · ');
}

export function AiAgentStudioPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [customerTypes, setCustomerTypes] = useState('');
  const [commonQuestions, setCommonQuestions] = useState('');
  const [handoverRules, setHandoverRules] = useState('');
  const [prohibitedTopics, setProhibitedTopics] = useState('');

  const agentsQuery = useQuery({
    queryKey: ['ai-agent-studio'],
    queryFn: async () => {
      const agents = extractData<AgentStudioAgent[]>(await api.get('/ai-agent-studio'));
      if (!agents[0]) return [];
      const detail = extractData<AgentStudioAgent>(await api.get(`/ai-agent-studio/${agents[0].id}`));
      return [detail];
    },
  });
  const agent = agentsQuery.data?.[0];
  const discoveryQuery = useQuery({
    queryKey: ['ai-agent-studio', agent?.id, 'discovery'],
    queryFn: async () => extractData<AgentDiscoveryReadiness>(await api.get(`/ai-agent-studio/${agent!.id}/discovery`)),
    enabled: Boolean(agent),
  });
  const templatesQuery = useQuery({
    queryKey: ['ai-agent-studio', 'discovery-templates'],
    queryFn: async () => extractData<AgentDiscoveryTemplate[]>(await api.get('/ai-agent-studio/discovery/templates')),
  });

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setDescription(agent.description ?? '');
    setRole(typeof agent.draft?.instructions.role === 'string' ? agent.draft.instructions.role : '');
  }, [agent]);

  useEffect(() => {
    if (!templateId && discoveryQuery.data?.recommendedTemplateId) setTemplateId(discoveryQuery.data.recommendedTemplateId);
  }, [discoveryQuery.data?.recommendedTemplateId, templateId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-agent-studio'] });
  const identityMutation = useMutation({
    mutationFn: () => api.patch(`/ai-agent-studio/${agent!.id}`, { name, description: description || null }),
    onSuccess: async () => { await invalidate(); toast.success('Agent identity saved'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const draftMutation = useMutation({
    mutationFn: () => api.put(`/ai-agent-studio/${agent!.id}/draft`, {
      expectedRevision: agent!.draft!.revision,
      instructions: { ...agent!.draft!.instructions, role },
    }),
    onSuccess: async () => { await invalidate(); toast.success('Agent instructions saved safely'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const releaseMutation = useMutation({
    mutationFn: () => api.post(`/ai-agent-studio/${agent!.id}/releases`, { changeSummary }),
    onSuccess: async () => { setChangeSummary(''); await invalidate(); toast.success('Immutable release created'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const skillMutation = useMutation({
    mutationFn: (skill: AgentStudioSkill) => api.put(
      `/ai-agent-studio/${agent!.id}/skills/${encodeURIComponent(skill.skillKey)}`,
      {
        enabled: !skill.enabled,
        riskLevel: skill.riskLevel,
        requiresConfirmation: skill.requiresConfirmation,
        configuration: skill.configuration,
      }
    ),
    onSuccess: async () => { await invalidate(); toast.success('Skill policy updated'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const discoveryMutation = useMutation({
    mutationFn: () => api.post(`/ai-agent-studio/${agent!.id}/discovery/apply`, {
      expectedRevision: agent!.draft!.revision,
      templateId,
      answers: {
        primaryGoal,
        customerTypes: customerTypes.split('\n').map((item) => item.trim()).filter(Boolean),
        commonQuestions: commonQuestions.split('\n').map((item) => item.trim()).filter(Boolean),
        prohibitedTopics: prohibitedTopics.split('\n').map((item) => item.trim()).filter(Boolean),
        handoverRules: handoverRules.split('\n').map((item) => item.trim()).filter(Boolean),
        tone: 'PROFESSIONAL',
        languages: agent!.supportedLanguages,
        operatingNotes: '',
      },
    }),
    onSuccess: async () => {
      await Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ['ai-agent-studio', agent!.id, 'discovery'] })]);
      toast.success('Business discovery applied to the agent draft');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const readiness = useMemo(() => {
    if (!agent) return [];
    return [
      { label: 'Agent identity', complete: Boolean(agent.name && agent.description) },
      { label: 'Professional instructions', complete: Boolean(role.trim()) },
      { label: 'Knowledge search', complete: agent.skills.some((s) => s.skillKey === 'knowledge.search' && s.enabled) },
      { label: 'Human handover', complete: agent.skills.some((s) => s.skillKey === 'human.handover' && s.enabled) },
      { label: 'Release snapshot', complete: agent.releases.length > 0 },
    ];
  }, [agent, role]);

  if (agentsQuery.isPending) return <LoadingState rows={6} />;
  if (agentsQuery.isError) return <ErrorState message={getErrorMessage(agentsQuery.error)} onRetry={() => agentsQuery.refetch()} />;
  if (!agent) return <ErrorState message="No WhatsApp agent could be provisioned for this business." onRetry={() => agentsQuery.refetch()} />;

  const completed = readiness.filter((item) => item.complete).length;
  const busy = identityMutation.isPending || draftMutation.isPending || releaseMutation.isPending || skillMutation.isPending || discoveryMutation.isPending;
  const discoveryReady = primaryGoal.trim().length >= 10 && customerTypes.trim().length >= 2 && commonQuestions.trim().length >= 3 && handoverRules.trim().length >= 3 && Boolean(templateId) && Boolean(agent.draft);

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300"><Sparkles className="h-4 w-4" /> WhatsApp-first automation</div>
            <div><h1 className="text-3xl font-bold tracking-tight">AI Agent Studio</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Configure, govern and release a professional business agent without changing the live experience until a release is approved.</p></div>
            <div className="flex flex-wrap gap-2"><Badge className="bg-emerald-500/20 text-emerald-200">{agent.channel}</Badge><Badge className="bg-white/10 text-white">{agent.status}</Badge>{agent.activeRelease && <Badge className="bg-blue-500/20 text-blue-200">Live release v{agent.activeRelease.releaseNumber}</Badge>}</div>
          </div>
          <div className="min-w-64 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Setup readiness</span><strong>{completed}/{readiness.length}</strong></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(completed / readiness.length) * 100}%` }} /></div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:w-auto md:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="discovery">Business discovery</TabsTrigger><TabsTrigger value="behavior">Behavior</TabsTrigger><TabsTrigger value="skills">Skills & safety</TabsTrigger><TabsTrigger value="releases">Releases</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Agent identity</CardTitle><CardDescription>This identity is customer-facing on WhatsApp.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="agent-name">Agent name</Label><Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="agent-description">Purpose</Label><Textarea id="agent-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></div><Button disabled={busy || name.trim().length < 2} onClick={() => identityMutation.mutate()}>{identityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save identity</Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Launch checklist</CardTitle><CardDescription>Minimum controls for a dependable WhatsApp agent.</CardDescription></CardHeader><CardContent className="space-y-3">{readiness.map((item) => <div key={item.label} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{item.label}</span>{item.complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="text-xs text-muted-foreground">Required</span>}</div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="discovery" className="space-y-5">
          <Card><CardHeader><CardTitle>Professional business discovery</CardTitle><CardDescription>Convert verified business context into structured instructions, safety boundaries and handover rules. Nothing is deployed automatically.</CardDescription></CardHeader><CardContent><div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{discoveryQuery.data?.checks.map((check) => <div key={check.key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">{check.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full border-2" />} {check.label}</div>)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-4"><div className="space-y-2"><Label>Business template</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{templatesQuery.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div><div className="space-y-2"><Label>Primary WhatsApp goal</Label><Textarea value={primaryGoal} onChange={(event) => setPrimaryGoal(event.target.value)} placeholder="Help customers receive accurate answers and reach the correct team..." rows={4} /></div><div className="space-y-2"><Label>Customer types — one per line</Label><Textarea value={customerTypes} onChange={(event) => setCustomerTypes(event.target.value)} placeholder={'New customers\nExisting customers'} rows={4} /></div></div><div className="space-y-4"><div className="space-y-2"><Label>Most common questions — one per line</Label><Textarea value={commonQuestions} onChange={(event) => setCommonQuestions(event.target.value)} placeholder={'What services do you provide?\nWhen are you open?'} rows={4} /></div><div className="space-y-2"><Label>Mandatory handover rules — one per line</Label><Textarea value={handoverRules} onChange={(event) => setHandoverRules(event.target.value)} placeholder={'Handover when approved information is unavailable\nHandover complaints'} rows={4} /></div><div className="space-y-2"><Label>Topics the agent must not answer — one per line</Label><Textarea value={prohibitedTopics} onChange={(event) => setProhibitedTopics(event.target.value)} placeholder="Legal advice" rows={3} /></div></div></div><div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4"><div><p className="font-medium">Discovery readiness: {discoveryQuery.data?.readinessPercent ?? 0}%</p><p className="text-sm text-muted-foreground">Applying this interview updates draft revision {agent.draft?.revision ?? '—'} safely.</p></div><Button disabled={busy || !discoveryReady} onClick={() => discoveryMutation.mutate()}>{discoveryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply to draft</Button></div></CardContent></Card>
        </TabsContent>
        <TabsContent value="behavior">
          <Card><CardHeader><CardTitle>Professional role & boundaries</CardTitle><CardDescription>Tell the agent what it represents and how it should serve customers. Draft revision {agent.draft?.revision ?? '—'} prevents accidental overwrites.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="agent-role">Primary instruction</Label><Textarea id="agent-role" value={role} onChange={(e) => setRole(e.target.value)} rows={8} placeholder="You are the professional WhatsApp receptionist for..." /></div><Button disabled={busy || !agent.draft || role.trim().length < 10} onClick={() => draftMutation.mutate()}>{draftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft safely</Button></CardContent></Card>
        </TabsContent>
        <TabsContent value="skills">
          <Card><CardHeader><CardTitle>Capabilities and action safety</CardTitle><CardDescription>Read-only skills are safe by default. Customer-impacting actions remain confirmation-gated.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{agent.skills.map((skill) => <div key={skill.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium capitalize">{readableSkill(skill.skillKey)}</p><div className="mt-2 flex flex-wrap gap-2"><Badge className={riskTone[skill.riskLevel]}>{skill.riskLevel}</Badge>{skill.requiresConfirmation && <Badge variant="outline">Confirmation required</Badge>}</div></div><Button size="sm" variant={skill.enabled ? 'default' : 'outline'} disabled={busy || skill.riskLevel === 'CRITICAL'} onClick={() => skillMutation.mutate(skill)}>{skill.enabled ? 'Enabled' : 'Disabled'}</Button></div></div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="releases" className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" /> Create release</CardTitle><CardDescription>Freeze the current draft, skills and knowledge into an immutable version for evaluation.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="change-summary">What changed?</Label><Textarea id="change-summary" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="Added approved pricing answers and improved handover behavior" rows={5} /></div><Button disabled={busy || changeSummary.trim().length < 3} onClick={() => releaseMutation.mutate()}>{releaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}Create release</Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Release history</CardTitle><CardDescription>Draft creation never changes the live WhatsApp agent.</CardDescription></CardHeader><CardContent className="space-y-3">{agent.releases.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><MessageCircle className="mx-auto mb-3 h-8 w-8" />No releases yet.</div> : [...agent.releases].sort((a, b) => b.releaseNumber - a.releaseNumber).map((release) => <div key={release.id} className="flex items-start justify-between gap-4 rounded-xl border p-4"><div><p className="font-semibold">Release v{release.releaseNumber}</p><p className="mt-1 text-sm text-muted-foreground">{release.changeSummary || 'Imported training snapshot'}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(release.createdAt).toLocaleString()}</p></div><Badge variant={release.status === 'ACTIVE' ? 'default' : 'outline'}>{release.status.replace(/_/g, ' ')}</Badge></div>)}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
