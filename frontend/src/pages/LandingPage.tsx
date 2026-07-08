import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Hero } from '@/components/landing/Hero';
import { TrustBar } from '@/components/landing/TrustBar';
import { StatsSection } from '@/components/landing/StatsSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { DashboardPreview } from '@/components/landing/DashboardPreview';
import { IndustriesSection } from '@/components/landing/IndustriesSection';
import { WhyChooseSection } from '@/components/landing/WhyChooseSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { LandingFooter } from '@/components/landing/LandingFooter';

gsap.registerPlugin(ScrollTrigger);

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-animate', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
      });

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: 'top 85%' },
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen overflow-x-hidden bg-[#090B14] font-sans text-white">
      <LandingHeader />
      <Hero />
      <TrustBar />
      <StatsSection />
      <ServicesSection />
      <FeatureShowcase />
      <HowItWorks />
      <DashboardPreview />
      <IndustriesSection />
      <WhyChooseSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
