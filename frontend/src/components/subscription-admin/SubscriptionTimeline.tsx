import { Badge } from '@/components/ui/badge';

interface TimelineItem {
  id: string;
  action: string;
  createdAt: string;
  performedByEmail?: string | null;
  notes?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

interface SubscriptionTimelineProps {
  items: TimelineItem[];
}

const ACTION_COLORS: Record<string, string> = {
  ASSIGNED: 'border-emerald-500/40 text-emerald-400',
  EXTENDED: 'border-blue-500/40 text-blue-400',
  EXPIRED: 'border-red-500/40 text-red-400',
  LOCKED: 'border-amber-500/40 text-amber-400',
  UNLOCKED: 'border-cyan-500/40 text-cyan-400',
  SUSPENDED: 'border-orange-500/40 text-orange-400',
};

export function SubscriptionTimeline({ items }: SubscriptionTimelineProps) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-800" />
      {items.map((item) => (
        <div key={item.id} className="relative flex gap-4 pb-6 pl-8">
          <div className="absolute left-1 top-1 h-5 w-5 rounded-full border-2 border-amber-500/50 bg-slate-950" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={ACTION_COLORS[item.action] ?? ''}>
                {item.action}
              </Badge>
              <span className="text-xs text-slate-500">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            {item.performedByEmail && (
              <p className="mt-1 text-xs text-slate-400">by {item.performedByEmail}</p>
            )}
            {item.notes && <p className="mt-1 text-sm text-slate-300">{item.notes}</p>}
            {(item.oldValue || item.newValue) && (
              <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                {item.oldValue && (
                  <pre className="overflow-x-auto rounded bg-slate-900/80 p-2">
                    {JSON.stringify(item.oldValue, null, 2)}
                  </pre>
                )}
                {item.newValue && (
                  <pre className="overflow-x-auto rounded bg-slate-900/80 p-2">
                    {JSON.stringify(item.newValue, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
