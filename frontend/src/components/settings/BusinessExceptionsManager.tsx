import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Loader2, Plus, Trash2 } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface BusinessException {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  note?: string | null;
}

const TYPES = [
  'NATIONAL_HOLIDAY',
  'RELIGIOUS_HOLIDAY',
  'EMERGENCY_CLOSURE',
  'MAINTENANCE',
  'VACATION',
  'SPECIAL_HOURS',
  'HALF_DAY',
  'TEMPORARY_CLOSURE',
];

const LABELS: Record<string, string> = {
  NATIONAL_HOLIDAY: 'National Holiday',
  RELIGIOUS_HOLIDAY: 'Religious Holiday',
  EMERGENCY_CLOSURE: 'Emergency Closure',
  MAINTENANCE: 'Maintenance',
  VACATION: 'Vacation',
  SPECIAL_HOURS: 'Special Hours',
  HALF_DAY: 'Half Day',
  TEMPORARY_CLOSURE: 'Temporary Closure',
};

const EMPTY = {
  title: '',
  type: 'NATIONAL_HOLIDAY',
  startDate: '',
  endDate: '',
  isClosed: true,
  openTime: '',
  closeTime: '',
  note: '',
};

export function BusinessExceptionsManager({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ ...EMPTY });

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['business-exceptions'],
    queryFn: async () =>
      extractData<BusinessException[]>(await api.get('/appointment-scheduling/exceptions')),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: draft.title,
        type: draft.type,
        startDate: draft.startDate,
        endDate: draft.endDate || undefined,
        isClosed: draft.isClosed,
        openTime: draft.isClosed ? undefined : draft.openTime || undefined,
        closeTime: draft.isClosed ? undefined : draft.closeTime || undefined,
        note: draft.note || undefined,
      };
      return api.post('/appointment-scheduling/exceptions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-exceptions'] });
      setDraft({ ...EMPTY });
      toast.success('Exception added');
    },
    onError: () => toast.error('Failed to add exception. Check the dates and hours.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/appointment-scheduling/exceptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-exceptions'] });
      toast.success('Exception removed');
    },
    onError: () => toast.error('Failed to remove exception'),
  });

  if (isLoading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5" /> Business Exceptions
          </CardTitle>
          <CardDescription>
            Holidays, closures and special hours that override the weekly schedule. The AI never
            books on these days and tells customers when you are closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {exceptions && exceptions.length > 0 ? (
            exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {ex.title}{' '}
                    <span className="text-xs text-muted-foreground">({LABELS[ex.type] ?? ex.type})</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ex.startDate?.slice(0, 10)}
                    {ex.endDate ? ` → ${ex.endDate.slice(0, 10)}` : ''} ·{' '}
                    {ex.isClosed ? 'Closed' : `Open ${ex.openTime}–${ex.closeTime}`}
                  </p>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(ex.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No exceptions configured yet.</p>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Exception</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={draft.title}
                  placeholder="Eid al-Fitr"
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isClosed}
                onChange={(e) => setDraft((d) => ({ ...d, isClosed: e.target.checked }))}
              />
              Closed all day
            </label>
            {!draft.isClosed && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Open time</Label>
                  <Input
                    type="time"
                    value={draft.openTime}
                    onChange={(e) => setDraft((d) => ({ ...d, openTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Close time</Label>
                  <Input
                    type="time"
                    value={draft.closeTime}
                    onChange={(e) => setDraft((d) => ({ ...d, closeTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !draft.title || !draft.startDate}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Exception
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
