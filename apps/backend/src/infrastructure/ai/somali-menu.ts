/** SmartReception Somali WhatsApp interactive service menu. */

export const SMARTRECEPTION_SERVICE_MENU = `Ku soo dhawoow SmartReception AI.

Waxaan bixinaa adeegyada soo socda:

1️⃣ AI Receptionist
2️⃣ WhatsApp Automation
3️⃣ Appointment Systems
4️⃣ CRM Solutions
5️⃣ Website Development
6️⃣ Mobile App Development
7️⃣ Custom Software Development
8️⃣ Qiimaha Adeegyada
9️⃣ La Xiriir Kooxdayada

Fadlan dooro lambarka adeegga aad rabto.

Tusaale:
Jawaab "1" ama "2" ama "3"`;

export const CONTACT_FOOTER_SO = `La xiriir:
WhatsApp: +25268776299
Website: https://somreception.botandev.com`;

export const MENU_OPTIONS: Record<number, { title: string; content: string }> = {
  1: {
    title: 'AI Receptionist',
    content: `AI Receptionist

SmartReception AI Receptionist wuxuu kuu shaqayn karaa 24/7.

Faa'iidooyinka:
• Auto Reply
• Customer Support
• Lead Collection
• Appointment Booking
• Multi-language Support

Haddii aad rabto demo ama qiime:

La xiriir:
WhatsApp: +25268776299`,
  },
  2: {
    title: 'WhatsApp Automation',
    content: `WhatsApp Automation

Waxaan kuu samaynaynaa:
• Auto Reply
• AI Chatbot
• Lead Generation
• Appointment Booking
• Customer Support
• WhatsApp Cloud API Integration

Faa'iidooyinka:
✓ Jawaab degdeg ah
✓ Macaamiil badan
✓ Shaqo yar oo gacanta ah
✓ Adeeg 24/7

Faahfaahin dheeraad ah:

WhatsApp: +25268776299
Website: https://somreception.botandev.com`,
  },
  3: {
    title: 'Appointment Systems',
    content: `Appointment Systems

Waxaan kuu samaynaynaa:
• Booking Systems
• Appointment Reminders
• Calendar Management
• WhatsApp Booking

La xiriir:
+25268776299`,
  },
  4: {
    title: 'CRM Solutions',
    content: `CRM Solutions

Waxaan kuu samaynaynaa:
• Customer Management
• Lead Tracking
• Contact Management
• Sales Tracking

La xiriir:
+25268776299`,
  },
  5: {
    title: 'Website Development',
    content: `Website Development

Waxaan dhisnaa:
• Business Websites
• Company Websites
• E-commerce Websites
• SaaS Platforms
• Portfolio Websites

La xiriir:
+25268776299`,
  },
  6: {
    title: 'Mobile App Development',
    content: `Mobile App Development

Waxaan samaynaa:
• Android Apps
• iOS Apps
• Cross Platform Apps

La xiriir:
+25268776299`,
  },
  7: {
    title: 'Custom Software Development',
    content: `Custom Software Development

Waxaan samaynaa:
• Hospital Systems
• School Systems
• Inventory Systems
• POS Systems
• CRM Systems
• Enterprise Systems

La xiriir:
+25268776299`,
  },
  8: {
    title: 'Qiimaha Adeegyada',
    content: `Qiimaha Adeegyada

Qiimuhu wuxuu ku xiran yahay baaxadda mashruuca.

Si aad u hesho qiime sax ah fadlan noo soo dir:
• Magacaaga
• Magaca Ganacsiga
• Adeegga aad rabto

Kooxdayada ayaa kula soo xiriiri doonta.`,
  },
  9: {
    title: 'La Xiriir SmartReception',
    content: `La Xiriir SmartReception

WhatsApp:
+25268776299

Website:
https://somreception.botandev.com

Email:
info@botandev.com`,
  },
};

const MENU_KEYWORDS: Record<number, RegExp[]> = {
  1: [/ai\s*receptionist/i, /receptionist/i, /soo dhaweey/i],
  2: [/whatsapp\s*automation/i, /whatsapp/i, /automation/i],
  3: [/appointment/i, /ballan/i, /booking/i],
  4: [/\bcrm\b/i],
  5: [/website/i, /web\s*site/i],
  6: [/mobile\s*app/i, /\bapp\b/i, /android/i, /ios/i],
  7: [/custom\s*software/i, /software/i, /saas/i],
  8: [/qiimo/i, /pricing/i, /price/i, /cost/i],
  9: [/xiriir/i, /contact/i, /la xiriir/i],
};

const GREETING_ONLY =
  /^(hi|hello|hey|yo|salaam|asc|asalamu|waad salaaman|waan salaaman|subax wanaagsan|galab wanaagsan|habeen wanaagsan|menu|adeeg|adeegyada|start|bilow)[\s!.?]*$/i;

const ENGLISH_EXPLICIT =
  /\b(in english|english please|speak english|ingiriis|af ingiriis)\b/i;

/** Customer explicitly asked for English replies. */
export function requestsEnglish(text: string): boolean {
  return ENGLISH_EXPLICIT.test(text.trim());
}

/** True when message is only a greeting / menu request — menu alone is enough. */
export function isMenuOnlyTrigger(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (GREETING_ONLY.test(t)) return true;
  if (/^(menu|adeegyada|adeeg)$/i.test(t)) return true;
  return false;
}

/**
 * Parse menu selection 1-9 from customer message.
 * Accepts: "1", "2", "option 3", "dooro 4", emoji numbers, etc.
 */
export function parseMenuSelection(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const digitMatch = trimmed.match(/^(?:dooro\s*|option\s*|adeeg\s*)?([1-9])(?:[\.\)\s]|$)/i);
  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  if (/^[1-9]$/.test(trimmed)) {
    return Number(trimmed);
  }

  const emojiMap: Record<string, number> = {
    '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5,
    '6️⃣': 6, '7️⃣': 7, '8️⃣': 8, '9️⃣': 9,
  };
  for (const [emoji, num] of Object.entries(emojiMap)) {
    if (trimmed.includes(emoji)) return num;
  }

  for (const [option, patterns] of Object.entries(MENU_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed) && trimmed.length < 80) {
        return Number(option);
      }
    }
  }

  return null;
}

export function getMenuOptionContent(option: number): string | null {
  return MENU_OPTIONS[option]?.content ?? null;
}
