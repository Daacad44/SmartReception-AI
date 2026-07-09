import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { InstallButton } from '@/pwa';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#features', label: 'Features' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        scrolled ? 'border-white/10 bg-[#090B14]/85 backdrop-blur-lg' : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link to="/" className="no-underline hover:no-underline">
          <Logo iconSize={38} wordmarkClassName="text-base sm:text-lg" />
        </Link>

        <nav className="hidden items-center gap-7 text-[14.5px] font-medium text-slate-300 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <InstallButton
            variant="ghost"
            label="Install App"
            className="rounded-[11px] border border-white/14 px-[18px] py-[9px] text-sm font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white"
          />
          <Link
            to="/login"
            className="rounded-[11px] border border-white/14 px-[18px] py-[9px] text-sm font-semibold text-slate-200 no-underline transition-colors hover:bg-white/[0.06] hover:text-white hover:no-underline"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-[11px] bg-gradient-to-br from-brand-gold to-brand-amber px-5 py-[10px] text-sm font-bold text-[#090B14] no-underline shadow-[0_6px_18px_rgba(251,191,36,0.28)] transition-transform hover:-translate-y-0.5 hover:no-underline"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 text-white lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#090B14] px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1 py-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-3 text-[15px] font-medium text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-white/14 px-4 py-3 text-center text-sm font-semibold text-slate-200 no-underline hover:no-underline"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl bg-gradient-to-br from-brand-gold to-brand-amber px-4 py-3 text-center text-sm font-bold text-[#090B14] no-underline hover:no-underline"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
