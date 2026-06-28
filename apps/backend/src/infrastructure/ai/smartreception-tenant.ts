import type { Business } from '@prisma/client';

const SMARTRECEPTION_SLUG_PATTERNS = ['smartreception', 'smart-reception'];

/** True when the workspace is the SmartReception platform (not a tenant customer). */
export function isSmartReceptionBusiness(
  business: Pick<Business, 'id' | 'slug' | 'name'>
): boolean {
  const platformId = process.env.SMARTRECEPTION_BUSINESS_ID?.trim();
  if (platformId && business.id === platformId) {
    return true;
  }

  const slug = business.slug.toLowerCase();
  if (SMARTRECEPTION_SLUG_PATTERNS.some((pattern) => slug.includes(pattern))) {
    return true;
  }

  const name = business.name.toLowerCase();
  return name.includes('smartreception');
}

/** Detect stored copy that belongs to the SmartReception platform defaults. */
export function isSmartReceptionStoredContent(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;

  const lower = text.toLowerCase();
  return (
    lower.includes('smartreception') ||
    lower.includes('somreception.botandev.com') ||
    lower.includes('botandev.com') ||
    (lower.includes('ai receptionist') && lower.includes('whatsapp automation'))
  );
}

export function buildDefaultSystemPrompt(businessName: string): string {
  return `You are the AI assistant for ${businessName}.
Help customers using only the knowledge base and business information provided for ${businessName}.
Be professional, concise, and helpful. Never reference other companies or platforms.`;
}

export function buildDefaultGreetingMessage(businessName: string): string {
  return `Ku soo dhawoow ${businessName}.\n\nSideen kuu caawin karnaa maanta?`;
}

export function buildDefaultLeadThankYou(businessName: string): string {
  return `Mahadsanid. Kooxda ${businessName} waxay kula soo xiriiri doontaa dhawaan.`;
}
