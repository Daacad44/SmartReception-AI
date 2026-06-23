export interface BusinessTypeOption {
  id: string;
  label: string;
  icon: string;
  category: string;
  industry: string;
  keywords: string[];
}

type TypeDef = Omit<BusinessTypeOption, 'category' | 'keywords'> & { keywords?: string[] };

function type(
  id: string,
  label: string,
  icon: string,
  industry: string,
  keywords: string[] = []
): TypeDef {
  return { id, label, icon, industry, keywords };
}

const CATALOG: Record<string, TypeDef[]> = {
  Technology: [
    type('technology_company', 'Technology Company', '💻', 'SERVICE_BUSINESS', ['tech', 'technology', 'it']),
    type('software_company', 'Software Company', '💻', 'SERVICE_BUSINESS', ['software', 'dev', 'tech']),
    type('saas_company', 'SaaS Company', '☁️', 'SERVICE_BUSINESS', ['saas', 'software', 'tech', 'cloud']),
    type('ai_company', 'AI Company', '🤖', 'SERVICE_BUSINESS', ['ai', 'artificial intelligence', 'tech', 'machine learning']),
    type('ai_startup', 'AI Startup', '🚀', 'SERVICE_BUSINESS', ['ai', 'startup', 'tech']),
    type('it_services', 'IT Services', '🖥️', 'SERVICE_BUSINESS', ['it', 'tech', 'support', 'services']),
    type('web_development_agency', 'Web Development Agency', '🌐', 'SERVICE_BUSINESS', ['web', 'dev', 'agency', 'tech']),
    type('mobile_app_development', 'Mobile App Development', '📱', 'SERVICE_BUSINESS', ['mobile', 'app', 'tech']),
    type('cyber_security_company', 'Cyber Security Company', '🔒', 'SERVICE_BUSINESS', ['security', 'cyber', 'tech']),
    type('cloud_services_provider', 'Cloud Services Provider', '☁️', 'SERVICE_BUSINESS', ['cloud', 'tech', 'hosting']),
    type('data_analytics_company', 'Data Analytics Company', '📊', 'SERVICE_BUSINESS', ['data', 'analytics', 'tech']),
    type('digital_agency', 'Digital Agency', '🎨', 'SERVICE_BUSINESS', ['digital', 'agency', 'marketing', 'tech']),
    type('startup', 'Startup', '🚀', 'SERVICE_BUSINESS', ['startup', 'tech']),
    type('fintech_company', 'Fintech Company', '💳', 'SERVICE_BUSINESS', ['fintech', 'finance', 'tech']),
    type('edtech_company', 'EdTech Company', '📚', 'SERVICE_BUSINESS', ['edtech', 'education', 'tech']),
    type('healthtech_company', 'HealthTech Company', '🏥', 'SERVICE_BUSINESS', ['healthtech', 'health', 'tech']),
  ],
  'Food & Hospitality': [
    type('restaurant', 'Restaurant', '🍽️', 'RESTAURANT', ['food', 'dining', 'restaurant']),
    type('cafe', 'Cafe', '☕', 'RESTAURANT', ['cafe', 'coffee', 'food']),
    type('coffee_shop', 'Coffee Shop', '☕', 'RESTAURANT', ['coffee', 'cafe']),
    type('hotel', 'Hotel', '🏨', 'HOTEL', ['hotel', 'hospitality', 'lodging']),
    type('resort', 'Resort', '🏖️', 'HOTEL', ['resort', 'hotel', 'vacation']),
    type('guest_house', 'Guest House', '🏠', 'HOTEL', ['guest', 'lodging', 'bnb']),
    type('catering_service', 'Catering Service', '🍱', 'RESTAURANT', ['catering', 'food', 'events']),
    type('fast_food', 'Fast Food', '🍔', 'RESTAURANT', ['fast food', 'food']),
    type('bakery', 'Bakery', '🥐', 'RESTAURANT', ['bakery', 'food', 'pastry']),
    type('event_venue', 'Event Venue', '🎪', 'SERVICE_BUSINESS', ['event', 'venue', 'hospitality']),
  ],
  Healthcare: [
    type('hospital', 'Hospital', '🏥', 'HOSPITAL', ['hospital', 'health', 'medical']),
    type('clinic', 'Clinic', '🏥', 'CLINIC', ['clinic', 'health', 'medical']),
    type('pharmacy', 'Pharmacy', '💊', 'CLINIC', ['pharmacy', 'drug', 'health']),
    type('medical_laboratory', 'Medical Laboratory', '🔬', 'CLINIC', ['lab', 'medical', 'health']),
    type('dental_clinic', 'Dental Clinic', '🦷', 'CLINIC', ['dental', 'dentist', 'health']),
    type('diagnostic_center', 'Diagnostic Center', '🩺', 'CLINIC', ['diagnostic', 'health', 'medical']),
    type('healthcare_provider', 'Healthcare Provider', '⚕️', 'HOSPITAL', ['healthcare', 'health', 'medical']),
  ],
  Education: [
    type('school', 'School', '🏫', 'SCHOOL', ['school', 'education', 'k12']),
    type('university', 'University', '🎓', 'UNIVERSITY', ['university', 'college', 'education']),
    type('college', 'College', '🎓', 'UNIVERSITY', ['college', 'education']),
    type('training_center', 'Training Center', '📖', 'SCHOOL', ['training', 'education', 'courses']),
    type('online_academy', 'Online Academy', '💻', 'UNIVERSITY', ['online', 'academy', 'education', 'elearning']),
    type('coaching_institute', 'Coaching Institute', '📝', 'SCHOOL', ['coaching', 'tutoring', 'education']),
  ],
  'Real Estate & Construction': [
    type('real_estate_agency', 'Real Estate Agency', '🏢', 'REAL_ESTATE', ['real estate', 'property', 'agency']),
    type('property_management', 'Property Management', '🏘️', 'REAL_ESTATE', ['property', 'management', 'real estate']),
    type('construction_company', 'Construction Company', '🏗️', 'CONSTRUCTION', ['construction', 'building']),
    type('engineering_firm', 'Engineering Firm', '📐', 'CONSTRUCTION', ['engineering', 'construction']),
    type('architecture_firm', 'Architecture Firm', '📏', 'CONSTRUCTION', ['architecture', 'design']),
    type('interior_design_company', 'Interior Design Company', '🛋️', 'CONSTRUCTION', ['interior', 'design']),
  ],
  'Retail & E-Commerce': [
    type('retail_store', 'Retail Store', '🏪', 'RETAIL', ['retail', 'store', 'shop']),
    type('online_store', 'Online Store', '🛒', 'ECOMMERCE', ['online', 'ecommerce', 'store']),
    type('ecommerce_business', 'E-Commerce Business', '🛍️', 'ECOMMERCE', ['ecommerce', 'online', 'shop']),
    type('supermarket', 'Supermarket', '🛒', 'RETAIL', ['supermarket', 'grocery', 'retail']),
    type('wholesale_business', 'Wholesale Business', '📦', 'RETAIL', ['wholesale', 'distribution']),
    type('fashion_brand', 'Fashion Brand', '👗', 'RETAIL', ['fashion', 'clothing', 'brand']),
  ],
  'Logistics & Transportation': [
    type('logistics_company', 'Logistics Company', '🚚', 'LOGISTICS', ['logistics', 'supply chain', 'transport']),
    type('transport_company', 'Transport Company', '🚌', 'LOGISTICS', ['transport', 'logistics']),
    type('courier_service', 'Courier Service', '📦', 'LOGISTICS', ['courier', 'delivery', 'shipping']),
    type('delivery_service', 'Delivery Service', '🛵', 'LOGISTICS', ['delivery', 'courier']),
    type('shipping_company', 'Shipping Company', '🚢', 'LOGISTICS', ['shipping', 'freight', 'logistics']),
  ],
  'Professional Services': [
    type('law_firm', 'Law Firm', '⚖️', 'CONSULTING', ['law', 'legal', 'attorney']),
    type('accounting_firm', 'Accounting Firm', '🧮', 'CONSULTING', ['accounting', 'finance', 'tax']),
    type('consulting_company', 'Consulting Company', '💼', 'CONSULTING', ['consulting', 'advisory']),
    type('marketing_agency', 'Marketing Agency', '📣', 'CONSULTING', ['marketing', 'agency', 'advertising']),
    type('advertising_agency', 'Advertising Agency', '📺', 'CONSULTING', ['advertising', 'marketing', 'agency']),
    type('recruitment_agency', 'Recruitment Agency', '👔', 'CONSULTING', ['recruitment', 'hiring', 'hr']),
  ],
  'Financial Services': [
    type('bank', 'Bank', '🏦', 'SERVICE_BUSINESS', ['bank', 'finance', 'financial']),
    type('microfinance', 'Microfinance', '💰', 'SERVICE_BUSINESS', ['microfinance', 'finance', 'loans']),
    type('insurance_company', 'Insurance Company', '🛡️', 'SERVICE_BUSINESS', ['insurance', 'finance']),
    type('investment_firm', 'Investment Firm', '📈', 'SERVICE_BUSINESS', ['investment', 'finance', 'trading']),
    type('forex_business', 'Forex Business', '💱', 'SERVICE_BUSINESS', ['forex', 'trading', 'finance']),
  ],
  'Tourism & Travel': [
    type('travel_agency', 'Travel Agency', '✈️', 'TRAVEL_AGENCY', ['travel', 'tourism', 'agency']),
    type('tour_operator', 'Tour Operator', '🗺️', 'TRAVEL_AGENCY', ['tour', 'travel', 'tourism']),
    type('visa_service', 'Visa Service', '🛂', 'TRAVEL_AGENCY', ['visa', 'travel', 'immigration']),
    type('car_rental_company', 'Car Rental Company', '🚗', 'TRAVEL_AGENCY', ['car rental', 'travel', 'transport']),
  ],
  'Media & Entertainment': [
    type('media_company', 'Media Company', '📰', 'SERVICE_BUSINESS', ['media', 'news', 'entertainment']),
    type('radio_station', 'Radio Station', '📻', 'SERVICE_BUSINESS', ['radio', 'media', 'broadcast']),
    type('tv_station', 'TV Station', '📺', 'SERVICE_BUSINESS', ['tv', 'television', 'media']),
    type('podcast_business', 'Podcast Business', '🎙️', 'SERVICE_BUSINESS', ['podcast', 'media', 'content']),
    type('production_company', 'Production Company', '🎬', 'SERVICE_BUSINESS', ['production', 'film', 'media']),
    type('content_creator', 'Content Creator', '📸', 'SERVICE_BUSINESS', ['content', 'creator', 'influencer']),
  ],
  'NGO & Government': [
    type('ngo', 'NGO', '🤝', 'NGO', ['ngo', 'nonprofit', 'charity']),
    type('charity_organization', 'Charity Organization', '❤️', 'NGO', ['charity', 'nonprofit', 'ngo']),
    type('government_agency', 'Government Agency', '🏛️', 'GOVERNMENT', ['government', 'public', 'agency']),
    type('non_profit_organization', 'Non-Profit Organization', '💚', 'NGO', ['nonprofit', 'ngo', 'charity']),
  ],
  Agriculture: [
    type('farm', 'Farm', '🌾', 'SERVICE_BUSINESS', ['farm', 'agriculture', 'farming']),
    type('agricultural_company', 'Agricultural Company', '🚜', 'SERVICE_BUSINESS', ['agriculture', 'farming', 'agri']),
    type('livestock_business', 'Livestock Business', '🐄', 'SERVICE_BUSINESS', ['livestock', 'agriculture', 'farming']),
    type('fisheries_business', 'Fisheries Business', '🐟', 'SERVICE_BUSINESS', ['fisheries', 'fishing', 'agriculture']),
  ],
  Manufacturing: [
    type('factory', 'Factory', '🏭', 'SERVICE_BUSINESS', ['factory', 'manufacturing', 'industrial']),
    type('manufacturing_company', 'Manufacturing Company', '⚙️', 'SERVICE_BUSINESS', ['manufacturing', 'industrial', 'factory']),
    type('industrial_business', 'Industrial Business', '🏗️', 'SERVICE_BUSINESS', ['industrial', 'manufacturing']),
  ],
  Other: [
    type('freelancer', 'Freelancer', '👤', 'SERVICE_BUSINESS', ['freelancer', 'solo', 'independent']),
    type('personal_brand', 'Personal Brand', '⭐', 'SERVICE_BUSINESS', ['personal', 'brand', 'influencer']),
    type('community_organization', 'Community Organization', '👥', 'NGO', ['community', 'organization']),
    type('religious_organization', 'Religious Organization', '🕌', 'NGO', ['religious', 'church', 'mosque', 'faith']),
    type('salon', 'Salon', '💇', 'SALON', ['salon', 'beauty', 'hair']),
    type('other', 'Other', '📋', 'OTHER', ['other', 'misc', 'general']),
  ],
};

export const BUSINESS_TYPE_CATEGORIES = Object.entries(CATALOG).map(([category, types]) => ({
  category,
  types: types.map((t) => ({
    ...t,
    category,
    keywords: [
      ...(t.keywords ?? []),
      t.label.toLowerCase(),
      category.toLowerCase(),
      ...t.label.toLowerCase().split(/\s+/),
    ],
  })),
}));

export const ALL_BUSINESS_TYPES: BusinessTypeOption[] = BUSINESS_TYPE_CATEGORIES.flatMap((c) => c.types);

export function findBusinessType(id: string): BusinessTypeOption | undefined {
  return ALL_BUSINESS_TYPES.find((t) => t.id === id);
}

export function searchBusinessTypes(query: string): BusinessTypeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_BUSINESS_TYPES;
  return ALL_BUSINESS_TYPES.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q) || q.includes(k))
  );
}
