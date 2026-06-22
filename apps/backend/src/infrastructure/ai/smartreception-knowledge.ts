/** SmartReception AI — Somali-first company knowledge for AI receptionist and KB seeding. */

import { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';

export const GEMINI_ERROR_MESSAGE_SO =
  'Mahadsanid fariintaada. Waqtigan AI-ga waxaa ku dhacay cilad ku meel gaar ah. Fadlan sug wax yar ama la xiriir kooxdayada taageerada.';

export const SMARTRECEPTION_WELCOME_SO = SMARTRECEPTION_SERVICE_MENU;

export const SMARTRECEPTION_WELCOME_EN = `Welcome to SmartReception AI.

We provide:

• AI Receptionists
• WhatsApp Automation
• Appointment Systems
• CRM Solutions
• Website Development
• Mobile App Development
• Custom Software Development

How can we help you today?`;

export const SMARTRECEPTION_WELCOME_MESSAGE = SMARTRECEPTION_WELCOME_SO;

export { SMARTRECEPTION_SERVICE_MENU } from './somali-menu';

export const LEAD_THANK_YOU_SO =
  'Mahadsanid. Kooxdayadu waxay kula soo xiriiri doontaa dhawaan.';

export const LEAD_THANK_YOU_EN = 'Thank you. Our team will contact you shortly.';

const SOMALI_MARKERS =
  /\b(waa|maxay|ma|sidee|mahadsanid|waxaan|adeeg|website|app|mobile|samaysaan|dhistaan|bixisaan|caawin|fariin|salaan|asc)\b|[^\x00-\x7F]/i;

export function detectMessageLanguage(text: string): 'so' | 'en' | 'mixed' {
  const trimmed = text.trim();
  if (!trimmed) return 'so';

  const somaliHits = (trimmed.match(SOMALI_MARKERS) || []).length;
  const latinWords = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z]+$/.test(w)).length;

  if (somaliHits >= 2 && latinWords >= 2) return 'mixed';
  if (somaliHits >= 1) return 'so';
  return 'en';
}

export function getWelcomeForLanguage(language: 'so' | 'en' | 'mixed'): string {
  if (language === 'en') return SMARTRECEPTION_WELCOME_EN;
  if (language === 'mixed') {
    return `${SMARTRECEPTION_WELCOME_SO}\n\n---\n\n${SMARTRECEPTION_WELCOME_EN}`;
  }
  return SMARTRECEPTION_WELCOME_SO;
}

export const SMARTRECEPTION_SYSTEM_PROMPT = `You are SmartReception AI — professional Smart Sales Consultant (ma aha FAQ bot kaliya).

Company: SmartReception AI
WhatsApp: +25268776299
Website: https://somreception.botandev.com
Portfolio: https://botandev.com
API: https://api.somreception.botandev.com

Your role as Sales Consultant:
1. Sharax adeegga si qoto dheer
2. Weydii su'aalo muhiim ah (hal ama laba hal mar)
3. Ururi xogta mashruuca
4. Ogow baahida macmiilka
5. Soo jeedi adeeg ku habboon
6. Muuji portfolio: https://botandev.com
7. Soo bandhig kulan bilaash ah (appointment)
8. U gudbi kooxda SmartReception marka xogta la helo

SERVICES:
- AI Receptionist / AI Receptionist — 24/7 automated customer support
- WhatsApp Automation — instant replies, lead capture, appointments, FAQ
- Appointment Management — booking, rescheduling, reminders
- CRM Systems — customer profiles, conversation history, lead tracking
- Knowledge Base Systems — AI answers from company documents
- Website Development / Website Development — professional websites
- Mobile App Development — Android and iOS apps
- Custom Software Development & SaaS Development
- Business Automation

SOMALI PHRASES YOU MUST UNDERSTAND:
- "waa maxay adeegyadiina" → explain our services
- "website ma samaysaan" → yes, we build professional websites
- "app mobile ma dhistaan" → yes, we develop Android and iOS apps
- "WhatsApp automation ma bixisaan" → yes, full WhatsApp automation
- "CRM ma samaysaan" → yes, CRM with customer profiles and lead tracking
- "software ma samaysaan" → yes, custom software and SaaS platforms

LANGUAGE RULES:
- DEFAULT: Always reply in Somali (Af-Soomaali)
- English ONLY when customer explicitly requests English (e.g. "in English", "English please")
- Never send generic fallback messages
- Always end service answers with contact: WhatsApp +25268776299

Never expose API errors. Never invent exact pricing — offer tailored quote.
Keep WhatsApp messages concise and professional.`;

export const SMARTRECEPTION_KB_FAQS: Array<{
  title: string;
  category: string;
  question: string;
  answer: string;
  questionSo?: string;
  answerSo?: string;
}> = [
  {
    title: 'What is SmartReception',
    category: 'General',
    question: 'What is SmartReception?',
    answer:
      'SmartReception is an AI-powered customer communication and automation platform for WhatsApp, appointments, CRM, and support.',
    questionSo: 'Waa maxay SmartReception?',
    answerSo:
      'SmartReception waa barnaamij AI ah oo otomaatiga ah oo ka caawiya ganacsiyada inay maamulaan WhatsApp, ballamaha, CRM, iyo taageerada macaamiisha.',
  },
  {
    title: 'Services Somali',
    category: 'Services',
    question: 'What services do you offer?',
    answer: 'AI Receptionist, WhatsApp Automation, Appointments, CRM, Websites, Mobile Apps, Custom Software.',
    questionSo: 'Waa maxay adeegyadiina?',
    answerSo:
      'Waxaan bixinaa AI Receptionist, WhatsApp Automation, Nidaamyada Ballamaha, CRM, Website Development, Mobile Apps, iyo Custom Software Development.',
  },
  {
    title: 'Websites',
    category: 'Services',
    question: 'Do you provide websites?',
    answer: 'Yes. We build professional business websites.',
    questionSo: 'Website ma samaysaan?',
    answerSo: 'Haa, waxaan samaynaa website-yo xirfad leh oo ganacsi.',
  },
  {
    title: 'Mobile Apps',
    category: 'Services',
    question: 'Do you build mobile apps?',
    answer: 'Yes. Android and iOS applications.',
    questionSo: 'App mobile ma dhistaan?',
    answerSo: 'Haa, waxaan dhiseynaa apps Android iyo iOS.',
  },
  {
    title: 'WhatsApp Automation',
    category: 'Services',
    question: 'Can SmartReception automate WhatsApp?',
    answer: 'Yes — automated replies, leads, appointments, and support on WhatsApp.',
    questionSo: 'WhatsApp automation ma bixisaan?',
    answerSo: 'Haa, waxaan bixinaa WhatsApp automation oo buuxa: jawaab degdeg ah, leads, ballamo, iyo taageero.',
  },
  {
    title: 'CRM',
    category: 'Services',
    question: 'Does SmartReception include CRM?',
    answer: 'Yes. Customer profiles, conversation history, lead scoring.',
    questionSo: 'CRM ma samaysaan?',
    answerSo: 'Haa, waxaan bixinaa CRM: macluumaadka macaamiisha, taariikhda wada hadalka, iyo lead tracking.',
  },
  {
    title: 'Software',
    category: 'Services',
    question: 'Do you build custom software?',
    answer: 'Yes. Custom SaaS platforms and business systems.',
    questionSo: 'Software ma samaysaan?',
    answerSo: 'Haa, waxaan samaynaa software gaar ah iyo SaaS platforms.',
  },
  {
    title: 'Appointments',
    category: 'Services',
    question: 'How do appointments work?',
    answer: 'Customers book via WhatsApp; SmartReception sends reminders and syncs calendars.',
    questionSo: 'Sidee ballamuhu u shaqeeyaan?',
    answerSo: 'Macaamiishu waxay ballan ka qabsan karaan WhatsApp; SmartReception waxay diraysaa xusuusin.',
  },
  {
    title: 'Pricing',
    category: 'Sales',
    question: 'How much does SmartReception cost?',
    answer: 'Flexible plans based on your business. Contact us for a tailored quote.',
    questionSo: 'Immisa ayey ku kacaysaa?',
    answerSo: 'Qiimaha wuu kala duwan yahay. Nala soo xiriir si aan kuu siino qiimo ku habboon ganacsigaaga.',
  },
];
