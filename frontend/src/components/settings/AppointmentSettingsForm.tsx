import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCog, Loader2 } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface AppointmentSettings {
  timezone: string;
  slotDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxDailyBookings: number | null;
  allowSameDay: boolean;
}

const FIELDS: Array<{ key: keyof AppointmentSettings; label: string; hint: string }> = [
  { key: 'slotDurationMinutes', label: 'Appointment duration (min)', hint: 'Length of each slot' },
  { key: 'bufferBeforeMinutes', label: 'Preparation buffer (min)', hint: 'Gap before each appointment' },
  { key: 'bufferAfterMinutes', label: 'Cleanup buffer (min)', hint: 'Gap after each appointment' },
  { key: 'minNoticeMinutes', label: 'Minimum notice (min)', hint: 'Earliest a customer can book' },
  { key: 'maxAdvanceDays', label: 'Max advance (days)', hint: 'How far ahead bookings are allowed' },
  { key: 'maxDailyBookings', label: 'Max daily bookings', hint: 'Blank = unlimited' },
];

export function AppointmentSettingsForm({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<AppointmentSettings>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['appointment-settings'],
    queryFn: async () =>
      extractData<AppointmentSettings>(await api.get('/appointment-scheduling/settings')),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        timezone: form.timezone,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        bufferBeforeMinutes: Number(form.bufferBeforeMinutes),
        bufferAfterMinutes: Number(form.bufferAfterMinutes),
        minNoticeMinutes: Number(form.minNoticeMinutes),
        maxAdvanceDays: Number(form.maxAdvanceDays),
        maxDailyBookings:
          form.maxDailyBookings === null || form.maxDailyBookings === undefined || (form.maxDailyBookings as unknown) === ''
            ? null
            : Number(form.maxDailyBookings),
        allowSameDay: form.allowSameDay ?? true,
      };
      return api.put('/appointment-scheduling/settings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-settings'] });
      toast.success('Appointment settings saved');
    },
    onError: () => toast.error('Failed to save appointment settings'),
  });

  if (isLoading) return <LoadingState rows={4} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCog className="h-5 w-5" /> Appointment Settings
        </CardTitle>
        <CardDescription>
          Slot rules the appointment engine enforces for every booking. Separate from working hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Timezone (IANA)</Label>
            <Input
              value={form.timezone ?? ''}
              disabled={readOnly}
              placeholder="Africa/Mogadishu"
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input
                type="number"
                min={0}
                value={(form[f.key] as number | null) ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    [f.key]: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.allowSameDay ?? true}
            disabled={readOnly}
            onChange={(e) => setForm((p) => ({ ...p, allowSameDay: e.target.checked }))}
          />
          Allow same-day bookings
        </label>
        {!readOnly && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Appointment Settings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
