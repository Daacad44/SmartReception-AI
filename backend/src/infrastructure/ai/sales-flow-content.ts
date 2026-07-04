/** Somali sales consultant copy — SmartReception AI */

export const PORTFOLIO_URL = 'https://botandev.com';

export const PORTFOLIO_MESSAGE = `Waxaan haynaa portfolio hore.

Waxaad ka arki kartaa:
${PORTFOLIO_URL}

Fadlan fiiri shaqooyinkii hore si aad fikrad uga hesho.`;

export const APPOINTMENT_OFFER = `Ma rabtaa inaan kuu qabanno kulan bilaash ah?

1. Haa
2. Maya`;

export const WEBSITE_TYPE_MENU = `Waxaan kuu sameyn karnaa noocyo kala duwan oo websites ah.

Fadlan dooro nooca website-ka:

1. Business Website
2. Company Website
3. E-commerce Website
4. SaaS Platform
5. Portfolio Website
6. School System
7. Hospital System
8. Real Estate Website
9. Other`;

export const WEBSITE_TYPES: Record<number, string> = {
  1: 'Business Website',
  2: 'Company Website',
  3: 'E-commerce Website',
  4: 'SaaS Platform',
  5: 'Portfolio Website',
  6: 'School System',
  7: 'Hospital System',
  8: 'Real Estate Website',
  9: 'Other',
};

export const CUSTOM_SOFTWARE_TYPE_MENU = `Nidaam noocee ah ayaad rabtaa?

1. Hospital System
2. School System
3. Inventory System
4. POS System
5. CRM System
6. ERP System
7. Other`;

export const CUSTOM_SOFTWARE_TYPES: Record<number, string> = {
  1: 'Hospital System',
  2: 'School System',
  3: 'Inventory System',
  4: 'POS System',
  5: 'CRM System',
  6: 'ERP System',
  7: 'Other',
};

export const SERVICE_INTROS: Record<number, string> = {
  1: `AI Receptionist — Smart Sales Consultant

SmartReception AI Receptionist wuxuu ganacsigaaga u shaqayn karaa 24/7:
• Jawaab otomaatig ah macaamiisha
• Ururinta leads
• Ballamaha iyo taageerada
• Luqado badan

Waxaan rabnaa inaan fahamno baahidaada si aan kuu soo jeedino xal ku habboon.`,
  2: `WhatsApp Automation — Smart Sales Consultant

Waxaan kuu dhisi karnaa nidaam WhatsApp oo buuxa oo AI ah:
• Auto Reply & AI Chatbot
• Lead Generation
• Appointment Booking
• CRM Integration

Aan kuu waydiiyo su'aalo yar si aan u fahamno ganacsigaaga.`,
  3: `Appointment Systems — Smart Sales Consultant

Waxaan kuu samaynaynaa nidaamyada ballamaha:
• Booking Systems
• Xusuusin otomaatig ah
• Calendar Management
• WhatsApp Booking

Aan kuu waydiiyo su'aalo si aan u qorsheyno xalka kuu habboon.`,
  4: `CRM Solutions — Smart Sales Consultant

Waxaan kuu dhisi karnaa CRM xirfad leh:
• Customer Management
• Lead Tracking
• Sales Pipeline
• WhatsApp Integration

Aan kuu waydiiyo su'aalo muhiim ah oo ku saabsan ganacsigaaga.`,
  5: `Website Development — Smart Sales Consultant

Waxaan kuu dhisnaa website-yo xirfad leh oo ganacsigaaga kor u qaada.`,
  6: `Mobile App Development — Smart Sales Consultant

Waxaan kuu samaynaynaa apps Android, iOS, iyo Cross-Platform.

Aan kuu waydiiyo su'aalo muhiim ah oo ku saabsan app-ka aad rabto.`,
  7: `Custom Software Development — Smart Sales Consultant

Waxaan kuu samaynaynaa software gaar ah oo ganacsigaaga u habboon.`,
  8: `Qiimaha Adeegyada — Smart Sales Consultant

Qiimuhu wuxuu ku xiran yahay baaxadda mashruuca. Aan kuu waydiiyo xog si aan kuu siino qiime sax ah.`,
  9: `La Xiriir SmartReception

WhatsApp: +25268776299
Website: https://somreception.botandev.com
Email: info@botandev.com`,
};

/** Question definitions per service option */
export const SERVICE_QUESTIONS: Record<number, Array<{ key: string; text: string }>> = {
  1: [
    { key: 'fullName', text: 'Magacaaga?' },
    { key: 'businessName', text: 'Magaca ganacsigaaga?' },
    { key: 'businessType', text: 'Ganacsi noocee ah ayaad leedahay?' },
    { key: 'dailyCustomers', text: 'Immisa macaamiil maalintii ayaa kula soo xiriira?' },
    { key: 'needs', text: 'Maxaad rabtaa in AI Receptionist kuu qabto?' },
    { key: 'budget', text: 'Miisaaniyadaada qiyaas ahaan?' },
  ],
  2: [
    { key: 'businessType', text: 'Ganacsi noocee ah ayaad leedahay?' },
    { key: 'usesWhatsAppBusiness', text: 'WhatsApp Business ma isticmaashaa?' },
    { key: 'dailyMessages', text: 'Immisa fariimood maalintii ayaa kusoo gala?' },
    { key: 'wantsChatbot', text: 'Ma rabtaa AI chatbot?' },
    { key: 'wantsBooking', text: 'Ma rabtaa Appointment Booking?' },
    { key: 'wantsCrm', text: 'Ma rabtaa CRM Integration?' },
  ],
  3: [
    { key: 'businessName', text: 'Magaca ganacsigaaga?' },
    { key: 'businessType', text: 'Ganacsi noocee ah ayaad leedahay?' },
    { key: 'monthlyAppointments', text: 'Immisa ballan bishii ayaad qabataa?' },
    { key: 'channels', text: 'Macaamiishu sidee ballan uga qabsadaan hadda?' },
    { key: 'needsReminders', text: 'Ma rabtaa xusuusin otomaatig ah?' },
    { key: 'budget', text: 'Miisaaniyadaada qiyaas ahaan?' },
  ],
  4: [
    { key: 'businessType', text: 'Ganacsi noocee ah ayaad leedahay?' },
    { key: 'customerCount', text: 'Immisa macaamiil ayaad leedahay?' },
    { key: 'currentCrm', text: 'CRM hadda ma isticmaashaa?' },
    { key: 'crmGoals', text: 'Maxaad rabtaa in CRM-ku kuu qabto?' },
  ],
  5: [
    { key: 'fullName', text: 'Magacaaga?' },
    { key: 'businessName', text: 'Magaca ganacsiga ama brand-ka?' },
    { key: 'hasDomain', text: 'Domain ma leedahay?' },
    { key: 'language', text: 'Website-ka luqaddee ha ku shaqeeyo?' },
    { key: 'pageCount', text: 'Immisa pages ayaad rabtaa?' },
    { key: 'colors', text: 'Midabada aad jeceshahay?' },
    { key: 'exampleSite', text: 'Tusaale website aad ka heshay?' },
    { key: 'budget', text: 'Miisaaniyada mashruuca?' },
  ],
  6: [
    { key: 'platform', text: 'Android mise iOS?' },
    { key: 'bothPlatforms', text: 'Labadaba ma rabtaa?' },
    { key: 'appPurpose', text: 'App-ku maxuu qabanayaa?' },
    { key: 'hasDesign', text: 'Ma leedahay design?' },
    { key: 'budget', text: 'Miisaaniyadaada?' },
    { key: 'timeline', text: 'Waqtiga mashruuca?' },
  ],
  7: [
    { key: 'userCount', text: 'Immisa users ayaa isticmaali doona?' },
    { key: 'onlineOffline', text: 'Online mise Offline?' },
    { key: 'platform', text: 'Mobile mise Web?' },
    { key: 'budget', text: 'Miisaaniyadda mashruuca?' },
  ],
  8: [
    { key: 'fullName', text: 'Magacaaga?' },
    { key: 'businessName', text: 'Magaca Ganacsiga?' },
    { key: 'serviceNeeded', text: 'Adeegga aad rabto?' },
    { key: 'budget', text: 'Miisaaniyadaada qiyaas ahaan?' },
  ],
};

export const APPOINTMENT_QUESTIONS = [
  { key: 'apptName', text: 'Magacaaga?' },
  { key: 'apptPhone', text: 'Telefoonkaaga?' },
  { key: 'apptEmail', text: 'Email-kaaga?' },
  { key: 'apptDate', text: 'Taariikhda kulanka? (tusaale: 20/06/2026)' },
  { key: 'apptTime', text: 'Saacadda kulanka? (tusaale: 10:00)' },
];

export function buildAppointmentSummary(
  answers: Record<string, string>,
  serviceName: string
): string {
  return `Appointment Summary

Magac: ${answers.apptName || answers.fullName || '—'}
Telefoon: ${answers.apptPhone || '—'}
Email: ${answers.apptEmail || '—'}
Adeeg: ${serviceName}
Taariikh: ${answers.apptDate || '—'}
Saacad: ${answers.apptTime || '—'}

Appointment-kaaga waa la diiwaangeliyey.

Kooxda SmartReception ayaa kula soo xiriiri doonta dhawaan.

WhatsApp: +25268776299`;
}

export function buildLeadSummary(answers: Record<string, string>, serviceName: string): string {
  const lines = Object.entries(answers)
    .filter(([k]) => !k.startsWith('appt'))
    .map(([k, v]) => `${k}: ${v}`);
  return `Mahadsanid! Xogta mashruucaaga waa la kaydiyey.

Adeeg: ${serviceName}
${lines.join('\n')}

Kooxda SmartReception ayaa kula soo xiriiri doonta dhawaan.`;
}
