import { Send } from 'lucide-react';
import { GlowOrb } from './shared';

const STEPS = [
  { title: 'Connect Your Channels', desc: 'Connect WhatsApp and other channels in minutes.' },
  { title: 'Train Your AI', desc: 'Provide your business info and let AI learn your work.' },
  { title: 'Launch AI Receptionist', desc: 'Your AI goes live and starts handling conversations.' },
  { title: 'Grow Your Business', desc: 'Save time, close more deals, and grow effortlessly.' },
];

const SIDEBAR_CHATS = [
  { initials: 'AH', color: 'bg-brand-gold text-[#090B14]', phone: '+252 610 123456', text: 'Need help with booking', time: 'Now', active: true },
  { initials: 'FA', color: 'bg-brand-success text-[#090B14]', phone: '+252 615 654321', text: 'What are your hours?', time: '1m' },
  { initials: 'RH', color: 'bg-violet-500 text-white', phone: '+252 611 987654', text: 'Price for appointment', time: '2m' },
  { initials: 'MA', color: 'bg-blue-500 text-white', phone: '+252 614 321098', text: 'Can I reschedule?', time: '5m' },
];

const THREAD = [
  { from: 'customer', text: 'Hi, I need help with booking a doctor appointment.' },
  { from: 'ai', text: 'Hello! 👋 Sure, I can help you book an appointment. What department do you need?' },
  { from: 'customer', text: 'Cardiology please' },
  { from: 'ai', text: 'Great! How about Tomorrow at 10:00 AM?' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <div className="mb-3 text-[13px] font-bold tracking-[0.14em] text-brand-gold">HOW IT WORKS</div>
          <h2 className="mb-8 text-[2.1rem] font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Get Started in 4
            <br />
            Simple Steps
          </h2>
          <div className="relative pl-1.5">
            <div className="absolute bottom-3.5 left-[22px] top-3.5 w-0.5 bg-gradient-to-b from-brand-gold to-brand-gold/15" />
            {STEPS.map((step, i) => (
              <div key={step.title} className={`relative flex gap-4.5 ${i < STEPS.length - 1 ? 'mb-7' : ''}`}>
                <div className="relative z-10 flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-amber font-extrabold text-[#090B14]">
                  {i + 1}
                </div>
                <div>
                  <div className="mb-1 text-[16.5px] font-bold text-white">{step.title}</div>
                  <div className="text-sm leading-relaxed text-brand-muted">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <GlowOrb className="-inset-8 bg-brand-gold/10" />
          <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-gradient-to-b from-[#12192a] to-[#0d131f] shadow-[0_40px_80px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/[0.06] px-[18px] py-4">
              <div className="text-[15px] font-bold text-white">Conversations</div>
              <div className="text-[11px] text-brand-muted">All customer conversations in one place</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[230px_1fr]">
              <div className="hidden border-r border-white/[0.06] p-3 sm:block">
                <div className="mb-3 flex gap-3.5 text-xs text-brand-muted">
                  <span className="flex items-center gap-1 border-b-2 border-brand-gold pb-1 font-bold text-brand-gold">
                    Open <span className="rounded-md bg-brand-gold px-[5px] py-px text-[9px] text-[#090B14]">4</span>
                  </span>
                  <span>Closed</span>
                  <span>Snoozed</span>
                </div>
                {SIDEBAR_CHATS.map((c) => (
                  <div
                    key={c.phone}
                    className={`mb-1.5 flex items-center gap-2.5 rounded-[10px] p-2.5 ${
                      c.active ? 'border border-brand-gold/20 bg-brand-gold/[0.08]' : ''
                    }`}
                  >
                    <div className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${c.color}`}>
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">{c.phone}</div>
                      <div className="truncate text-[11px] text-brand-muted">{c.text}</div>
                    </div>
                    <span className="shrink-0 text-[9px] text-brand-muted">{c.time}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3.5 py-[11px]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-[#090B14]">
                    AH
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">+252 610 123456</div>
                    <div className="text-[10px] text-brand-muted">via WhatsApp Business</div>
                  </div>
                </div>
                <div className="flex min-h-[220px] flex-1 flex-col gap-3 p-3.5 sm:p-4">
                  {THREAD.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.from === 'customer'
                          ? 'max-w-[75%] self-end rounded-[14px] rounded-br-[4px] border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-100'
                          : 'max-w-[78%] self-start rounded-[14px] rounded-bl-[4px] bg-gradient-to-br from-brand-gold to-brand-amber px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#090B14]'
                      }
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2.5 border-t border-white/[0.06] p-3.5">
                  <div className="flex-1 rounded-[10px] border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-xs text-slate-500">
                    Type a message...
                  </div>
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-gold to-brand-amber">
                    <Send className="h-4 w-4 text-[#090B14]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
