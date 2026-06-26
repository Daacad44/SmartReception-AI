import { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import {
  isSmartReceptionBusiness,
  isSmartReceptionStoredContent,
} from './smartreception-tenant';
import { buildBusinessProfileWelcome } from './business-profile-prompt.service';
import {
  isGenericEnglishGreeting,
  isPredominantlyEnglish,
} from './business-language.util';

/**
 * Build welcome for WhatsApp — Business Profile for tenants, platform menu for SmartReception.
 * Never mixes Knowledge Base into company introductions.
 */
export async function buildDynamicBusinessWelcome(
  businessId: string,
  preferEnglish = false
): Promise<string> {
  const profile = await getCachedBusinessProfile(businessId);
  const { business, aiConfiguration } = profile;

  if (isSmartReceptionBusiness(business)) {
    return SMARTRECEPTION_SERVICE_MENU;
  }

  const customGreeting = aiConfiguration?.greetingMessage?.trim();
  if (
    customGreeting &&
    !isSmartReceptionStoredContent(customGreeting) &&
    (preferEnglish || (!isGenericEnglishGreeting(customGreeting) && !isPredominantlyEnglish(customGreeting)))
  ) {
    return customGreeting;
  }

  return buildBusinessProfileWelcome(businessId, preferEnglish, business.name);
}

/** Reply when a tenant customer selects a numbered menu option (operational — from services). */
export async function buildTenantMenuOptionReply(
  businessId: string,
  option: number
): Promise<string> {
  const profile = await getCachedBusinessProfile(businessId);
  const service = profile.services[option - 1];
  if (!service) {
    return `Lambarka aad dooratay ma jiro. Fadlan dooro lambar ka mid ah adeegyadeena.\n\nJawaab "menu" si aad dib ugu noqoto liiska adeegyada.`;
  }

  const lines = [`${service.name}`];
  if (service.description?.trim()) {
    lines.push('', service.description.trim());
  } else {
    lines.push('', `Wax badan ka weydii ${profile.business.name} adeeggan.`);
  }

  if (service.price) {
    lines.push('', `Qiimaha: ${service.price}`);
  }

  lines.push('', 'Ma jiraan su\'aalo kale?');
  return lines.join('\n');
}
