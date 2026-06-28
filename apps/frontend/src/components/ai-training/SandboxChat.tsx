import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SandboxMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  confidence?: number;
  hallucinationRisk?: number;
  missingKnowledge?: boolean;
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
          Sandbox Testing
          {session?.version && (
            <Badge variant="outline">v{session.version.versionNumber}</Badge>
          )}
        </CardTitle>
        {!sessionId && !readOnly && (
          <Button size="sm" onClick={() => createSession.mutate()} disabled={createSession.isPending}>
            Start Session
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading session…</p>}
          {!sessionId && (
            <p className="text-sm text-muted-foreground">
              Start a sandbox session to test this AI version. Results do not affect live customers.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 text-sm ${
                msg.role === 'USER' ? 'ml-8 bg-primary/10' : 'mr-8 bg-muted'
              }`}
            >
              <p>{msg.content}</p>
              {msg.role === 'ASSISTANT' && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {msg.confidence != null && <span>Confidence: {Math.round(msg.confidence * 100)}%</span>}
                  {msg.missingKnowledge && <Badge variant="destructive">Missing knowledge</Badge>}
                </div>
              )}
            </div>
          ))}
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
              placeholder="Ask a test question…"
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
