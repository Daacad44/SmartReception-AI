import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle2 } from 'lucide-react';
import { GlowOrb } from './shared';
import { DashboardMockup } from './DashboardMockup';

export function Hero() {
  return (
    <header className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pb-24 sm:pt-40">
      <div
        className="pointer-events-none absolute inset-0 animate-brand-gridpan opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, #000 30%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, #000 30%, transparent 75%)',
        }}
      />
      <GlowOrb className="-top-36 left-[6%] h-[420px] w-[420px] animate-brand-glow bg-brand-gold/20 sm:h-[520px] sm:w-[520px]" />
      <GlowOrb className="right-[-80px] top-10 h-[460px] w-[460px] animate-brand-glow bg-brand-amber/15 [animation-duration:10s] sm:h-[560px] sm:w-[560px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div>
          <div className="hero-animate mb-6 inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/[0.08] px-3.5 py-[7px] text-[13px] font-semibold text-brand-gold">
            <span className="h-[7px] w-[7px] rounded-full bg-brand-success shadow-[0_0_8px_#22C55E]" />
            AI Receptionist for Modern Businesses
          </div>
          <h1 className="hero-animate text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[3.1rem] lg:text-[3.5rem]">
            AI Receptionist That Works <span className="text-brand-gold">24/7</span> So You Don&apos;t Have To
          </h1>
          <p className="hero-animate mt-6 max-w-lg text-lg leading-relaxed text-brand-muted">
            Automate customer conversations, appointment booking, lead capture, and follow-ups across WhatsApp and
            beyond with <span className="font-semibold text-brand-gold">SomReception AI</span>.
          </p>
          <div className="hero-animate mt-8 flex flex-wrap gap-3.5">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-[13px] bg-gradient-to-br from-brand-gold to-brand-amber px-[26px] py-[15px] text-[15.5px] font-bold text-[#090B14] no-underline shadow-[0_10px_28px_rgba(251,191,36,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(251,191,36,0.48)] hover:no-underline"
            >
              Start Free Trial <ArrowRight className="h-[17px] w-[17px]" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-[13px] border border-white/12 bg-brand-card px-[26px] py-[15px] text-[15.5px] font-semibold text-white no-underline transition-colors hover:border-white/24 hover:bg-white/[0.06] hover:no-underline"
            >
              <Calendar className="h-[17px] w-[17px]" /> Book a Demo
            </a>
          </div>
          <div className="hero-animate mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-brand-muted">
            {['No credit card required', 'Setup in 5 minutes', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-[15px] w-[15px] text-brand-success" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-animate">
          <DashboardMockup />
        </div>
      </div>
    </header>
  );
}
