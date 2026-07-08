import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** SomReception AI brand mark: headset + service bell forming an "S", with circuit accents. */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('flex-none', className)}
      role="img"
      aria-label="SomReception AI"
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="7" x2="40" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="0.52" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M13 33v-6a11 11 0 0 1 22 0v6"
        stroke="#CBD5E1"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <rect x="8.4" y="30.5" width="5.4" height="11" rx="2.7" fill="#E2E8F0" />
      <rect x="34.2" y="30.5" width="5.4" height="11" rx="2.7" fill="#E2E8F0" />
      <path
        d="M31.2 17.6c0-3.4-3.8-5.6-8.4-5.6-4.8 0-8.4 2.4-8.4 6 0 7.1 17.4 4.4 17.4 11.6 0 3.8-3.9 6.2-9 6.2-4.7 0-8.2-2-8.9-4.9"
        stroke={`url(#${gradientId})`}
        strokeWidth="4.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M33 15.5h4.5M37.5 15.5v-4" stroke={`url(#${gradientId})`} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="37.5" cy="10" r="2" fill={`url(#${gradientId})`} />
      <circle cx="40.5" cy="15.5" r="1.7" fill={`url(#${gradientId})`} />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  iconSize?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

/** Full SomReception AI lockup: brand mark + wordmark. Use `showWordmark={false}` for icon-only spots. */
export function Logo({ className, iconSize = 38, showWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={iconSize} />
      {showWordmark && (
        <span className={cn('whitespace-nowrap text-lg font-extrabold tracking-tight text-white', wordmarkClassName)}>
          Som<span className="text-[#FBBF24]">Reception</span> <span className="font-bold text-[#94A3B8]">AI</span>
        </span>
      )}
    </span>
  );
}
