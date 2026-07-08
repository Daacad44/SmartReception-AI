import { Star } from 'lucide-react';
import { SectionHeading } from './shared';

const TESTIMONIALS = [
  {
    quote:
      'SomReception AI transformed our WhatsApp support. We respond instantly, 24/7, and our customers notice the difference.',
    name: 'Abdishakur Hassan',
    role: 'Operations Manager, Mogadishu',
    initials: 'AH',
  },
  {
    quote: 'Appointment bookings through WhatsApp increased 3x in the first month. The AI never misses a lead.',
    name: 'Fatima Ali',
    role: 'Clinic Director, Hargeisa',
    initials: 'FA',
  },
  {
    quote: 'The AI understands our menu and hours perfectly, and captures reservations we used to miss overnight.',
    name: 'Rahma Hussein',
    role: 'Owner, Jaziira Restaurant',
    initials: 'RH',
  },
  {
    quote: 'Setup took less than an hour. Now our front desk focuses on guests instead of repeating the same answers.',
    name: 'Mohamed Warsame',
    role: 'General Manager, SunRise Hotels',
    initials: 'MW',
  },
  {
    quote: 'Lead capture and CRM sync just work. Our sales team finally has clean, organized conversation history.',
    name: 'Ayaan Farah',
    role: 'Sales Lead, Prime Real Estate',
    initials: 'AF',
  },
  {
    quote: 'Multi-language support means we serve customers in Somali and English without hiring extra staff.',
    name: 'Khalid Nur',
    role: 'Founder, Mogadishu Tech',
    initials: 'KN',
  },
];

export function TestimonialsSection() {
  const loop = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="reveal overflow-hidden py-16 sm:py-20">
      <div className="px-4 sm:px-6">
        <SectionHeading align="center" kicker="TESTIMONIALS" title="Loved by growing teams" className="mb-11" />
      </div>
      <div className="marquee-pause edge-fade-x">
        <div className="flex w-max animate-marquee-slow gap-5 px-2.5">
          {loop.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="w-[340px] flex-none rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-md sm:w-[360px]"
            >
              <div className="mb-3.5 flex gap-[3px]">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-brand-gold text-brand-gold" />
                ))}
              </div>
              <p className="mb-5 text-[14.5px] leading-relaxed text-slate-200">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-amber text-[15px] font-bold text-[#090B14]">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-[12.5px] text-brand-muted">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
