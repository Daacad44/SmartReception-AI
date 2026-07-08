import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Users,
  BarChart3,
  Settings,
  Sparkles,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';

const STATS = [
  { label: 'Total Conversations', value: '12,456', delta: '▲ 18.2%' },
  { label: 'Appointments', value: '1,243', delta: '▲ 22.4%' },
  { label: 'Leads Captured', value: '3,456', delta: '▲ 26.1%' },
  { label: 'Revenue', value: '$24,560', delta: '▲ 19.7%' },
];

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: MessageSquare, label: 'Conversations', badge: 12 },
  { icon: Calendar, label: 'Appointments' },
  { icon: Users, label: 'Contacts' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

const LIVE_CHATS = [
  { initials: 'AH', color: 'bg-brand-gold text-[#090B14]', phone: '+252 610 123456', text: 'Need help with booking', time: 'now' },
  { initials: 'FA', color: 'bg-brand-success text-[#090B14]', phone: '+252 615 654321', text: 'What are your hours?', time: '1m' },
];

export function DashboardMockup() {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0d131f] shadow-[0_40px_90px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]">
          <div className="hidden border-r border-white/[0.06] bg-white/[0.02] p-3 sm:block">
            <div className="mb-4 flex items-center gap-1.5">
              <LogoMark size={22} />
              <span className="text-[11px] font-bold text-white">SomReception AI</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {NAV.map(({ icon: Icon, label, active, badge }) => (
                <div
                  key={label}
                  className={
                    active
                      ? 'flex items-center gap-2 rounded-lg bg-brand-gold/[0.14] px-2.5 py-[7px] text-[11px] font-semibold text-brand-gold'
                      : 'flex items-center justify-between gap-2 px-2.5 py-[7px] text-[11px] text-brand-muted'
                  }
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-[13px] w-[13px]" /> {label}
                  </span>
                  {badge && (
                    <span className="rounded-md bg-brand-gold px-[5px] py-px text-[9px] font-bold text-[#090B14]">
                      {badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-4">
            <div className="mb-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Dashboard</div>
                <div className="text-[10.5px] text-brand-muted">Welcome back 👋</div>
              </div>
              <div className="hidden rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] text-brand-muted sm:block">
                May 20 – Jun 20
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-2.5">
                  <div className="mb-[3px] truncate text-[8.5px] text-brand-muted">{s.label}</div>
                  <div className="text-[15px] font-bold text-white">{s.value}</div>
                  <div className="text-[8px] font-semibold text-brand-success">{s.delta}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-2.5">
                <div className="mb-1.5 text-[10px] font-semibold text-white">Conversations Overview</div>
                <svg viewBox="0 0 260 90" className="block w-full">
                  <defs>
                    <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#FBBF24" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#FBBF24" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,70 L20,60 L40,66 L60,48 L80,54 L100,38 L120,44 L140,26 L160,40 L180,30 L200,46 L220,34 L240,20 L260,32 L260,90 L0,90 Z"
                    fill="url(#heroArea)"
                  />
                  <path
                    d="M0,70 L20,60 L40,66 L60,48 L80,54 L100,38 L120,44 L140,26 L160,40 L180,30 L200,46 L220,34 L240,20 L260,32"
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-2.5">
                <div className="mb-2 text-[10px] font-semibold text-white">Live Conversations</div>
                {LIVE_CHATS.map((c) => (
                  <div key={c.phone} className="mb-2 flex items-center gap-[7px]">
                    <div className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${c.color}`}>
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[9.5px] font-semibold text-white">{c.phone}</div>
                      <div className="truncate text-[8px] text-brand-muted">{c.text}</div>
                    </div>
                    <span className="shrink-0 text-[7.5px] text-brand-muted">{c.time}</span>
                  </div>
                ))}
                <div className="rounded-[7px] border border-brand-gold/25 py-[5px] text-center text-[9px] font-semibold text-brand-gold">
                  View all conversations
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-3.5 top-14 flex h-11 w-11 animate-brand-float items-center justify-center rounded-full bg-brand-success shadow-[0_8px_22px_rgba(34,197,94,0.45)] sm:top-16">
        <MessageSquare className="h-5 w-5 text-white" />
      </div>
      <div className="absolute -left-3 -bottom-4 hidden items-center gap-2 rounded-xl border border-white/10 bg-brand-card/95 px-3 py-2 shadow-lg backdrop-blur sm:flex">
        <Sparkles className="h-4 w-4 text-brand-gold" />
        <span className="text-xs font-semibold text-white">AI resolved 94% instantly</span>
      </div>
    </div>
  );
}
