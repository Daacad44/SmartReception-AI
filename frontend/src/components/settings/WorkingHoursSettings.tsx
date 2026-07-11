import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2 } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface DayHours {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
}

type WeeklyHours = Record<string, DayHours>;

interface AppointmentSettings {
  weeklyHours: WeeklyHours;
}

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_DAY: DayHours = { isOpen: true, openTime: '09:00', closeTime: '18:00', breakStart: null, breakEnd: null };

export function WorkingHoursSettings({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<WeeklyHours>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['appointment-settings'],
    queryFn: async () =>
      extractData<AppointmentSettings>(await api.get('/appointment-scheduling/settings')),
  });

  useEffect(() => {
    if (settings?.weeklyHours) {
      const filled: WeeklyHours = {};
      for (const { key } of DAYS) {
        filled[key] = { ...DEFAULT_DAY, ...(settings.weeklyHours[key] ?? {}) };
      }
      setHours(filled);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => api.put('/appointment-scheduling/settings', { weeklyHours: hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-settings'] });
      toast.success('Working hours saved');
    },
    onError: () => toast.error('Failed to save working hours'),
  });

  const updateDay = (key: string, patch: Partial<DayHours>) =>
    setHours((prev) => ({ ...prev, [key]: { ...DEFAULT_DAY, ...prev[key], ...patch } }));

  if (isLoading) return <LoadingState rows={7} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Weekly Working Hours
        </CardTitle>
        <CardDescription>
          The AI uses these hours to answer &quot;are you open?&quot; and to generate real appointment
          slots. Set a lunch break to block that window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const day = hours[key] ?? DEFAULT_DAY;
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <label className="flex w-32 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  disabled={readOnly}
                  onChange={(e) => updateDay(key, { isOpen: e.target.checked })}
                />
                {label}
              </label>
              {day.isOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    className="w-32"
                    value={day.openTime}
                    disabled={readOnly}
                    onChange={(e) => updateDay(key, { openTime: e.target.value })}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={day.closeTime}
                    disabled={readOnly}
                    onChange={(e) => updateDay(key, { closeTime: e.target.value })}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">Break</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={day.breakStart ?? ''}
                    disabled={readOnly}
                    onChange={(e) => updateDay(key, { breakStart: e.target.value || null })}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={day.breakEnd ?? ''}
                    disabled={readOnly}
                    onChange={(e) => updateDay(key, { breakEnd: e.target.value || null })}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Working Hours
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
