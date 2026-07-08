import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { GlowOrb } from './shared';

export function CTASection() {
  return (
    <section className="reveal px-4 pb-20 pt-10 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[28px] border border-brand-gold/20 bg-gradient-to-br from-brand-card to-[#0d131f] px-6 py-16 text-center sm:px-10 sm:py-[70px]">
        <GlowOrb className="-top-24 left-1/2 h-[400px] w-[600px] -translate-x-1/2 animate-brand-glow bg-brand-gold/20" />
        <GlowOrb className="-bottom-28 -right-10 h-[300px] w-[300px] bg-brand-amber/[0.16]" />
        <div className="relative">
          <h2 className="mx-auto mb-4.5 max-w-xl text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            Ready to Automate Your Business?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-lg text-brand-muted">
            Join 100+ businesses using SomReception AI to answer, book, and convert — around the clock.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-[13px] bg-gradient-to-br from-brand-gold to-brand-amber px-[30px] py-4 text-base font-bold text-[#090B14] no-underline shadow-[0_12px_30px_rgba(251,191,36,0.34)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(251,191,36,0.5)] hover:no-underline"
            >
              Start Free Trial <ArrowRight className="h-[17px] w-[17px]" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-[13px] border border-white/[0.16] bg-white/[0.04] px-[30px] py-4 text-base font-semibold text-white no-underline transition-colors hover:bg-white/[0.09] hover:no-underline"
            >
              <Calendar className="h-[17px] w-[17px]" /> Book a Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
