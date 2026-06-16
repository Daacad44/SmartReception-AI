import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppointments } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  confirmed: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  cancelled: 'bg-danger/10 text-danger border-danger/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function AppointmentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 5, 16));
  const [selectedDate, setSelectedDate] = useState('2025-06-17');
  const { data: appointments } = useAppointments();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const daysWithAppointments = new Set(
    appointments?.map((a) => a.date) ?? []
  );

  const selectedAppointments = appointments?.filter((a) => a.date === selectedDate) ?? [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Manage and schedule customer appointments</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const ds = dateStr(day);
                const hasApt = daysWithAppointments.has(ds);
                const isSelected = ds === selectedDate;
                const isToday = ds === '2025-06-16';

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(ds)}
                    className={cn(
                      'relative flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                      isSelected && 'bg-accent text-white',
                      !isSelected && 'hover:bg-muted',
                      isToday && !isSelected && 'ring-2 ring-accent/30'
                    )}
                  >
                    {day}
                    {hasApt && (
                      <span
                        className={cn(
                          'absolute bottom-1 h-1 w-1 rounded-full',
                          isSelected ? 'bg-white' : 'bg-accent'
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            {selectedAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled</p>
            ) : (
              <div className="space-y-3">
                {selectedAppointments.map((apt) => (
                  <div key={apt.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Clock className="h-3 w-3" />
                        {apt.time}
                      </span>
                      <Badge className={`text-[10px] ${statusColors[apt.status]}`}>
                        {apt.status}
                      </Badge>
                    </div>
                    <p className="text-sm">{apt.service}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {apt.customerName}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{apt.duration} min</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 font-semibold">Upcoming Appointments</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {appointments?.slice(0, 6).map((apt) => (
              <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <span className="text-[10px] font-medium">
                    {new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-sm font-bold leading-none">
                    {new Date(apt.date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{apt.customerName}</p>
                  <p className="text-xs text-muted-foreground">{apt.service} · {apt.time}</p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${statusColors[apt.status]}`}>
                  {apt.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
