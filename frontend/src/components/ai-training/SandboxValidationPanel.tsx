import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, XCircle, Lightbulb } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type ChecklistState = 'COMPLETE' | 'PENDING' | 'FAILED';

interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  detail: string;
}

interface ReadinessChecklist {
  items: ChecklistItem[];
  completed: number;
  total: number;
  failed: number;
  progress: number;
}

interface KnowledgeGap {
  id: string;
  question: string;
  category: string | null;
  intent: string | null;
  frequency: number;
  recommendation: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

const STATE_ICON: Record<ChecklistState, JSX.Element> = {
  COMPLETE: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  PENDING: <Circle className="h-4 w-4 text-muted-foreground" />,
  FAILED: <XCircle className="h-4 w-4 text-destructive" />,
};

const STATE_BADGE: Record<ChecklistState, 'default' | 'secondary' | 'destructive'> = {
  COMPLETE: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
};

export function SandboxValidationPanel({ versionId }: { versionId?: string }) {
  const queryClient = useQueryClient();

  const checklistQuery = useQuery({
    queryKey: ['sandbox-readiness', versionId],
    queryFn: async () => {
      const response = await api.get('/ai-training-mgmt/readiness', {
        params: versionId ? { versionId } : undefined,
      });
      return extractData<ReadinessChecklist>(response);
    },
    retry: false,
  });

  const gapsQuery = useQuery({
    queryKey: ['knowledge-gaps'],
    queryFn: async () => {
      const response = await api.get('/ai-training-mgmt/knowledge-gaps', {
        params: { status: 'OPEN' },
      });
      return extractData<KnowledgeGap[]>(response);
    },
    retry: false,
  });

  const updateGap = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'RESOLVED' | 'DISMISSED' }) => {
      const response = await api.patch(`/ai-training-mgmt/knowledge-gaps/${id}`, { status });
      return extractData<KnowledgeGap>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-gaps'] });
      queryClient.invalidateQueries({ queryKey: ['sandbox-readiness'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const checklist = checklistQuery.data;
  const gaps = gapsQuery.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Readiness Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklistQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {checklist && (
            <>
              <div className="flex items-center gap-3">
                <Progress value={checklist.progress} className="h-2 flex-1" />
                <span className="text-sm font-medium">
                  {checklist.completed}/{checklist.total}
                </span>
              </div>
              <ul className="space-y-1.5">
                {checklist.items.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {STATE_ICON[item.state]}
                      <span title={item.detail}>{item.label}</span>
                    </span>
                    <Badge variant={STATE_BADGE[item.state]} className="text-[10px]">
                      {item.state}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Knowledge Gaps</CardTitle>
          {gaps.length > 0 && <Badge variant="destructive">{gaps.length} open</Badge>}
        </CardHeader>
        <CardContent className="space-y-2">
          {gapsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!gapsQuery.isLoading && gaps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No missing-knowledge reports. Every tested question was answered from the knowledge base.
            </p>
          )}
          {gaps.map((gap) => (
            <div key={gap.id} className="rounded-md border p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{gap.question}</span>
                <Badge variant="outline" className="shrink-0">
                  ×{gap.frequency}
                </Badge>
              </div>
              {gap.recommendation && (
                <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                  {gap.recommendation}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={updateGap.isPending}
                  onClick={() => updateGap.mutate({ id: gap.id, status: 'RESOLVED' })}
                >
                  Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={updateGap.isPending}
                  onClick={() => updateGap.mutate({ id: gap.id, status: 'DISMISSED' })}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
