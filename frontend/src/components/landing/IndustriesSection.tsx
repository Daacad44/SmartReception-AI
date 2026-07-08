import {
  HeartPulse,
  UtensilsCrossed,
  Building,
  Landmark,
  GraduationCap,
  Store,
  Wallet,
  Truck,
  Briefcase,
  University,
} from 'lucide-react';
import { SectionHeading } from './shared';

const INDUSTRIES = [
  { icon: HeartPulse, label: 'Healthcare' },
  { icon: UtensilsCrossed, label: 'Restaurants' },
  { icon: Building, label: 'Hotels' },
  { icon: Landmark, label: 'Real Estate' },
  { icon: GraduationCap, label: 'Education' },
  { icon: Store, label: 'Retail' },
  { icon: Wallet, label: 'Finance' },
  { icon: Truck, label: 'Logistics' },
  { icon: Briefcase, label: 'Pro Services' },
  { icon: University, label: 'Government' },
];

export function IndustriesSection() {
  return (
    <section id="industries" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading align="center" kicker="INDUSTRIES" title="Built for every business" className="mb-11" />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {INDUSTRIES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="cursor-pointer rounded-2xl border border-white/[0.08] bg-brand-secondary p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/35 hover:bg-brand-card"
            >
              <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[13px] bg-brand-gold/10">
                <Icon className="h-6 w-6 text-brand-gold" strokeWidth={1.9} />
              </div>
              <div className="text-[14.5px] font-semibold text-white">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
