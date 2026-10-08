import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Gauge, Network, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { AgentGovernancePolicy, AgentRolloutConfig, AgentRoutingRule } from '@/lib/agent-studio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/LoadingState';

export function AgentGovernancePanel({ agentId, canEdit }: { agentId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const governance = useQuery({ queryKey: ['ai-agent-studio', agentId, 'governance'], queryFn: async () => extractData<AgentGovernancePolicy>(await api.get(`/ai-agent-studio/${agentId}/governance`)) });
  const rollout = useQuery({ queryKey: ['ai-agent-studio', agentId, 'rollout'], queryFn: async () => extractData<AgentRolloutConfig>(await api.get(`/ai-agent-studio/${agentId}/rollout`)) });
  const routing = useQuery({ queryKey: ['ai-agent-studio', 'routing-rules'], queryFn: async () => extractData<AgentRoutingRule[]>(await api.get('/ai-agent-studio/routing-rules')) });
  const [traffic, setTraffic] = useState(0);
  const [killSwitch, setKillSwitch] = useState(false);
  useEffect(() => { if (rollout.data) { setTraffic(rollout.data.trafficPercentage); setKillSwitch(rollout.data.killSwitch); } }, [rollout.data]);
  const saveRollout = useMutation({
    mutationFn: () => api.put(`/ai-agent-studio/${agentId}/rollout`, { enabled: traffic > 0, trafficPercentage: traffic, killSwitch, fallbackToLegacy: true, maxFailureRate: rollout.data?.maxFailureRate ?? 10, maxHandoffRate: rollout.data?.maxHandoffRate ?? 40, minConfidence: rollout.data?.minConfidence ?? 50, observationWindowMins: rollout.data?.observationWindowMins ?? 60 }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['ai-agent-studio', agentId, 'rollout'] }); toast.success('Production rollout controls saved'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const exportEvidence = async () => {
    try { const response = await api.get(`/ai-agent-studio/${agentId}/governance/export`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `agent-${agentId}-governance.json`; link.click(); URL.revokeObjectURL(url); } catch (error) { toast.error(getErrorMessage(error)); }
  };
  if (governance.isPending || rollout.isPending || routing.isPending) return <LoadingState rows={5} />;
  return <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Governance policy</CardTitle><CardDescription>Enforced safety, approval separation and evidence retention.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="flex justify-between"><span>Minimum confidence</span><strong>{Math.round((governance.data?.minimumConfidence ?? 0) * 100)}%</strong></div>
        <div className="flex justify-between"><span>Maximum hallucination risk</span><strong>{Math.round((governance.data?.maximumHallucinationRisk ?? 0) * 100)}%</strong></div>
        <div className="flex justify-between"><span>Separate release approver</span><Badge variant="outline">{governance.data?.requireSeparateApprover ? 'Required' : 'Optional'}</Badge></div>
        <div className="flex justify-between"><span>Execution retention</span><strong>{governance.data?.executionRetentionDays} days</strong></div>
        <Button variant="outline" onClick={exportEvidence}><Download className="mr-2 h-4 w-4" /> Export compliance evidence</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Production rollout</CardTitle><CardDescription>Deterministic traffic allocation with legacy fallback and emergency stop.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-lg border p-3"><strong className="block text-xl">{rollout.data?.health.sampleSize ?? 0}</strong>Samples</div><div className="rounded-lg border p-3"><strong className="block text-xl">{rollout.data?.health.failureRate ?? 0}%</strong>Failures</div><div className="rounded-lg border p-3"><strong className="block text-xl">{rollout.data?.health.averageConfidence ?? 0}%</strong>Confidence</div></div>
        {rollout.data && !rollout.data.health.healthy && <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> Threshold breached: {rollout.data.health.alerts.join(', ')}</div>}
        <div><Label htmlFor="traffic">Agent Studio traffic: {traffic}%</Label><Input id="traffic" className="mt-2" type="range" min="0" max="100" step="5" value={traffic} disabled={!canEdit} onChange={(event) => setTraffic(Number(event.target.value))} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={killSwitch} disabled={!canEdit} onChange={(event) => setKillSwitch(event.target.checked)} /> Emergency kill switch</label>
        {canEdit && <Button disabled={saveRollout.isPending} onClick={() => saveRollout.mutate()}>Save rollout controls</Button>}
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> Multi-agent routing</CardTitle><CardDescription>Priority-ordered intent and keyword routing; exactly one enabled fallback is allowed.</CardDescription></CardHeader><CardContent className="space-y-3">{routing.data?.length ? routing.data.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><strong>{rule.name}</strong><p className="text-muted-foreground">{rule.agent.name} · priority {rule.priority}</p></div><div className="flex gap-2">{rule.isFallback && <Badge>Fallback</Badge>}<Badge variant="outline">{rule.enabled ? 'Enabled' : 'Disabled'}</Badge></div></div>) : <p className="py-5 text-center text-sm text-muted-foreground">No routing rules yet. API-managed agents continue through the default active WhatsApp agent.</p>}</CardContent></Card>
  </div>;
}
