import {
  Bot,
  MessageSquare,
  CalendarCheck,
  Boxes,
  UserPlus,
  Headset,
  Workflow,
  LineChart,
  BookOpen,
  GraduationCap,
  Mic,
  Code2,
  ArrowRight,
} from 'lucide-react';

const SERVICES = [
  { icon: Bot, title: 'AI Receptionist', desc: 'Human-like AI that answers, qualifies and converts.' },
  { icon: MessageSquare, title: 'WhatsApp Automation', desc: 'Automate chats, replies, and customer support.' },
  { icon: CalendarCheck, title: 'Appointment Booking', desc: 'Smart scheduling with calendar integration.' },
  { icon: Boxes, title: 'CRM Integration', desc: 'Sync leads and clients with your favorite CRM.' },
  { icon: UserPlus, title: 'Lead Capture', desc: 'Capture, qualify and organize high-quality leads.' },
  { icon: Headset, title: 'AI Customer Support', desc: 'Deliver instant support 24/7 with AI agents.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'Automate tasks and save hours every day.' },
  { icon: LineChart, title: 'Analytics & Reports', desc: 'Track performance and grow with smart insights.' },
  { icon: BookOpen, title: 'Knowledge Base', desc: 'Train AI on your docs, FAQs and policies.' },
  { icon: GraduationCap, title: 'AI Agent Training', desc: 'Fine-tune agents to sound just like your brand.' },
  { icon: Mic, title: 'Voice AI Assistant', desc: 'Answer calls with a natural AI voice agent.' },
  { icon: Code2, title: 'Custom Software', desc: 'Bespoke automation and AI built for your workflow.' },
];

export function ServicesSection() {
  return (
    <section id="services" className="reveal px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 text-xs font-bold tracking-[0.14em] text-brand-gold">OUR SERVICES</div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Everything You Need
              <br />
              To Automate Your Business
            </h2>
          </div>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-brand-card px-[22px] py-[13px] text-sm font-semibold text-white no-underline transition-colors hover:border-brand-gold/40 hover:no-underline"
          >
            Explore All Services <ArrowRight className="h-4 w-4 text-brand-gold" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative rounded-[18px] border border-white/[0.08] bg-brand-secondary p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-gold/35 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            >
              <div className="mb-[18px] flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-gradient-to-br from-brand-gold to-brand-amber shadow-[0_8px_18px_rgba(251,191,36,0.28)]">
                <Icon className="h-[22px] w-[22px] text-[#090B14]" />
              </div>
              <div className="mb-[7px] text-[16.5px] font-bold text-white">{title}</div>
              <p className="text-[13.5px] leading-relaxed text-brand-muted">{desc}</p>
              <div className="mt-4 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-white/10 transition-colors group-hover:border-brand-gold/40">
                <ArrowRight className="h-[15px] w-[15px] text-brand-gold" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
