import { Clock, User, Star, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/lib/entities';

export const appointmentStatusStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400',
  missed: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
  cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/30 dark:text-gray-400',
  no_show: 'bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400',
};

const priorityStyles: Record<string, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-amber-600',
  URGENT: 'text-red-600',
};

interface AppointmentCardProps {
  appointment: Appointment;
  compact?: boolean;
  onView: (id: string) => void;
  onEdit?: (apt: Appointment) => void;
  actions?: React.ReactNode;
}

export function AppointmentCard({ appointment: apt, compact, onView, onEdit, actions }: AppointmentCardProps) {
  return (
    <div
      className={cn(
        'group rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-accent/40 hover:shadow-md',
        compact && 'flex items-start gap-4'
      )}
    >
      <div className={cn('flex-1 space-y-3', compact && 'min-w-0')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{apt.customerName}</p>
            <p className="truncate text-sm text-muted-foreground">{apt.service}</p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px] capitalize', appointmentStatusStyles[apt.status])}>
            {apt.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span>{apt.date} · {apt.time}</span>
          </div>
          {apt.assignedStaff && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{apt.assignedStaff}</span>
            </div>
          )}
          {apt.customerType && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize">{apt.customerType.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
          )}
          {apt.priority && (
            <div className="flex items-center gap-2">
              <Star className={cn('h-3.5 w-3.5 shrink-0', priorityStyles[apt.priority])} />
              <span className={cn('text-xs font-medium uppercase', priorityStyles[apt.priority])}>
                {apt.priority} priority
              </span>
            </div>
          )}
        </div>

        {!compact && apt.duration > 0 && (
          <p className="text-xs text-muted-foreground">{apt.duration} min duration</p>
        )}
      </div>

      <div className={cn('flex flex-wrap gap-1.5', compact ? 'shrink-0 flex-col' : 'mt-1 pt-2 border-t')}>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onView(apt.id)}>
          Details
        </Button>
        {onEdit && apt.status !== 'cancelled' && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onEdit(apt)}>
            Edit
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
