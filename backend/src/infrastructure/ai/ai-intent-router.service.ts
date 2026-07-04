/** AI resource routing: Business Profile vs Knowledge Base. */

export type AiResourceRoute = 'business_profile' | 'knowledge_base';

export type RouteContext = {
  isFirstCustomerMessage: boolean;
  inboundMessageCount?: number;
};

const COMPANY_IDENTITY_PATTERNS: RegExp[] = [
  /\b(who are you|who is|what are you|about (your |the )?company|about us|tell me about|company info|company information|business summary|company summary)\b/i,
  /\b(what does .+ do|what do you do|what services do you provide|your services)\b/i,
  /\b(mission|vision|core values|why choose us|founder|brand)\b/i,
  /\b(website|web ?site|email|e-?mail|contact|phone|whatsapp|address|location|working hours|business hours|office hours|google maps|map)\b/i,
  /\b(yaa ahaydeen|shirkadda|waxaad tihiin|noo sheeg|nagala soo xiriir|cinwaanka|website-?ka|email-?ka|telefoonka|saacadaha)\b/i,
  /\b(ku saabsan|waxaad samaysaan|adeegyada aad bixisaan|halkaad joogtaan)\b/i,
];

/** Company questions that must NEVER hit the Knowledge Base. */
export function isCompanyIdentityQuery(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  return COMPANY_IDENTITY_PATTERNS.some((p) => p.test(t));
}

/**
 * Route incoming message to Business Profile or Knowledge Base.
 * Profile: first message OR explicit company-identity questions.
 */
export function classifyAiResourceRoute(
  customerMessage: string,
  context: RouteContext
): AiResourceRoute {
  if (context.isFirstCustomerMessage) {
    return 'business_profile';
  }
  if (isCompanyIdentityQuery(customerMessage)) {
    return 'business_profile';
  }
  return 'knowledge_base';
}
