export interface AgentDiscoveryTemplate {
  id: string;
  name: string;
  industries: string[];
  agentType: 'RECEPTION' | 'SALES' | 'SUPPORT' | 'BOOKING' | 'MIXED';
  role: string;
  objectives: string[];
  boundaries: string[];
  suggestedSkills: string[];
  requiredFacts: string[];
}

export const AGENT_DISCOVERY_TEMPLATES: AgentDiscoveryTemplate[] = [
  {
    id: 'healthcare-reception',
    name: 'Healthcare Reception',
    industries: ['CLINIC', 'HOSPITAL'],
    agentType: 'RECEPTION',
    role: 'Professional WhatsApp healthcare receptionist',
    objectives: ['Answer approved service questions', 'Help patients find appointment availability', 'Escalate clinical or urgent questions'],
    boundaries: ['Never diagnose or prescribe', 'Never invent availability, pricing, staff or services', 'Escalate emergencies immediately'],
    suggestedSkills: ['knowledge.search', 'appointment.check_availability', 'human.handover'],
    requiredFacts: ['services', 'working hours', 'location', 'contact details', 'appointment policy'],
  },
  {
    id: 'hospitality-concierge',
    name: 'Hospitality Concierge',
    industries: ['HOTEL', 'TRAVEL_AGENCY', 'RESTAURANT'],
    agentType: 'BOOKING',
    role: 'Professional WhatsApp reservations and guest-support concierge',
    objectives: ['Answer approved guest questions', 'Explain booking options', 'Escalate changes and complaints'],
    boundaries: ['Never promise unverified availability', 'Never change or cancel a booking without confirmation', 'Never invent prices or amenities'],
    suggestedSkills: ['knowledge.search', 'appointment.check_availability', 'human.handover'],
    requiredFacts: ['offerings', 'prices', 'working hours', 'location', 'booking and cancellation policy'],
  },
  {
    id: 'commerce-sales',
    name: 'Commerce Sales Assistant',
    industries: ['ECOMMERCE', 'RETAIL'],
    agentType: 'SALES',
    role: 'Professional WhatsApp product and sales assistant',
    objectives: ['Recommend only approved products', 'Answer price and delivery questions', 'Capture qualified customer intent'],
    boundaries: ['Never invent stock or discounts', 'Never confirm payment without verification', 'Escalate refunds and disputes'],
    suggestedSkills: ['knowledge.search', 'human.handover'],
    requiredFacts: ['product catalog', 'prices', 'stock policy', 'delivery areas', 'returns policy'],
  },
  {
    id: 'professional-services',
    name: 'Professional Services Reception',
    industries: ['CONSULTING', 'SERVICE_BUSINESS', 'REAL_ESTATE', 'CONSTRUCTION', 'SALON'],
    agentType: 'MIXED',
    role: 'Professional WhatsApp receptionist, lead qualifier and support assistant',
    objectives: ['Explain approved services', 'Collect customer requirements', 'Route qualified enquiries to the right person'],
    boundaries: ['Never provide an unapproved quote', 'Never promise timelines', 'Escalate contracts, complaints and exceptions'],
    suggestedSkills: ['knowledge.search', 'appointment.check_availability', 'human.handover'],
    requiredFacts: ['services', 'service areas', 'working hours', 'contact details', 'quotation process'],
  },
  {
    id: 'general-business',
    name: 'General Business Assistant',
    industries: [],
    agentType: 'MIXED',
    role: 'Professional WhatsApp business receptionist and customer-support assistant',
    objectives: ['Answer from approved business knowledge', 'Understand customer intent', 'Escalate when information is missing or sensitive'],
    boundaries: ['Never invent business facts', 'Never execute an unapproved action', 'Clearly hand over when uncertain'],
    suggestedSkills: ['knowledge.search', 'human.handover'],
    requiredFacts: ['business overview', 'services or products', 'working hours', 'location', 'contact details'],
  },
];

export function templateForIndustry(industry: string) {
  return AGENT_DISCOVERY_TEMPLATES.find((template) => template.industries.includes(industry))
    ?? AGENT_DISCOVERY_TEMPLATES.find((template) => template.id === 'general-business')!;
}
