import { CheckCircle2, MessageSquare, Bot, CalendarCheck, ShieldCheck } from 'lucide-react';
import { GlowOrb } from './shared';

function FeatureBullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-brand-success/15">
        <CheckCircle2 className="h-[13px] w-[13px] text-brand-success" />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-white">{title}</div>
        <div className="text-[13.5px] text-brand-muted">{desc}</div>
      </div>
    </div>
  );
}

function FlowCard() {
  return (
    <div className="relative">
      <GlowOrb className="-inset-8 bg-brand-gold/[0.14]" />
      <div className="relative rounded-[18px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0d131f] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-gold" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-success" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <div className="text-center">
            <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-brand-success/[0.14]">
              <MessageSquare className="h-7 w-7 text-brand-success" />
            </div>
            <div className="mt-1.5 text-[11px] text-brand-muted">WhatsApp</div>
          </div>
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="4 3">
            <path d="M2 10h26" />
          </svg>
          <div className="text-center">
            <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold to-brand-amber">
              <Bot className="h-7 w-7 text-[#090B14]" />
            </div>
            <div className="mt-1.5 text-[11px] text-brand-muted">AI Agent</div>
          </div>
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="4 3">
            <path d="M2 10h26" />
          </svg>
          <div className="text-center">
            <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-brand-gold/[0.14]">
              <CalendarCheck className="h-7 w-7 text-brand-gold" />
            </div>
            <div className="mt-1.5 text-[11px] text-brand-muted">Booking</div>
          </div>
        </div>
        <div className="mt-[18px] rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-brand-muted">
          <span className="text-brand-success">●</span> Flow active — 3 steps · 0 errors
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard() {
  const bars = [40, 65, 50, 85, 70, 100, 78];
  return (
    <div className="relative">
      <GlowOrb className="-inset-8 bg-brand-amber/[0.14]" />
      <div className="relative rounded-[18px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0d131f] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-bold text-white">Real-Time Analytics</div>
          <span className="rounded-md bg-brand-success/[0.12] px-2 py-[3px] text-[10px] font-semibold text-brand-success">LIVE</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="text-[10px] text-brand-muted">Response time</div>
            <div className="text-xl font-extrabold text-white">1.2s</div>
          </div>
          <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="text-[10px] text-brand-muted">Resolution rate</div>
            <div className="text-xl font-extrabold text-brand-success">94%</div>
          </div>
        </div>
        <div className="flex h-20 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[5px] bg-gradient-to-b from-brand-gold to-brand-amber"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityCard() {
  return (
    <div className="relative">
      <GlowOrb className="-inset-8 bg-brand-gold/[0.14]" />
      <div className="relative rounded-[18px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0d131f] p-7 text-center shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-brand-gold/[0.12]">
          <ShieldCheck className="h-9 w-9 text-brand-gold" strokeWidth={1.8} />
        </div>
        <div className="mb-3.5 text-base font-bold text-white">Encrypted &amp; Compliant</div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {['AES-256', 'GDPR', 'SOC 2', 'RBAC'].map((tag) => (
            <span key={tag} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-slate-200">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <section id="features" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 sm:gap-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="mb-3.5 text-[13px] font-bold tracking-[0.14em] text-brand-gold">FAST SETUP · NO-CODE</div>
            <h2 className="mb-4 text-[1.9rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.1rem]">
              Launch in minutes, not months
            </h2>
            <p className="mb-6 text-base leading-relaxed text-brand-muted">
              Connect your channels, drag-and-drop your automation flows, and go live the same day — no engineers, no
              code, no headaches.
            </p>
            <div className="flex flex-col gap-3.5">
              <FeatureBullet title="No-Code Automation" desc="Build powerful flows with a visual editor." />
              <FeatureBullet title="Smart Workflows" desc="Trigger actions across your whole stack." />
            </div>
          </div>
          <FlowCard />
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="order-2 lg:order-1">
            <AnalyticsCard />
          </div>
          <div className="order-1 lg:order-2">
            <div className="mb-3.5 text-[13px] font-bold tracking-[0.14em] text-brand-gold">MULTI-AGENT AI · ANALYTICS</div>
            <h2 className="mb-4 text-[1.9rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.1rem]">
              See everything, decide faster
            </h2>
            <p className="mb-6 text-base leading-relaxed text-brand-muted">
              Deploy specialized AI agents for sales, support, and booking — and watch live metrics update as every
              conversation happens.
            </p>
            <div className="flex flex-col gap-3.5">
              <FeatureBullet title="Multi-Agent AI" desc="Purpose-built agents for every job." />
              <FeatureBullet title="Team Collaboration" desc="Assign, tag, and hand off in one inbox." />
            </div>
          </div>
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="mb-3.5 text-[13px] font-bold tracking-[0.14em] text-brand-gold">CLOUD · SECURITY</div>
            <h2 className="mb-4 text-[1.9rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.1rem]">
              Enterprise-grade from day one
            </h2>
            <p className="mb-6 text-base leading-relaxed text-brand-muted">
              Built on resilient cloud infrastructure with encryption, role-based access, and compliance baked in —
              so you scale without worry.
            </p>
            <div className="flex flex-col gap-3.5">
              <FeatureBullet title="Cloud Infrastructure" desc="99.9% uptime, auto-scaling worldwide." />
              <FeatureBullet title="Enterprise Security" desc="End-to-end encryption & SOC-ready." />
            </div>
          </div>
          <SecurityCard />
        </div>
      </div>
    </section>
  );
}
