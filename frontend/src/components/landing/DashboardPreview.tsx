import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Wallet,
  Users,
  BarChart3,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { SectionHeading, GlowOrb } from './shared';

const KPIS = [
  { label: 'Revenue', value: '$24.5K', delta: '▲ 19.7%' },
  { label: 'Conversations', value: '12,456', delta: '▲ 18.2%' },
  { label: 'Appointments', value: '1,243', delta: '▲ 22.4%' },
  { label: 'Leads', value: '3,456', delta: '▲ 26.1%' },
];

const CHANNELS = [
  { label: 'WhatsApp', pct: 68 },
  { label: 'Web Chat', pct: 21 },
  { label: 'Voice', pct: 11 },
];

const CUSTOMERS = [
  { initials: 'AH', color: 'bg-brand-gold text-[#090B14]', name: 'Abdishakur Hassan', place: 'Mogadishu, Somalia', tag: 'New Lead', tagClass: 'bg-brand-success/[0.12] text-brand-success' },
  { initials: 'FA', color: 'bg-brand-success text-[#090B14]', name: 'Fatima Ali', place: 'Hargeisa, Somalia', tag: 'Booked', tagClass: 'bg-brand-gold/[0.12] text-brand-gold' },
  { initials: 'RH', color: 'bg-violet-500 text-white', name: 'Rahma Hussein', place: 'Bosaso, Somalia', tag: 'Follow-up', tagClass: 'bg-white/[0.06] text-brand-muted' },
];

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: MessageSquare, label: 'Conversations' },
  { icon: Calendar, label: 'Appointments' },
  { icon: Wallet, label: 'Revenue' },
  { icon: Users, label: 'Leads' },
  { icon: BarChart3, label: 'Analytics' },
];

export function DashboardPreview() {
  return (
    <section id="dashboard-preview" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          align="center"
          kicker="AI DASHBOARD"
          title="One command center for everything"
          description="Analytics, conversations, appointments, revenue, and leads — all in a single, beautiful dark-glass dashboard."
          className="mb-11"
        />

        <div className="relative">
          <GlowOrb className="-inset-10 bg-brand-gold/[0.12]" />
          <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0b111c] shadow-[0_50px_100px_rgba(0,0,0,0.6)]">
            <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]">
              <div className="hidden border-r border-white/[0.06] bg-white/[0.02] p-[22px] md:block">
                <div className="mb-6 flex items-center gap-2">
                  <LogoMark size={30} />
                  <span className="text-[13px] font-bold text-white">SomReception AI</span>
                </div>
                <div className="flex flex-col gap-1">
                  {NAV.map(({ icon: Icon, label, active }) => (
                    <div
                      key={label}
                      className={
                        active
                          ? 'flex items-center gap-2.5 rounded-lg bg-brand-gold/[0.14] px-2.5 py-[9px] text-[13px] font-semibold text-brand-gold'
                          : 'flex items-center gap-2.5 px-2.5 py-[9px] text-[13px] text-brand-muted'
                      }
                    >
                      <Icon className="h-[15px] w-[15px]" /> {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-[22px]">
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {KPIS.map((k) => (
                    <div key={k.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                      <div className="text-[11px] text-brand-muted">{k.label}</div>
                      <div className="text-xl font-extrabold text-white sm:text-[22px]">{k.value}</div>
                      <div className="text-[11px] font-semibold text-brand-success">{k.delta}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[13px] font-bold text-white">Revenue Overview</div>
                      <div className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-[11px] text-brand-muted">This Year</div>
                    </div>
                    <svg viewBox="0 0 400 130" className="block w-full">
                      <defs>
                        <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#FBBF24" stopOpacity="0.3" />
                          <stop offset="1" stopColor="#FBBF24" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,105 L33,92 L66,98 L99,72 L132,80 L165,55 L198,64 L231,40 L264,52 L297,30 L330,44 L363,22 L400,34 L400,130 L0,130 Z"
                        fill="url(#dashboardArea)"
                      />
                      <path
                        d="M0,105 L33,92 L66,98 L99,72 L132,80 L165,55 L198,64 L231,40 L264,52 L297,30 L330,44 L363,22 L400,34"
                        fill="none"
                        stroke="#FBBF24"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="mb-3.5 text-[13px] font-bold text-white">Channel Split</div>
                    {CHANNELS.map((c) => (
                      <div key={c.label} className="mb-3 last:mb-0">
                        <div className="mb-1.5 flex justify-between text-[11px]">
                          <span className="text-slate-300">{c.label}</span>
                          <span className="text-brand-muted">{c.pct}%</span>
                        </div>
                        <div className="h-[7px] rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-amber"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="mb-3 text-[13px] font-bold text-white">Recent Customers</div>
                  {CUSTOMERS.map((c, i) => (
                    <div
                      key={c.name}
                      className={`flex items-center justify-between py-2 ${i < CUSTOMERS.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${c.color}`}>
                          {c.initials}
                        </div>
                        <div>
                          <div className="text-[12.5px] font-semibold text-white">{c.name}</div>
                          <div className="text-[10.5px] text-brand-muted">{c.place}</div>
                        </div>
                      </div>
                      <span className={`rounded-md px-[9px] py-[3px] text-[10px] font-medium ${c.tagClass}`}>{c.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
