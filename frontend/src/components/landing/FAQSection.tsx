import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from './shared';

const FAQS = [
  {
    q: 'What is SomReception AI?',
    a: 'An AI-powered platform that automates customer communication via WhatsApp, appointment booking, lead capture, and CRM — so your business responds instantly, 24/7.',
  },
  {
    q: 'Can it automate WhatsApp conversations?',
    a: 'Yes — instant replies, lead capture, appointment booking, and support automation all run natively on your WhatsApp Business number.',
  },
  {
    q: 'How fast can I get started?',
    a: 'Connect your WhatsApp Business account, train your AI on your business info, and go live the same day — typically in about 5 minutes.',
  },
  {
    q: 'Does the AI support multiple languages?',
    a: 'Yes. SomReception AI can converse in Somali, English, and other languages your customers use, switching automatically per conversation.',
  },
  {
    q: 'Can I hand off a conversation to a human agent?',
    a: 'Absolutely. The AI can escalate any conversation to your team in one click, with full context and history preserved.',
  },
  {
    q: 'Is my business data secure?',
    a: 'Yes. We use end-to-end encryption, role-based access control, and cloud infrastructure built for enterprise-grade security and compliance.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[760px]">
        <SectionHeading align="center" kicker="FAQ" title="Questions? Answered." className="mb-11" />
        <div className="flex flex-col gap-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-brand-secondary">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-[22px] py-5 text-left text-base font-semibold text-white"
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <Plus className={cn('h-5 w-5 flex-none text-brand-gold transition-transform duration-200', isOpen && 'rotate-45')} />
                </button>
                {isOpen && (
                  <div className="px-[22px] pb-5 text-[14.5px] leading-relaxed text-brand-muted">{faq.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
