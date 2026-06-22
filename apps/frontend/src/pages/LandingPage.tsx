import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Bot,
  MessageSquare,
  Calendar,
  Users,
  BookOpen,
  Globe,
  Smartphone,
  Code,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

const SERVICES = [
  { icon: Bot, title: 'AI Receptionist', desc: '24/7 automated customer support powered by AI.' },
  { icon: MessageSquare, title: 'WhatsApp Automation', desc: 'Instant replies, lead capture, and FAQ automation.' },
  { icon: Calendar, title: 'Appointment Management', desc: 'Booking, rescheduling, and automated reminders.' },
  { icon: Users, title: 'CRM Management', desc: 'Customer profiles, history, and lead tracking.' },
  { icon: BookOpen, title: 'AI Knowledge Base', desc: 'Answers from your company knowledge instantly.' },
  { icon: Globe, title: 'Website Development', desc: 'Professional, conversion-focused business websites.' },
  { icon: Code, title: 'Custom Software', desc: 'Tailored SaaS platforms and business systems.' },
  { icon: Smartphone, title: 'Mobile Applications', desc: 'Android and iOS apps for your business.' },
];

const PLANS = [
  { name: 'Starter', price: '$49', features: ['1,000 messages/mo', 'AI auto-reply', 'WhatsApp integration', 'Basic analytics'] },
  { name: 'Professional', price: '$149', features: ['10,000 messages/mo', 'Appointment booking', 'Knowledge base', 'Team members'], popular: true },
  { name: 'Enterprise', price: 'Custom', features: ['Unlimited volume', 'Custom AI training', 'Priority support', 'Dedicated onboarding'] },
];

const FAQS = [
  { q: 'What is SmartReception?', a: 'An AI-powered platform that automates customer communication via WhatsApp, appointments, and CRM.' },
  { q: 'Can it automate WhatsApp?', a: 'Yes — instant replies, lead capture, booking, and support automation.' },
  { q: 'Do you build websites and apps?', a: 'Yes. We offer website development and Android/iOS mobile applications.' },
  { q: 'How fast can I get started?', a: 'Connect your WhatsApp Business account and go live in minutes.' },
];

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

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
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={heroRef} className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 glass-panel border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Bot className="h-5 w-5" />
            </div>
            SmartReception AI
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#services" className="hover:text-foreground">Services</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="gradient-hero px-4 pb-24 pt-20">
        <div className="mx-auto max-w-6xl text-center">
          <Badge className="hero-animate mb-4 bg-accent/20 text-accent border-accent/30">AI Business Automation</Badge>
          <h1 className="hero-animate text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Your AI-Powered
            <span className="block text-accent">Virtual Receptionist</span>
          </h1>
          <p className="hero-animate mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Automate WhatsApp customer support, appointment booking, and lead capture with SmartReception AI — built for modern businesses.
          </p>
          <div className="hero-animate mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/register">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Trusted By */}
      <section className="border-y bg-card/50 py-12 reveal">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Trusted by growing businesses</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-60">
            {['Botandev', 'Wellness Clinics', 'Retail Brands', 'Service Providers', 'Tech Startups'].map((name) => (
              <span key={name} className="text-lg font-semibold">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Services */}
      <section id="services" className="py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Our Services</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            End-to-end AI automation and software development for your business.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-panel rounded-xl p-6 transition hover:border-accent/40">
                <Icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Features */}
      <section id="features" className="bg-card/30 py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Enterprise Features</h2>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Zap, text: 'Sub-second WhatsApp auto-replies' },
                { icon: Shield, text: 'Secure, multi-tenant architecture' },
                { icon: BarChart3, text: 'Real-time analytics dashboard' },
                { icon: CheckCircle2, text: 'Delivery & read receipt tracking' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-accent shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-panel rounded-2xl p-8">
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">Customer: Hi, I need pricing info</div>
              <div className="rounded-lg bg-accent/20 p-3 text-sm ml-8">
                AI: Welcome to SmartReception AI! We offer flexible plans based on your message volume. Would you like to book a demo?
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">Customer: Yes, tomorrow at 2pm</div>
              <div className="rounded-lg bg-accent/20 p-3 text-sm ml-8">
                AI: Perfect! I've scheduled your demo for tomorrow at 2:00 PM. You'll receive a confirmation shortly.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. AI Demo label */}
      <section className="py-12 px-4 text-center reveal">
        <Badge variant="outline" className="text-accent border-accent/50">Live AI Receptionist Demo</Badge>
        <p className="mt-4 text-muted-foreground">Message us on WhatsApp at +252 68 776 2999 to experience SmartReception AI.</p>
      </section>

      {/* 6. How It Works */}
      <section id="how-it-works" className="py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">How It Works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { step: '01', title: 'Connect WhatsApp', desc: 'Link your WhatsApp Business API in minutes.' },
              { step: '02', title: 'Train Your AI', desc: 'Upload knowledge base docs and configure your assistant.' },
              { step: '03', title: 'Go Live', desc: 'AI handles customers 24/7 while you focus on growth.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Benefits */}
      <section className="bg-card/30 py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold">Why SmartReception?</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {['Reduce response time by 90%', 'Capture leads automatically', 'Scale support without hiring'].map((b) => (
              <div key={b} className="glass-panel rounded-xl p-6 text-lg font-medium">{b}</div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Testimonials */}
      <section className="py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">What Customers Say</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { quote: 'SmartReception transformed our WhatsApp support. We respond instantly, 24/7.', author: 'Operations Manager' },
              { quote: 'Appointment bookings through WhatsApp increased 3x in the first month.', author: 'Clinic Director' },
              { quote: 'The AI understands our services and captures leads we used to miss.', author: 'Business Owner' },
            ].map((t) => (
              <blockquote key={t.author} className="glass-panel rounded-xl p-6">
                <p className="text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4 text-sm font-medium">{t.author}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Pricing */}
      <section id="pricing" className="py-20 px-4 reveal">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Pricing Plans</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'glass-panel rounded-2xl p-8',
                  plan.popular && 'border-accent ring-1 ring-accent/30'
                )}
              >
                {plan.popular && <Badge className="mb-4 bg-accent text-accent-foreground">Most Popular</Badge>}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <ul className="mt-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full" variant={plan.popular ? 'default' : 'outline'} asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FAQ */}
      <section id="faq" className="bg-card/30 py-20 px-4 reveal">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <div className="mt-10 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="glass-panel rounded-lg p-4 group">
                <summary className="cursor-pointer font-medium">{faq.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 11. CTA */}
      <section className="py-24 px-4 reveal">
        <div className="mx-auto max-w-4xl rounded-2xl bg-accent p-12 text-center text-accent-foreground">
          <h2 className="text-3xl font-bold">Ready to automate your customer communication?</h2>
          <p className="mt-4 opacity-90">Join businesses using SmartReception AI to grow faster.</p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link to="/register">Start Your Free Trial</Link>
          </Button>
        </div>
      </section>

      {/* 12. Footer */}
      <footer className="border-t py-12 px-4">
        <div className="mx-auto max-w-6xl flex flex-col gap-8 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="h-5 w-5 text-accent" /> SmartReception AI
            </div>
            <p className="mt-2 text-sm text-muted-foreground">AI-powered business automation</p>
          </div>
          <div className="flex gap-12 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Product</p>
              <a href="#features" className="mt-2 block hover:text-foreground">Features</a>
              <a href="#pricing" className="block hover:text-foreground">Pricing</a>
            </div>
            <div>
              <p className="font-medium text-foreground">Company</p>
              <a href="https://somreception.botandev.com" className="mt-2 block hover:text-foreground">Website</a>
              <Link to="/login" className="block hover:text-foreground">Sign In</Link>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SmartReception AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
