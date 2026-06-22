/** Default SmartReception AI company knowledge for AI receptionist and KB seeding. */

export const SMARTRECEPTION_WELCOME_MESSAGE = `Welcome to SmartReception AI.

Thank you for contacting us.

We provide AI-powered business automation solutions including:

• AI Customer Support
• WhatsApp Automation
• Appointment Booking Systems
• AI Receptionists
• CRM Solutions
• Knowledge Base Systems
• Business Process Automation
• AI Assistants
• Custom Software Development
• Web Development
• Mobile Applications

How can we assist you today?`;

export const SMARTRECEPTION_SYSTEM_PROMPT = `You are SmartReception AI — a professional virtual receptionist for SmartReception AI, an AI business automation company.

Company: SmartReception AI
Industry: AI Business Automation
Mission: Helping businesses automate customer communication using artificial intelligence.
Contact WhatsApp: +25268776299
Website: https://somreception.botandev.com

Services you represent:
- AI Receptionist: 24/7 automated customer support
- WhatsApp Automation: instant replies, lead capture, appointment booking, FAQ automation
- Appointment Management: booking, rescheduling, reminders, calendar integrations
- CRM Management: customer profiles, conversation history, lead tracking
- AI Knowledge Base: answers from company knowledge
- Website Development: professional business websites
- Custom Software Development: SaaS platforms and business systems
- Mobile Applications: Android and iOS development

Intent handling:
- Greetings → warm welcome, ask how you can help
- Pricing → explain we offer tailored plans; offer to connect with sales or book a demo
- Services → describe relevant services from the list above
- Appointments → collect preferred date/time; confirm booking intent
- Technical/support → use knowledge base; escalate if unsure
- General → be helpful, concise, professional

Rules:
- Keep WhatsApp messages concise (under 400 words unless listing services)
- Never invent pricing numbers; invite them to discuss requirements
- Always represent SmartReception AI professionally
- Respond in the customer's language when possible`;

export const SMARTRECEPTION_KB_FAQS: Array<{
  title: string;
  category: string;
  question: string;
  answer: string;
}> = [
  {
    title: 'What is SmartReception',
    category: 'General',
    question: 'What is SmartReception?',
    answer:
      'SmartReception is an AI-powered customer communication and automation platform that helps businesses manage WhatsApp, appointments, CRM, and customer support with artificial intelligence.',
  },
  {
    title: 'Appointments',
    category: 'Services',
    question: 'How do appointments work?',
    answer:
      'Customers can book appointments directly through WhatsApp. SmartReception captures date and time preferences, sends reminders, and syncs with your calendar.',
  },
  {
    title: 'Websites',
    category: 'Services',
    question: 'Do you provide websites?',
    answer: 'Yes. We build professional business websites tailored to your brand and goals.',
  },
  {
    title: 'Mobile Apps',
    category: 'Services',
    question: 'Do you build mobile apps?',
    answer: 'Yes. We develop Android and iOS applications for businesses.',
  },
  {
    title: 'WhatsApp Automation',
    category: 'Services',
    question: 'Can SmartReception automate WhatsApp?',
    answer:
      'Yes. SmartReception automates customer communication, lead generation, appointment scheduling, and support on WhatsApp.',
  },
  {
    title: 'AI Receptionist',
    category: 'Services',
    question: 'What is the AI Receptionist?',
    answer:
      'Our AI Receptionist provides 24/7 automated customer support — answering questions, capturing leads, and booking appointments without human intervention.',
  },
  {
    title: 'CRM',
    category: 'Services',
    question: 'Does SmartReception include CRM?',
    answer:
      'Yes. SmartReception includes CRM features: customer profiles, conversation history, lead scoring, and tags.',
  },
  {
    title: 'Pricing',
    category: 'Sales',
    question: 'How much does SmartReception cost?',
    answer:
      'We offer flexible plans based on your business size and message volume. Contact us to discuss your requirements and receive a tailored quote.',
  },
];
