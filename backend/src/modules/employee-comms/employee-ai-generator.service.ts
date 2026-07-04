import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { getBusinessProfileContext } from '../../infrastructure/ai/business-profile-prompt.service';
import { ValidationError } from '../../core/errors';
import { getEmployeeCommLimits } from './employee-limits.service';
import { prisma } from '../../infrastructure/database/prisma';

export type GenerateEmployeeMessageInput = {
  prompt: string;
  tone?: string;
  type?: string;
  language?: 'so' | 'en';
};

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!config.ai.geminiApiKey) throw new ValidationError('AI is not configured');
  if (!genAI) genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
  return genAI;
}

export async function generateEmployeeMessageWithAi(
  businessId: string,
  input: GenerateEmployeeMessageInput
): Promise<{ message: string; tone: string }> {
  const limits = await getEmployeeCommLimits(businessId);
  if (!limits.aiGenerator) {
    throw new ValidationError('AI message generator requires Business plan or higher');
  }

  const [profileContext, business] = await Promise.all([
    getBusinessProfileContext(businessId),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  const language = input.language ?? 'so';
  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' });

  const aiPrompt = `Write an internal employee WhatsApp message for ${business?.name}.
Use company brand tone from profile. Message type: ${input.type ?? 'ANNOUNCEMENT'}.
Tone: ${input.tone ?? 'professional and friendly'}.
Language: ${language === 'so' ? 'Somali' : 'English'}.

BUSINESS PROFILE:
${profileContext}

REQUEST: ${input.prompt}

Rules:
- Use {{employee_name}} for personalization
- Keep under 900 characters
- Suitable for WhatsApp internal communication
Return JSON: { "message": "...", "tone": "..." }`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: aiPrompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  });

  const raw = result.response.text()?.trim() || '{}';
  try {
    return JSON.parse(raw) as { message: string; tone: string };
  } catch {
    return { message: raw.slice(0, 900), tone: input.tone ?? 'professional' };
  }
}
