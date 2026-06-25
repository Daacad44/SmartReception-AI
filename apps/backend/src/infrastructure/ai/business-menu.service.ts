import { prisma } from '../database/prisma';
import { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';
import {
  buildDefaultGreetingMessage,
  isSmartReceptionBusiness,
  isSmartReceptionStoredContent,
} from './smartreception-tenant';

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

/** Build a tenant-scoped WhatsApp greeting/menu. Never returns SmartReception content for other businesses. */
export async function buildBusinessGreetingMenu(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  if (isSmartReceptionBusiness(business)) {
    return SMARTRECEPTION_SERVICE_MENU;
  }

  const aiConfig = await prisma.aIConfiguration.findUnique({ where: { businessId } });
  const customGreeting = aiConfig?.greetingMessage?.trim();
  if (customGreeting && !isSmartReceptionStoredContent(customGreeting)) {
    return customGreeting;
  }

  const services = await prisma.service.findMany({
    where: { businessId, isActive: true },
    orderBy: { createdAt: 'asc' },
    take: 9,
    select: { name: true, description: true },
  });

  const lines: string[] = [`Ku soo dhawoow ${business.name}.`];

  if (business.description?.trim()) {
    lines.push('', business.description.trim());
  }

  if (services.length > 0) {
    lines.push('', 'Waxaan bixinaa adeegyada soo socda:', '');
    services.forEach((service, index) => {
      const emoji = EMOJI_NUMBERS[index] ?? `${index + 1}.`;
      lines.push(`${emoji} ${service.name}`);
    });
    lines.push('', 'Fadlan dooro lambarka adeegga aad rabto ama weydii su\'aal.');
  } else {
    lines.push('', 'Sideen kuu caawin karnaa maanta?');
  }

  return lines.join('\n');
}

export function resolveBusinessGreetingFallback(businessName: string): string {
  return buildDefaultGreetingMessage(businessName);
}
