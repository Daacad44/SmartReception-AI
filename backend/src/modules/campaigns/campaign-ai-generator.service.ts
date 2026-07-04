import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { getCachedBusinessProfile } from '../../infrastructure/ai/business-tenant-cache.service';
import { getBusinessProfileContext } from '../../infrastructure/ai/business-profile-prompt.service';
import { searchKnowledgeContext } from '../../infrastructure/ai/knowledge-search.service';
import { ValidationError } from '../../core/errors';
import { assertCampaignCreateAllowed, getCampaignPlanLimits } from './campaign-limits.service';

export type GenerateCampaignInput = {
  prompt: string;
  type?: string;
  tone?: string;
  language?: 'so' | 'en';
  versions?: number;
};

export type GeneratedCampaignVersion = {
  title: string;
  message: string;
  callToAction: string;
  tone: string;
};

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) throw new ValidationError('AI is not configured');
  if (!genAI) genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
  return genAI;
}

/** Generate campaign copy using only the current business knowledge base. */
export async function generateCampaignWithAi(
  businessId: string,
  input: GenerateCampaignInput
): Promise<{ versions: GeneratedCampaignVersion[] }> {
  const limits = await getCampaignPlanLimits(businessId);
  if (!limits.aiGenerator) {
    throw new ValidationError('AI Campaign Generator requires Professional or Enterprise plan');
  }

  const [profile, profileContext, knowledge] = await Promise.all([
    getCachedBusinessProfile(businessId),
    getBusinessProfileContext(businessId),
    searchKnowledgeContext(businessId, input.prompt),
  ]);

  const versionCount = Math.min(Math.max(input.versions ?? 2, 1), 4);
  const language = input.language ?? 'so';
  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' });

  const aiPrompt = `You are a marketing copywriter for ${profile.business.name} ONLY.
Use BUSINESS PROFILE for company identity and KNOWLEDGE BASE for services/pricing details.
Never mention SmartReception or other businesses.

BUSINESS PROFILE (identity only):
${profileContext}

KNOWLEDGE BASE (operational — pricing, packages, FAQs):
${knowledge || '(none)'}

USER REQUEST: ${input.prompt}
CAMPAIGN TYPE: ${input.type ?? 'MARKETING'}
TONE: ${input.tone ?? 'professional and friendly'}
LANGUAGE: ${language === 'so' ? 'Somali (Af-Soomaali)' : 'English'}

Generate ${versionCount} WhatsApp campaign versions as JSON array:
[{
  "title": "campaign name",
  "message": "WhatsApp message with {{customer_name}} variable",
  "callToAction": "short CTA",
  "tone": "tone used"
}]

Rules:
- Use {{customer_name}} and {{business_name}} variables
- Keep messages under 900 characters
- Include relevant emojis for WhatsApp
- Be specific to ${profile.business.name}`;

  const result = await model.generateContent(aiPrompt);
  const text = result.response.text()?.trim() ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? '[]') as GeneratedCampaignVersion[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ValidationError('AI could not generate campaign content');
  }

  return { versions: parsed.slice(0, versionCount) };
}
