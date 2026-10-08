import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, History, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

type SystemRelease = { id: string; version: string; title: string; summary: string; releaseNotes: string[]; isMandatory: boolean; publishedAt: string };
type UpdateStatus = { currentVersion: string; latestVersion: string; updateAvailable: boolean; available: SystemRelease[]; history: Array<{ id: string; fromVersion: string; toVersion: string; installedAt: string; release: SystemRelease }> };

export function SystemUpdatesSettings({ canApply }: { canApply: boolean }) {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['system-updates'], queryFn: async () => extractData<UpdateStatus>(await api.get('/system-updates')), staleTime: 30_000 });
  const apply = useMutation({
    mutationFn: () => api.post('/system-updates/apply'),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['system-updates'] }); toast.success('System update completed successfully'); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (status.isPending) return <LoadingState rows={5} />;
  if (status.isError || !status.data) return <ErrorState message={status.isError ? getErrorMessage(status.error) : 'Unable to load updates.'} onRetry={() => status.refetch()} />;
  return <div className="space-y-5">
    <Card className={status.data.updateAvailable ? 'border-amber-300' : 'border-emerald-300'}><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2">{status.data.updateAvailable ? <Download className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />} System Updates</CardTitle><CardDescription>Review and apply verified SmartReception updates for this business workspace.</CardDescription></div><Badge variant="outline">Installed v{status.data.currentVersion}</Badge></div></CardHeader><CardContent className="space-y-4">
      {status.data.updateAvailable ? <><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><strong>{status.data.available.length} update(s) available</strong><p className="mt-1">Latest version: v{status.data.latestVersion}. Updates are applied in version order and recorded in the audit log.</p></div>{status.data.available.map((release) => <div key={release.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">v{release.version} — {release.title}</h3><p className="mt-1 text-sm text-muted-foreground">{release.summary}</p></div>{release.isMandatory && <Badge className="bg-red-100 text-red-700">Security update</Badge>}</div><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{release.releaseNotes.map((note) => <li key={note}>{note}</li>)}</ul></div>)}{canApply && <Button disabled={apply.isPending} onClick={() => apply.mutate()}>{apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Update System</Button>}</> : <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900"><ShieldCheck className="h-6 w-6" /><div><strong>Your system is up to date</strong><p className="text-sm">SmartReception v{status.data.currentVersion} is installed for this workspace.</p></div></div>}
      <Button variant="outline" size="sm" onClick={() => status.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Check for updates</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Version history</CardTitle><CardDescription>All updates applied to this business workspace.</CardDescription></CardHeader><CardContent className="space-y-3">{status.data.history.length ? status.data.history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><strong>v{item.toVersion}</strong><p className="text-muted-foreground">{item.release.title}</p></div><span className="text-muted-foreground">{new Date(item.installedAt).toLocaleString()}</span></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No workspace updates have been applied yet.</p>}</CardContent></Card>
  </div>;
}
