import type { BusinessProfile } from '@prisma/client';
import { prisma } from '../database/prisma';
import { ensureBusinessProfile, getCachedBusinessProfileRecord } from './business-profile-cache.service';
import { isPredominantlyEnglish } from './business-language.util';

function resolveDisplayName(profile: BusinessProfile, businessName?: string): string {
  const profileName = profile.businessName?.trim();
  const workspaceName = businessName?.trim();
  if (!profileName) return workspaceName || 'ganacsigeena';
  if (!workspaceName) return profileName;
  if (profileName.toLowerCase() !== workspaceName.toLowerCase()) {
    return workspaceName;
  }
  return profileName;
}

function pickIntroduction(profile: BusinessProfile, preferEnglish: boolean): string | null {
  const fields = [
    profile.longIntroduction,
    profile.companyIntroduction,
    profile.companySummary,
    profile.shortIntroduction,
    profile.aboutUs,
    profile.businessDescription,
  ];

  for (const field of fields) {
    if (!field?.trim()) continue;
    if (!preferEnglish && isPredominantlyEnglish(field)) continue;
    return field.trim();
  }

  return null;
}

function formatJsonList(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, string>)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }
  return String(value);
}

/** Build structured context for AI from Business Profile ONLY. */
export function formatBusinessProfileContext(
  profile: BusinessProfile,
  workspaceName?: string
): string {
  const sections: string[] = [];

  const push = (label: string, value?: string | null) => {
    if (value?.trim()) sections.push(`${label}: ${value.trim()}`);
  };

  const pushSomaliText = (label: string, value?: string | null) => {
    if (!value?.trim()) return;
    if (isPredominantlyEnglish(value)) return;
    sections.push(`${label}: ${value.trim()}`);
  };

  push('Business Name', resolveDisplayName(profile, workspaceName));
  push('Category', profile.businessCategory);
  push('Industry', profile.industryLabel);
  pushSomaliText('Overview', profile.companyOverview ?? profile.businessDescription);
  pushSomaliText('About Us', profile.aboutUs);
  pushSomaliText('Mission', profile.mission);
  pushSomaliText('Vision', profile.vision);
  pushSomaliText('Core Values', formatJsonList(profile.coreValues));
  pushSomaliText('Why Choose Us', profile.whyChooseUs);
  pushSomaliText('Company Introduction', profile.companyIntroduction ?? profile.longIntroduction);
  pushSomaliText('Company Summary', profile.companySummary ?? profile.shortIntroduction);
  push('Founder', profile.founder);
  push('Website', profile.website);
  push('Email', profile.email);
  push('Phone', profile.phone);
  push('WhatsApp', profile.whatsapp);
  push('Address', profile.address);
  push('City', profile.city);
  push('Country', profile.country);
  push('Working Hours', profile.workingHours);
  push('Google Maps', profile.googleMapsUrl);
  push('Social Media', formatJsonList(profile.socialMedia));
  if (profile.yearsInBusiness) push('Years in Business', String(profile.yearsInBusiness));
  push('Certifications', formatJsonList(profile.certifications));
  push('Awards', formatJsonList(profile.awards));
  push('Brand Tone', profile.brandTone);
  push('Languages', formatJsonList(profile.languages));
  push('Call To Action', profile.callToAction);

  return sections.join('\n');
}

/** Dynamic Somali/English welcome from Business Profile — never from Knowledge Base. */
export function buildProfileWelcomeMessage(
  profile: BusinessProfile,
  preferEnglish = false,
  workspaceName?: string
): string {
  const name = preferEnglish
    ? resolveDisplayName(profile, workspaceName) || 'our business'
    : resolveDisplayName(profile, workspaceName) || 'ganacsigeena';

  if (preferEnglish) {
    const intro =
      pickIntroduction(profile, true) ||
      `We are ${name}. We are ready to help you with our services.`;

    const lines = [`Welcome to ${name}.`, '', intro];

    if (profile.whyChooseUs?.trim()) {
      lines.push('', profile.whyChooseUs.trim());
    }
    if (profile.website?.trim()) lines.push('', `Website: ${profile.website.trim()}`);
    if (profile.email?.trim()) lines.push(`Email: ${profile.email.trim()}`);
    if (profile.phone?.trim() || profile.whatsapp?.trim()) {
      lines.push(`Phone/WhatsApp: ${profile.whatsapp?.trim() || profile.phone?.trim()}`);
    }
    lines.push('', profile.callToAction?.trim() || 'How can we help you today?');
    return lines.join('\n');
  }

  const intro =
    pickIntroduction(profile, false) ||
    `Waxaan nahay ${name}. Waxaan diyaar u nahay inaan kaa caawinno wixii la xiriira adeegyadayada.`;

  const lines = [`Ku soo dhawoow ${name}.`, '', intro];

  if (profile.whyChooseUs?.trim()) {
    lines.push('', profile.whyChooseUs.trim());
  }
  if (profile.website?.trim()) lines.push('', `Website:\n${profile.website.trim()}`);
  if (profile.email?.trim()) lines.push('', `Email:\n${profile.email.trim()}`);
  if (profile.phone?.trim() || profile.whatsapp?.trim()) {
    lines.push('', `WhatsApp:\n${profile.whatsapp?.trim() || profile.phone?.trim()}`);
  }
  lines.push('', profile.callToAction?.trim() || 'Sidee ayaan maanta kuu caawin karnaa?');
  return lines.join('\n');
}

export async function getBusinessProfileContext(businessId: string): Promise<string> {
  const [profile, business] = await Promise.all([
    getCachedBusinessProfileRecord(businessId).then(
      (row) => row ?? ensureBusinessProfile(businessId)
    ),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    }),
  ]);
  return formatBusinessProfileContext(profile, business?.name);
}

export async function buildBusinessProfileWelcome(
  businessId: string,
  preferEnglish = false,
  workspaceName?: string
): Promise<string> {
  const profile = (await getCachedBusinessProfileRecord(businessId)) ?? (await ensureBusinessProfile(businessId));
  return buildProfileWelcomeMessage(profile, preferEnglish, workspaceName);
}
