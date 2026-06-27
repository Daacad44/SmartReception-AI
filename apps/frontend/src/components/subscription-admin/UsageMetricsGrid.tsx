import { Progress } from '@/components/ui/progress';

interface UsageMetric {
  used: number;
  limit: number;
  percent: number;
}

interface UsageMetricsGridProps {
  usage: {
    conversations: UsageMetric;
    customers: UsageMetric;
    users: UsageMetric;
    knowledgeBases: UsageMetric;
    appointments: UsageMetric;
    campaigns: UsageMetric;
    broadcasts: UsageMetric;
    storageMb: UsageMetric;
    whatsappNumbers: UsageMetric;
  };
}

const METRICS: Array<{ key: keyof UsageMetricsGridProps['usage']; label: string }> = [
  { key: 'conversations', label: 'Conversations' },
  { key: 'customers', label: 'Customers' },
  { key: 'users', label: 'Users' },
  { key: 'knowledgeBases', label: 'Knowledge Base' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'broadcasts', label: 'Broadcast' },
  { key: 'storageMb', label: 'Storage (MB)' },
  { key: 'whatsappNumbers', label: 'WhatsApp Numbers' },
];

export function UsageMetricsGrid({ usage }: UsageMetricsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {METRICS.map(({ key, label }) => {
        const metric = usage[key];
        return (
          <div
            key={key}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-amber-500/30"
          >
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">{label}</span>
              <span className="font-medium text-slate-100">
                {metric.used.toLocaleString()} / {metric.limit.toLocaleString()}
              </span>
            </div>
            <Progress value={metric.percent} className="h-2 bg-slate-800" />
            <p className="mt-1 text-xs text-slate-500">{metric.percent}% used</p>
          </div>
        );
      })}
    </div>
  );
}
