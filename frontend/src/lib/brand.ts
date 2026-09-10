export const BRAND_NAME = 'SomReception AI';
export const BRAND_TAGLINE = 'AI Receptionist for Modern Businesses';
export const BRAND_TITLE = 'SomReception AI — AI Receptionist for Modern Businesses';
export const BRAND_DESCRIPTION =
  'AI Receptionist for Modern Businesses';

export const CONTACT_PHONE_DISPLAY = '+252 687 716 299';
export const CONTACT_PHONE_WHATSAPP = '252687716299';
export const CONTACT_EMAIL = 'support@somreception.com';
export const WHATSAPP_LINK = `https://wa.me/${CONTACT_PHONE_WHATSAPP}`;
export const MAILTO_SUPPORT = `mailto:${CONTACT_EMAIL}`;

/** Cache-bust after the official rasters were given a transparent canvas. */
export const BRAND_ASSET_VERSION = '20260910';

const v = (path: string) => `${path}?v=${BRAND_ASSET_VERSION}`;

/** Intrinsic pixel size of the approved full lockup (transparent canvas). */
export const BRAND_LOGO_SIZE = { width: 976, height: 243 } as const;
/** Intrinsic pixel size of the approved app icon (transparent canvas). */
export const BRAND_ICON_SIZE = { width: 833, height: 814 } as const;

export const BRAND_COLORS = {
  navy: '#0D1B4B',
  amber: '#F59E0B',
  lightBlue: '#DBEAFE',
  white: '#FFFFFF',
  canvas: '#090B14',
} as const;

export const BRAND_ASSETS = {
  logo: v('/brand/somreception-logo.png'),
  icon: v('/brand/somreception-icon.png'),
  appIcon: v('/brand/somreception-icon.png'),
  favicon: v('/brand/favicon-32.png'),
  ogImage: '/brand/og-image.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
  pwa192: '/brand/pwa-192.png',
  pwa512: '/brand/pwa-512.png',
} as const;

export const BRAND = {
  name: BRAND_NAME,
  tagline: BRAND_TAGLINE,
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
  colors: BRAND_COLORS,
  assets: BRAND_ASSETS,
  logo: BRAND_ASSETS.logo,
  icon: BRAND_ASSETS.icon,
  favicon: BRAND_ASSETS.favicon,
  ogImage: BRAND_ASSETS.ogImage,
  appleTouchIcon: BRAND_ASSETS.appleTouchIcon,
  pwa192: BRAND_ASSETS.pwa192,
  pwa512: BRAND_ASSETS.pwa512,
} as const;

/** Primary auth / marketing CTA — amber fill, navy label. */
export const BRAND_CTA_CLASS =
  'bg-[#F59E0B] text-[#0D1B4B] hover:bg-[#F59E0B]/90';
