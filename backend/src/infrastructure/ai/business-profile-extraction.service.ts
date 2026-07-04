import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { extractDocumentText } from '../../modules/knowledge/document-processor';
import { storageService } from '../storage';
import { logger } from '../../core/logger';
import {
  invalidateBusinessProfileCache,
} from './business-profile-cache.service';
import { invalidateBusinessTenantCache } from './business-tenant-cache.service';

export type ExtractedProfileFields = {
  businessName?: string;
  businessCategory?: string;
  industryLabel?: string;
  companyOverview?: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  coreValues?: string[];
  businessDescription?: string;
  founder?: string;
  website?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  country?: string;
  city?: string;
  workingHours?: string;
  googleMapsUrl?: string;
  socialMedia?: Record<string, string>;
  yearsInBusiness?: number;
  certifications?: string[];
  awards?: string[];
  brandTone?: string;
  languages?: string[];
  callToAction?: string;
  whyChooseUs?: string;
  companyIntroduction?: string;
  companySummary?: string;
  shortIntroduction?: string;
  longIntroduction?: string;
};

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!genAI) genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
  return genAI;
}

async function extractTextFromPdf(fileUrl: string): Promise<string> {
  const buffer = await storageService.download(fileUrl);
  return extractDocumentText(buffer, 'PDF');
}

/** Extract Business Profile fields from PDF text — stored in Business Profile only. */
export async function extractProfileFromText(text: string): Promise<ExtractedProfileFields> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  const prompt = `Extract company identity information from this Business Profile document.
Return JSON only with these optional string fields:
businessName, businessCategory, industryLabel, companyOverview, aboutUs, mission, vision,
businessDescription, founder, website, email, phone, whatsapp, address, country, city,
workingHours, googleMapsUrl, brandTone, callToAction, whyChooseUs, companyIntroduction,
companySummary, shortIntroduction, longIntroduction,
coreValues (array), certifications (array), awards (array), languages (array),
socialMedia (object), yearsInBusiness (number).

Do NOT include product pricing, FAQs, or operational manuals — only company identity.

DOCUMENT:
${text.slice(0, 40000)}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text()?.trim() || '{}';
  try {
    return JSON.parse(raw) as ExtractedProfileFields;
  } catch {
    logger.warn('Profile PDF JSON parse failed', { preview: raw.slice(0, 200) });
    return { companySummary: text.slice(0, 2000) };
  }
}

export async function processBusinessProfilePdf(businessId: string): Promise<void> {
  const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
  if (!profile?.profilePdfUrl) return;

  await prisma.businessProfile.update({
    where: { businessId },
    data: { extractionStatus: 'PROCESSING', extractionError: null },
  });

  try {
    const text = await extractTextFromPdf(profile.profilePdfUrl);
    const extracted = await extractProfileFromText(text);

    await prisma.businessProfile.update({
      where: { businessId },
      data: {
        businessName: extracted.businessName ?? profile.businessName,
        businessCategory: extracted.businessCategory ?? profile.businessCategory,
        industryLabel: extracted.industryLabel ?? profile.industryLabel,
        companyOverview: extracted.companyOverview ?? profile.companyOverview,
        aboutUs: extracted.aboutUs ?? profile.aboutUs,
        mission: extracted.mission ?? profile.mission,
        vision: extracted.vision ?? profile.vision,
        coreValues: extracted.coreValues ?? profile.coreValues ?? undefined,
        businessDescription: extracted.businessDescription ?? profile.businessDescription,
        founder: extracted.founder ?? profile.founder,
        website: extracted.website ?? profile.website,
        email: extracted.email ?? profile.email,
        phone: extracted.phone ?? profile.phone,
        whatsapp: extracted.whatsapp ?? profile.whatsapp,
        address: extracted.address ?? profile.address,
        country: extracted.country ?? profile.country,
        city: extracted.city ?? profile.city,
        workingHours: extracted.workingHours ?? profile.workingHours,
        googleMapsUrl: extracted.googleMapsUrl ?? profile.googleMapsUrl,
        socialMedia: extracted.socialMedia ?? profile.socialMedia ?? undefined,
        yearsInBusiness: extracted.yearsInBusiness ?? profile.yearsInBusiness,
        certifications: extracted.certifications ?? profile.certifications ?? undefined,
        awards: extracted.awards ?? profile.awards ?? undefined,
        brandTone: extracted.brandTone ?? profile.brandTone,
        languages: extracted.languages ?? profile.languages ?? undefined,
        callToAction: extracted.callToAction ?? profile.callToAction,
        whyChooseUs: extracted.whyChooseUs ?? profile.whyChooseUs,
        companyIntroduction: extracted.companyIntroduction ?? profile.companyIntroduction,
        companySummary: extracted.companySummary ?? profile.companySummary,
        shortIntroduction: extracted.shortIntroduction ?? profile.shortIntroduction,
        longIntroduction: extracted.longIntroduction ?? profile.longIntroduction,
        extractionStatus: 'COMPLETED',
        extractedAt: new Date(),
      },
    });

    invalidateBusinessProfileCache(businessId);
    invalidateBusinessTenantCache(businessId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    await prisma.businessProfile.update({
      where: { businessId },
      data: { extractionStatus: 'FAILED', extractionError: message },
    });
    throw error;
  }
}
