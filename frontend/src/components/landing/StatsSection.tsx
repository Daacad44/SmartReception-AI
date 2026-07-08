import { Users, MessageSquare, ShieldCheck, Clock } from 'lucide-react';
import { CountUp } from './CountUp';

const STATS = [
  {
    icon: Users,
    value: <CountUp target={100} suffix="+" />,
    label: 'Businesses Trust Us',
    desc: 'Trusted by businesses across multiple industries.',
  },
  {
    icon: MessageSquare,
    value: <CountUp target={100} suffix="+" />,
    label: 'AI Conversations',
    desc: 'AI-powered customer conversations handled successfully.',
  },
  {
    icon: ShieldCheck,
    value: <CountUp target={99.9} decimals={1} suffix="%" />,
    label: 'System Uptime',
    desc: 'Reliable cloud infrastructure with enterprise-grade availability.',
  },
  {
    icon: Clock,
    value: '24/7',
    label: 'AI Working For You',
    desc: 'Your AI receptionist is always available to answer customers.',
  },
];

export function StatsSection() {
  return (
    <section className="reveal px-4 pb-20 pt-2 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ icon: Icon, value, label, desc }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-gold/35 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-gold/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold/[0.12] transition-transform duration-300 group-hover:scale-110">
              <Icon className="h-[22px] w-[22px] text-brand-gold" />
            </div>
            <div className="text-3xl font-extrabold text-white">{value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">{label}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-muted">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
