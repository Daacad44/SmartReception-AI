import { Check, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { SectionHeading } from './shared';

const TRADITIONAL = [
  'Limited to business hours',
  'Long response delays',
  'High staffing costs',
  'Hard to scale',
  'Single language only',
  'No real-time analytics',
];

const SOMRECEPTION = [
  '24/7 availability',
  'Instant replies',
  'Lower costs with AI automation',
  'Infinitely scalable',
  'Multi-language support',
  'Seamless human handoff + analytics',
];

export function WhyChooseSection() {
  return (
    <section className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1080px]">
        <SectionHeading
          align="center"
          kicker="WHY SOMRECEPTION AI"
          title="The smarter way to serve customers"
          className="mb-11"
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-[20px] border border-white/[0.08] bg-brand-secondary p-8">
            <div className="mb-1.5 text-[13px] font-semibold text-brand-muted">Traditional Support</div>
            <div className="mb-6 text-[22px] font-extrabold text-slate-300">Slow, costly, limited</div>
            <div className="flex flex-col gap-3.5">
              {TRADITIONAL.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-brand-muted">
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-red-500/[0.14]">
                    <X className="h-3 w-3 text-red-500" strokeWidth={2.8} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[20px] border border-brand-gold/35 bg-gradient-to-b from-brand-gold/[0.08] to-brand-secondary p-8 shadow-[0_30px_60px_rgba(251,191,36,0.06)]">
            <div className="absolute right-5 top-5 rounded-lg bg-gradient-to-br from-brand-gold to-brand-amber px-2.5 py-1 text-[11px] font-bold text-[#090B14]">
              RECOMMENDED
            </div>
            <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-brand-gold">
              <LogoMark size={20} /> SomReception AI
            </div>
            <div className="mb-6 text-[22px] font-extrabold text-white">Instant, automated, scalable</div>
            <div className="flex flex-col gap-3.5">
              {SOMRECEPTION.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm font-medium text-white">
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-brand-success/[0.18]">
                    <Check className="h-3 w-3 text-brand-success" strokeWidth={2.8} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
