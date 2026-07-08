import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, MessageCircle, Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, MAILTO_SUPPORT, WHATSAPP_LINK } from '@/lib/brand';

const SOCIALS = [
  { icon: Facebook, label: 'Facebook', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0b0f1a] px-4 pb-9 pt-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Logo className="mb-4" iconSize={34} />
            <p className="mb-5 max-w-[280px] text-sm leading-relaxed text-brand-muted">
              AI Receptionist for modern businesses. Automate conversations, bookings, and follow-ups 24/7.
            </p>
            <div className="flex gap-2.5">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.05] text-brand-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
                >
                  <Icon className="h-[17px] w-[17px]" />
                </a>
              ))}
            </div>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-white">Product</p>
            <div className="flex flex-col gap-2 text-brand-muted">
              <a href="#services" className="transition-colors hover:text-white">Services</a>
              <a href="#features" className="transition-colors hover:text-white">Features</a>
              <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
              <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            </div>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-white">Company</p>
            <div className="flex flex-col gap-2 text-brand-muted">
              <Link to="/login" className="transition-colors hover:text-white">Sign In</Link>
              <Link to="/register" className="transition-colors hover:text-white">Get Started</Link>
              <a href="#industries" className="transition-colors hover:text-white">Industries</a>
            </div>
          </div>

          <div className="text-sm">
            <p className="mb-3 font-semibold text-white">Contact</p>
            <div className="flex flex-col gap-2.5 text-brand-muted">
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-white">
                <MessageCircle className="h-4 w-4 flex-none text-brand-success" /> {CONTACT_PHONE_DISPLAY}
              </a>
              <a href={MAILTO_SUPPORT} className="flex items-center gap-2 transition-colors hover:text-white">
                <Mail className="h-4 w-4 flex-none text-brand-gold" /> {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <p className="mx-auto max-w-6xl border-t border-white/[0.06] pt-6 text-center text-xs text-brand-muted">
          © {new Date().getFullYear()} SomReception AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
