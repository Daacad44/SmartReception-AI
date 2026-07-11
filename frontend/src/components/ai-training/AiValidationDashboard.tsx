import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Brain, FileCheck2, ShieldCheck } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CoverageCategory {
  key: string;
  label: string;
  coverage: number;
  status: 'GOOD' | 'WEAK' | 'MISSING';
  count: number;
}
interface Coverage {
  categories: CoverageCategory[];
  healthPercent: number;
  weakCategories: string[];
  recommendedTraining: string[];
  totalChunks: number;
  openKnowledgeGaps: number;
}
interface ValidationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}
interface BusinessValidation {
  checks: ValidationCheck[];
  warnings: string[];
  ready: boolean;
}
interface MemoryInspector {
  business: { name: string | null; aiStatus: string };
  profile: Record<string, unknown> | null;
  services: { name: string; price: number | null }[];
  appointmentRules: Record<string, number> | null;
  knowledge: { documents: number; indexed: number; faqs: number; embeddings: number };
  versions: Record<string, number | string | null>;
  lastTrainedAt: string | null;
  lastDeployedAt: string | null;
}
interface ValidationReport {
  businessName: string | null;
  knowledgeHealth: number;
  confidenceAverage: number | null;
  readinessProgress: number;
  overallReadiness: number;
  deploymentRecommendation: string;
  result: 'PASS' | 'FAIL';
}

const COVERAGE_TONE: Record<CoverageCategory['status'], string> = {
  GOOD: 'bg-emerald-500',
  WEAK: 'bg-amber-500',
  MISSING: 'bg-destructive',
};

function useValidationQuery<T>(key: string, url: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => extractData<T>(await api.get(url)),
    retry: false,
  });
}

export function AiValidationDashboard({
  versionId,
  readOnly,
}: {
  versionId?: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const coverage = useValidationQuery<Coverage>('ai-coverage', '/ai-training-mgmt/coverage');
  const validation = useValidationQuery<BusinessValidation>(
    'ai-business-validation',
    '/ai-training-mgmt/business-validation'
  );
  const memory = useValidationQuery<MemoryInspector>('ai-memory', '/ai-training-mgmt/memory-inspector');
  const report = useValidationQuery<ValidationReport>('ai-report', '/ai-training-mgmt/validation-report');

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('No sandbox version to submit');
      return extractData(
        await api.post('/ai-training-mgmt/deployments/request', {
          versionId,
          deploymentSummary: 'Sandbox validation passed — submitted for deployment review.',
        })
      );
    },
    onSuccess: () => {
      toast.success('Submitted for Deployment Review. A Super Admin must approve before production.');
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const c = coverage.data;
  const v = validation.data;
  const m = memory.data;
  const r = report.data;

  return (
    <div className="space-y-4">
      {/* Knowledge Coverage — Part 10 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="h-4 w-4" /> Knowledge Coverage
          </CardTitle>
          {c && (
            <Badge variant={c.healthPercent >= 70 ? 'default' : 'secondary'}>
              Health {c.healthPercent}%
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {coverage.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {c?.categories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0">{cat.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div className={`h-full ${COVERAGE_TONE[cat.status]}`} style={{ width: `${cat.coverage}%` }} />
              </div>
              <span className="w-10 text-right text-xs text-muted-foreground">{cat.coverage}%</span>
            </div>
          ))}
          {c && c.recommendedTraining.length > 0 && (
            <div className="mt-3 rounded-md border bg-muted/40 p-2 text-xs">
              <p className="mb-1 font-medium">Recommended training</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {c.recommendedTraining.slice(0, 6).map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Business Validation — Part 12 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Business Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {validation.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {v?.checks.map((chk) => (
              <div key={chk.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  {chk.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {chk.label}
                </span>
                <span className="text-xs text-muted-foreground">{chk.detail}</span>
              </div>
            ))}
            {v && !v.ready && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Resolve warnings before testing for best results.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Memory Inspector — Part 7 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" /> AI Memory Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {memory.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {m && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">AI Status</dt>
                <dd className="text-right">{m.business.aiStatus}</dd>
                <dt className="text-muted-foreground">Documents</dt>
                <dd className="text-right">{m.knowledge.documents} ({m.knowledge.indexed} indexed)</dd>
                <dt className="text-muted-foreground">FAQs</dt>
                <dd className="text-right">{m.knowledge.faqs}</dd>
                <dt className="text-muted-foreground">Embeddings</dt>
                <dd className="text-right">{m.knowledge.embeddings}</dd>
                <dt className="text-muted-foreground">Services</dt>
                <dd className="text-right">{m.services.length}</dd>
                <dt className="text-muted-foreground">Sandbox version</dt>
                <dd className="text-right">v{m.versions.sandboxVersion ?? '—'}</dd>
                <dt className="text-muted-foreground">Production version</dt>
                <dd className="text-right">v{m.versions.productionVersion ?? '—'}</dd>
                <dt className="text-muted-foreground">Last trained</dt>
                <dd className="text-right">{m.lastTrainedAt ? new Date(m.lastTrainedAt).toLocaleDateString() : '—'}</dd>
                <dt className="text-muted-foreground">Last deployed</dt>
                <dd className="text-right">{m.lastDeployedAt ? new Date(m.lastDeployedAt).toLocaleDateString() : '—'}</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Final Validation Report — Part 20 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Validation Report</CardTitle>
          {r && (
            <Badge variant={r.result === 'PASS' ? 'default' : 'destructive'}>{r.result}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {report.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {r && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Knowledge Health" value={`${r.knowledgeHealth}%`} />
                <Metric label="Avg Confidence" value={r.confidenceAverage != null ? `${r.confidenceAverage}%` : '—'} />
                <Metric label="Readiness" value={`${r.readinessProgress}%`} />
                <Metric label="Overall" value={`${r.overallReadiness}%`} />
              </div>
              <Progress value={r.overallReadiness} className="h-2" />
              <p className="text-sm text-muted-foreground">{r.deploymentRecommendation}</p>
              {!readOnly && (
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    disabled={r.result !== 'PASS' || submitReview.isPending || !versionId}
                    onClick={() => submitReview.mutate()}
                  >
                    Done — Submit for Deployment Review
                  </Button>
                </div>
              )}
              {r.result !== 'PASS' && (
                <p className="text-xs text-muted-foreground">
                  Production stays locked until every validation gate passes and a Super Admin approves.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
