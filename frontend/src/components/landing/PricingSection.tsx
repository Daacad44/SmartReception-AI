import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from './shared';

const PLANS = [
  {
    name: 'Starter',
    tagline: 'For small teams getting started',
    monthly: 49,
    yearly: 39,
    features: ['1 AI Receptionist', 'WhatsApp integration', '1,000 conversations/mo', 'Basic analytics'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    tagline: 'For growing businesses',
    monthly: 149,
    yearly: 119,
    features: ['5 AI Agents', 'All channels + CRM sync', '25,000 conversations/mo', 'Advanced analytics + workflows', 'Priority support'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    tagline: 'For large-scale operations',
    monthly: null,
    yearly: null,
    features: ['Unlimited AI agents', 'Custom integrations', 'Unlimited conversations', 'Dedicated success manager', 'SLA & enterprise security'],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1080px]">
        <SectionHeading align="center" kicker="PRICING" title="Simple, transparent pricing" className="mb-8" />
        <div className="mb-10 flex justify-center">
          <div className="inline-flex gap-1 rounded-xl border border-white/[0.08] bg-brand-secondary p-[5px]">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors',
                !yearly ? 'bg-gradient-to-br from-brand-gold to-brand-amber text-[#090B14]' : 'text-brand-muted'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors',
                yearly ? 'bg-gradient-to-br from-brand-gold to-brand-amber text-[#090B14]' : 'text-brand-muted'
              )}
            >
              Yearly <span className={cn('text-xs', yearly ? 'text-[#090B14]/70' : 'text-brand-success')}>−20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-[20px] border p-[30px]',
                plan.popular
                  ? 'border-brand-gold/45 bg-gradient-to-b from-brand-gold/10 to-brand-secondary shadow-[0_30px_70px_rgba(251,191,36,0.1)] md:scale-[1.03]'
                  : 'border-white/[0.08] bg-brand-secondary'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gradient-to-br from-brand-gold to-brand-amber px-3.5 py-[5px] text-[11px] font-bold text-[#090B14]">
                  MOST POPULAR
                </div>
              )}
              <div className="mb-1.5 text-base font-bold text-white">{plan.name}</div>
              <div className="mb-5 text-[13px] text-brand-muted">{plan.tagline}</div>
              <div className="mb-[22px] flex items-end gap-1">
                {plan.monthly === null ? (
                  <span className="text-4xl font-extrabold leading-none text-white">Custom</span>
                ) : (
                  <>
                    <span className="text-[44px] font-extrabold leading-none text-white">
                      ${yearly ? plan.yearly : plan.monthly}
                    </span>
                    <span className="mb-2 text-sm text-brand-muted">/mo</span>
                  </>
                )}
              </div>
              {plan.name === 'Enterprise' ? (
                <a
                  href="mailto:support@somreception.com?subject=Enterprise%20Plan%20Inquiry"
                  className="mb-6 rounded-xl border border-white/[0.14] bg-transparent py-3.5 text-center text-[14.5px] font-semibold text-white no-underline transition-colors hover:border-brand-gold/40 hover:no-underline"
                >
                  {plan.cta}
                </a>
              ) : (
                <Link
                  to="/register"
                  className={cn(
                    'mb-6 rounded-xl py-3.5 text-center text-[14.5px] font-bold no-underline transition-all hover:no-underline',
                    plan.popular
                      ? 'bg-gradient-to-br from-brand-gold to-brand-amber text-[#090B14] shadow-[0_10px_26px_rgba(251,191,36,0.34)] hover:-translate-y-0.5'
                      : 'border border-white/[0.14] font-semibold text-white hover:border-brand-gold/40'
                  )}
                >
                  {plan.cta}
                </Link>
              )}
              <div className="flex flex-col gap-3">
                {plan.features.map((f) => (
                  <div key={f} className={cn('flex items-center gap-2.5 text-[13.5px]', plan.popular ? 'text-white' : 'text-slate-300')}>
                    <Check className="h-[15px] w-[15px] flex-none text-brand-success" strokeWidth={2.6} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
