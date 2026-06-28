/** Meta WhatsApp template language codes (not display names like "English"). */
const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'en',
  'english (us)': 'en_US',
  'english us': 'en_US',
  'english (uk)': 'en_GB',
  'english uk': 'en_GB',
  somali: 'so',
  arabic: 'ar',
};

export function normalizeWhatsAppTemplateLanguage(input: string | null | undefined): string {
  const raw = input?.trim();
  if (!raw) return 'en';

  const lower = raw.toLowerCase();
  if (LANGUAGE_ALIASES[lower]) return LANGUAGE_ALIASES[lower];

  if (/^[a-z]{2}(_[A-Za-z0-9]+)?$/.test(raw)) {
    return raw.includes('_') ? raw : raw.toLowerCase();
  }

  return 'en';
}

/** True when name looks like a Meta template slug (e.g. smartreception_welcome). */
export function isMetaTemplateSlug(name: string): boolean {
  return /^[a-z][a-z0-9_]{0,199}$/.test(name.trim());
}
