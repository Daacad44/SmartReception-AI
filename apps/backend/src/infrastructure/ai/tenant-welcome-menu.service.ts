import type { BusinessProfile } from '@prisma/client';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import {
  ensureBusinessProfile,
  getCachedBusinessProfileRecord,
} from './business-profile-cache.service';
import { buildProfileWelcomeMessage } from './business-profile-prompt.service';
import { isPredominantlyEnglish } from './business-language.util';
import { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';
import { isSmartReceptionBusiness } from './smartreception-tenant';

const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'] as const;

function resolveTenantDisplayName(profile: BusinessProfile, workspaceName: string): string {
  const profileName = profile.businessName?.trim();
  const workspace = workspaceName.trim();
  if (!profileName) return workspace || 'ganacsigeena';
  if (!workspace) return profileName;
  if (
    workspace.toLowerCase().includes('smartreception') &&
    !profileName.toLowerCase().includes('smartreception')
  ) {
    return profileName;
  }
  return profileName;
}

function buildSomaliProfileSummary(profile: BusinessProfile, name: string): string {
  const fields = [
    profile.shortIntroduction,
    profile.companySummary,
    profile.mission,
    profile.aboutUs,
    profile.companyOverview,
    profile.businessDescription,
    profile.longIntroduction,
    profile.companyIntroduction,
  ];

  for (const field of fields) {
    if (field?.trim() && !isPredominantlyEnglish(field)) {
      return field.trim();
    }
  }

  return `Waxaan nahay ${name} — shirkad bixisa horumarinta software-ka, AI, otomaatiga ganacsiga, iyo xalalka dijitaalka ah.`;
}

/** Somali welcome + company profile summary + numbered services menu for tenant businesses. */
export async function buildTenantWelcomeMenu(businessId: string): Promise<string> {
  const profile = await getCachedBusinessProfile(businessId);

  if (isSmartReceptionBusiness(profile.business)) {
    return SMARTRECEPTION_SERVICE_MENU;
  }

  const record =
    (await getCachedBusinessProfileRecord(businessId)) ?? (await ensureBusinessProfile(businessId));
  const name = resolveTenantDisplayName(record, profile.business.name);
  const intro = buildSomaliProfileSummary(record, name);

  const lines = [`Ku soo dhawoow ${name}. 👋`, '', intro, '', 'Adeegyadeena:'];

  const services = profile.services;
  if (services.length > 0) {
    services.forEach((service, index) => {
      const emoji = NUMBER_EMOJI[index] ?? `${index + 1}.`;
      lines.push(`${emoji} ${service.name}`);
    });
  } else {
    lines.push('', '(Adeegyo weli lama darin — Settings → Services ku dar adeegyadaada.)');
  }

  lines.push(
    '',
    'Fadlan dooro lambarka adeegga aad rabto.',
    'Tusaale: jawaab "1" ama "2"',
    '',
    record.callToAction?.trim() && !isPredominantlyEnglish(record.callToAction)
      ? record.callToAction.trim()
      : 'Sidee ayaan maanta kuu caawin karnaa?'
  );

  return lines.join('\n');
}

/** Shorter profile-only welcome (fallback). */
export async function buildTenantProfileWelcome(businessId: string): Promise<string> {
  const profile = await getCachedBusinessProfile(businessId);

  if (isSmartReceptionBusiness(profile.business)) {
    return SMARTRECEPTION_SERVICE_MENU;
  }

  const record =
    (await getCachedBusinessProfileRecord(businessId)) ?? (await ensureBusinessProfile(businessId));
  return buildProfileWelcomeMessage(record, false, profile.business.name);
}
