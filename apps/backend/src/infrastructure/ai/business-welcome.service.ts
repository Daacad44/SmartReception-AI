import type { Industry } from '@prisma/client';
import { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import {
  isSmartReceptionBusiness,
  isSmartReceptionStoredContent,
} from './smartreception-tenant';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

const INDUSTRY_INTROS: Partial<Record<Industry, string>> = {
  RESTAURANT:
    'Waxaan nahay maqaayad bixisa cunto macaan, adeeg wanaagsan, iyo ballan qaadista miisaska.',
  HOTEL:
    'Waxaan nahay huteel bixiya qolal raaxo leh, adeeg marti-gelin, iyo ballan qaadista.',
  HOSPITAL:
    'Waxaan nahay cisbitaal bixiya adeegyo caafimaad, dhakhaatiir, iyo ballan qaadista bukaannada.',
  CLINIC:
    'Waxaan nahay rug caafimaad bixisa adeegyo caafimaad iyo ballan qaadista bukaannada.',
  SCHOOL:
    'Waxaan nahay iskuul bixiya waxbarasho tayo leh iyo adeegyo ardayda iyo waalidiinta.',
  UNIVERSITY:
    'Waxaan nahay jaamacad bixisa waxbarasho sare iyo adeegyo ardayda.',
  REAL_ESTATE:
    'Waxaan nahay shirkad guryo iyo dhul iibisa, kiraysiisa, iyo la-talin guryo.',
  ECOMMERCE:
    'Waxaan nahay dukaan online bixiya alaabooyin kala duwan iyo keenista alaabta.',
  RETAIL:
    'Waxaan nahay dukaan bixiya alaabooyin kala duwan iyo adeeg macaamiil wanaagsan.',
  SALON:
    'Waxaan nahay salon bixiya adeegyo qurxinta iyo ballan qaadista.',
  TRAVEL_AGENCY:
    'Waxaan nahay wakaaladda safarka bixisa tigidhada, dalxiiska, iyo qorsheynta safarka.',
  CONSULTING:
    'Waxaan nahay shirkad la-talin bixisa xalal ganacsi iyo adeegyo khabiir.',
  SERVICE_BUSINESS:
    'Waxaan nahay shirkad adeeg bixisa xalal ganacsi iyo taageero macaamiil.',
};

function formatServiceList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} iyo ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} iyo ${names[names.length - 1]}`;
}

function buildIntroduction(profile: Awaited<ReturnType<typeof getCachedBusinessProfile>>): string {
  const { business, services } = profile;

  if (business.description?.trim()) {
    return business.description.trim();
  }

  const serviceNames = services.map((s) => s.name).filter(Boolean);
  if (serviceNames.length > 0) {
    return `Waxaan nahay ${business.name}. Waxaan bixinaa adeegyada: ${formatServiceList(serviceNames)}.`;
  }

  if (business.businessType?.trim()) {
    return `Waxaan nahay ${business.businessType}. Waxaan diyaar u nahay inaan kaa caawinno wixii la xiriira adeegyadayada.`;
  }

  const industryIntro = INDUSTRY_INTROS[business.industry];
  if (industryIntro) {
    return industryIntro;
  }

  return `Waxaan nahay ${business.name}. Waxaan diyaar u nahay inaan kaa caawinno wixii la xiriira adeegyadayada.`;
}

/**
 * Build a dynamic Somali welcome message from the business workspace profile.
 * Never uses a fixed SmartReception greeting for tenant businesses.
 */
export async function buildDynamicBusinessWelcome(businessId: string): Promise<string> {
  const profile = await getCachedBusinessProfile(businessId);
  const { business, aiConfiguration, services } = profile;

  if (isSmartReceptionBusiness(business)) {
    return SMARTRECEPTION_SERVICE_MENU;
  }

  const customGreeting = aiConfiguration?.greetingMessage?.trim();
  if (customGreeting && !isSmartReceptionStoredContent(customGreeting)) {
    return customGreeting;
  }

  const lines: string[] = [`Ku soo dhawoow ${business.name}.`, '', buildIntroduction(profile)];

  if (services.length > 0) {
    lines.push('', 'Waxaan bixinaa adeegyada soo socda:', '');
    services.slice(0, 9).forEach((service, index) => {
      const emoji = EMOJI_NUMBERS[index] ?? `${index + 1}.`;
      lines.push(`${emoji} ${service.name}`);
    });
    lines.push('', 'Fadlan dooro lambarka adeegga aad rabto ama weydii su\'aal.');
  } else {
    lines.push('', 'Sideen kuu caawin karaa maanta?');
  }

  return lines.join('\n');
}

/** Reply when a tenant customer selects a numbered menu option. */
export async function buildTenantMenuOptionReply(
  businessId: string,
  option: number
): Promise<string | null> {
  const profile = await getCachedBusinessProfile(businessId);
  const service = profile.services[option - 1];
  if (!service) return null;

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
