import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  BRAND,
  BRAND_COLORS,
  BRAND_ICON_SIZE,
  BRAND_LOGO_SIZE,
  BRAND_NAME,
  BRAND_TAGLINE,
} from '@/lib/brand';

export type BrandLogoVariant = 'full' | 'icon' | 'app-icon' | 'wordmark';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  style?: CSSProperties;
  /** When true, the image is hidden from assistive tech (parent already names the brand). */
  decorative?: boolean;
}

/**
 * Renders an official SomReception AI asset. Presentation only — never
 * recolors, filters, crops, or reconstructs the logo.
 *
 * - `full` / `wordmark` → approved horizontal lockup
 * - `icon` / `app-icon` → approved app mark
 */
export function BrandLogo({
  variant = 'full',
  className,
  style,
  decorative = false,
}: BrandLogoProps) {
  const isIcon = variant === 'icon' || variant === 'app-icon';
  const src = isIcon ? BRAND.assets.icon : BRAND.assets.logo;
  const size = isIcon ? BRAND_ICON_SIZE : BRAND_LOGO_SIZE;

  return (
    <img
      src={src}
      alt={decorative ? '' : BRAND_NAME}
      aria-hidden={decorative || undefined}
      width={size.width}
      height={size.height}
      decoding="async"
      draggable={false}
      className={cn(
        'select-none bg-transparent object-contain object-left',
        isIcon ? 'block h-10 w-10 object-center' : 'block h-10 w-auto max-w-full',
        className
      )}
      style={style}
    />
  );
}

interface BrandTaglineProps {
  /** Dark / navy surfaces use white; light surfaces use brand navy. */
  onDark?: boolean;
  className?: string;
  as?: 'p' | 'span';
}

export function BrandTagline({
  onDark = false,
  className,
  as: Tag = 'span',
}: BrandTaglineProps) {
  return (
    <Tag
      className={cn(
        onDark ? 'text-white' : 'text-[#0D1B4B]',
        className
      )}
      style={{ color: onDark ? BRAND_COLORS.white : BRAND_COLORS.navy }}
    >
      {BRAND_TAGLINE}
    </Tag>
  );
}

interface LogoMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}

/** Official SomReception AI app icon. `size` is the displayed width and height in pixels. */
export function LogoMark({ size = 40, className, decorative }: LogoMarkProps) {
  return (
    <BrandLogo
      variant="icon"
      decorative={decorative}
      className={cn('flex-none', className)}
      style={{ width: size, height: size }}
    />
  );
}

interface LogoProps {
  className?: string;
  iconSize?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  decorative?: boolean;
}

/**
 * Full SomReception AI lockup. `showWordmark={false}` renders the official icon
 * instead of inventing a shortened mark. `iconSize` is the displayed height.
 */
export function Logo({
  className,
  iconSize = 40,
  showWordmark = true,
  decorative,
}: LogoProps) {
  if (!showWordmark) {
    return (
      <LogoMark size={iconSize} className={className} decorative={decorative} />
    );
  }

  return (
    <BrandLogo
      variant="full"
      decorative={decorative}
      className={cn('flex-none', className)}
      style={{ height: iconSize, width: 'auto' }}
    />
  );
}
