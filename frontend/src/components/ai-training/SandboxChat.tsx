import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare, ChevronDown, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SandboxSourceChunk {
  id: string;
  title: string;
  section: string | null;
  score: number;
  confidence: string;
}

interface SandboxSources {
  route?: string;
  categories?: string[];
  chunks?: SandboxSourceChunk[];
  embeddingMatchScore?: number;
  avgScore?: number;
  knowledgeChars?: number;
  promptChars?: number;
}

interface SandboxMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  confidence?: number;
  groundedConfidence?: number;
  hallucinationRisk?: number;
  missingKnowledge?: boolean;
  intent?: string | null;
  route?: string | null;
  modelUsed?: string | null;
  provider?: string | null;
  retrievedChunkCount?: number | null;
  embeddingMatchScore?: number | null;
  latencyMs?: number | null;
  sources?: SandboxSources | null;
}

interface SandboxSession {
  id: string;
  messages: SandboxMessage[];
  version?: { versionNumber: number };
}

interface SandboxChatProps {
  versionId: string;
  readOnly?: boolean;
}

const pct = (v?: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function riskTone(risk?: number | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (risk == null) return 'outline';
  if (risk >= 0.5) return 'destructive';
  if (risk >= 0.25) return 'secondary';
  return 'default';
}

function AssistantDiagnostics({ msg }: { msg: SandboxMessage }) {
  const [open, setOpen] = useState(false);
  const sources = msg.sources ?? {};
  const chunks = sources.chunks ?? [];

  return (
    <div className="mt-2 space-y-2">
      {msg.missingKnowledge ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          No grounded answer — human handover &amp; knowledge-gap logged
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Grounded in knowledge base
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Badge variant="outline">Confidence {pct(msg.confidence)}</Badge>
        <Badge variant="outline">Grounded {pct(msg.groundedConfidence)}</Badge>
        <Badge variant={riskTone(msg.hallucinationRisk)}>Hallucination {pct(msg.hallucinationRisk)}</Badge>
        {msg.latencyMs != null && <Badge variant="outline">{msg.latencyMs} ms</Badge>}
        {msg.modelUsed && <Badge variant="outline">{msg.modelUsed}</Badge>}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Knowledge source ({msg.retrievedChunkCount ?? chunks.length} chunk
        {(msg.retrievedChunkCount ?? chunks.length) === 1 ? '' : 's'})
      </button>

      {open && (
        <div className="space-y-2 rounded-md border bg-background/60 p-2 text-[11px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <span>Route: <span className="text-foreground">{msg.route ?? sources.route ?? '—'}</span></span>
            <span>Intent: <span className="text-foreground">{msg.intent ?? '—'}</span></span>
            <span>
              Embedding match:{' '}
              <span className="text-foreground">
                {(msg.embeddingMatchScore ?? sources.embeddingMatchScore ?? 0).toFixed(3)}
              </span>
            </span>
            <span>Provider: <span className="text-foreground">{msg.provider ?? '—'}</span></span>
          </div>
          {chunks.length > 0 ? (
            <div className="space-y-1">
              {chunks.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded bg-muted/60 px-2 py-1">
                  <span className="truncate">
                    <span className="font-medium">{c.title}</span>
                    {c.section && <span className="text-muted-foreground"> · {c.section}</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{c.score.toFixed(3)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No knowledge chunks retrieved for this message.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function SandboxChat({ versionId, readOnly }: SandboxChatProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ['sandbox-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const response = await api.get(`/ai-training-mgmt/sandbox/sessions/${sessionId}`);
      return extractData<SandboxSession>(response);
    },
    enabled: Boolean(sessionId),
  });

  const createSession = useMutation({
    mutationFn: async () => {
      const response = await api.post('/ai-training-mgmt/sandbox/sessions', { versionId });
      return extractData<{ id: string }>(response);
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ['sandbox-session', data.id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) throw new Error('No session');
      const response = await api.post(`/ai-training-mgmt/sandbox/sessions/${sessionId}/messages`, {
        content,
      });
      return extractData<SandboxMessage>(response);
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['sandbox-session', sessionId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const messages = session?.messages ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Sandbox Validation
          {session?.version && <Badge variant="outline">v{session.version.versionNumber}</Badge>}
        </CardTitle>
        {!sessionId && !readOnly && (
          <Button size="sm" onClick={() => createSession.mutate()} disabled={createSession.isPending}>
            Start Session
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading session…</p>}
          {!sessionId && (
            <p className="text-sm text-muted-foreground">
              Start a sandbox session to validate this AI version. It behaves exactly like the live
              production AI — grounded only in the approved knowledge base. Results never reach real
              customers.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 text-sm ${
                msg.role === 'USER' ? 'ml-8 bg-primary/10' : 'mr-8 bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'ASSISTANT' && <AssistantDiagnostics msg={msg} />}
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="mr-8 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Thinking…</div>
          )}
        </div>
        {sessionId && !readOnly && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) sendMessage.mutate(message.trim());
            }}
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Test as a customer would… (e.g. Asc, working hours, pricing)"
              disabled={sendMessage.isPending}
            />
            <Button type="submit" disabled={sendMessage.isPending || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
