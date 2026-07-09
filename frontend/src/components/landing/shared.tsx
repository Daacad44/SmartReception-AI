import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 text-xs font-bold tracking-[0.14em] text-brand-gold', className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  description,
  align = 'left',
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' && 'text-center', className)}>
      {kicker && <Kicker className={align === 'center' ? 'mb-3' : undefined}>{kicker}</Kicker>}
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">{title}</h2>
      {description && (
        <p className={cn('mt-4 text-base leading-relaxed text-brand-muted sm:text-lg', align === 'center' && 'mx-auto max-w-2xl')}>
          {description}
        </p>
      )}
    </div>
  );
}

const baseButton =
  'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold font-sans transition-all duration-200 disabled:pointer-events-none disabled:opacity-60';

export function GradientButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        baseButton,
        'bg-gradient-to-br from-brand-gold to-brand-amber text-[#090B14] shadow-[0_10px_28px_rgba(251,191,36,0.32)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(251,191,36,0.48)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        baseButton,
        'border border-white/12 bg-brand-card text-white hover:border-white/24 hover:bg-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GradientLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        baseButton,
        'bg-gradient-to-br from-brand-gold to-brand-amber text-[#090B14] shadow-[0_10px_28px_rgba(251,191,36,0.32)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(251,191,36,0.48)] no-underline hover:no-underline',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function OutlineLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        baseButton,
        'border border-white/12 bg-brand-card text-white hover:border-white/24 hover:bg-white/[0.06] no-underline hover:no-underline',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function GlowOrb({ className }: { className?: string }) {
  // A soft radial glow WITHOUT `filter: blur()`. Large, animated blur layers
  // (blur-3xl on 400–600px orbs) trigger GPU texture corruption / rainbow
  // tearing on some mobile GPUs (Android Adreno/Mali). A radial-gradient mask
  // over the solid tint reproduces the look on the cheap raster path and keeps
  // scale/opacity animations compositor-only.
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute rounded-full',
        '[mask-image:radial-gradient(closest-side,#000,transparent)]',
        '[-webkit-mask-image:radial-gradient(closest-side,#000,transparent)]',
        className
      )}
    />
  );
}
