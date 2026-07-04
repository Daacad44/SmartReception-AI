export interface BusinessTypeOption {
  id: string;
  label: string;
  icon: string;
  category: string;
  industry: string;
  keywords: string[];
  description: string;
}

type TypeDef = Omit<BusinessTypeOption, 'category' | 'keywords' | 'description'> & {
  keywords?: string[];
  description?: string;
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Technology: 'Software, AI, SaaS, IT Services',
  'Food & Hospitality': 'Food, Dining, Hospitality',
  Healthcare: 'Healthcare, Clinics, Medical Services',
  Education: 'Education, Learning, Training',
  'Real Estate & Construction': 'Property, Building & Design',
  'Retail & E-Commerce': 'Retail, Online Stores & Commerce',
  'Logistics & Transportation': 'Shipping, Delivery & Transport',
  'Professional Services': 'Legal, Finance & Consulting',
  'Financial Services': 'Banking, Insurance & Investments',
  'Tourism & Travel': 'Travel, Tours & Tourism',
  'Media & Entertainment': 'Media, Content & Production',
  'NGO & Government': 'Nonprofits, NGOs & Public Sector',
  Agriculture: 'Farming, Livestock & Fisheries',
  Manufacturing: 'Factories & Industrial Production',
  Telecommunications: 'Telecom, Internet & Mobile Services',
  'Energy & Utilities': 'Power, Solar & Utility Services',
  'Mining & Resources': 'Mining, Oil & Gas & Extraction',
  Automotive: 'Cars, Auto Repair & Dealerships',
  'Beauty & Wellness': 'Salon, Spa, Fitness & Wellness',
  'Sports & Recreation': 'Sports Clubs, Gyms & Recreation',
  'Home Services': 'Cleaning, Plumbing & Maintenance',
  'Retail & Shopping': 'Shops, Stores & Specialty Retail',
  Other: 'Freelance, Community & More',
};

export const CATEGORY_THEMES: Record<string, { section: string; header: string }> = {
  Technology: { section: '#F8FAFC', header: '#F1F5F9' },
  'Food & Hospitality': { section: '#FFFBEB', header: '#FEF3C7' },
  Healthcare: { section: '#F0FDF4', header: '#DCFCE7' },
  Education: { section: '#EFF6FF', header: '#DBEAFE' },
  'Real Estate & Construction': { section: '#F8FAFC', header: '#F1F5F9' },
  'Retail & E-Commerce': { section: '#FDF4FF', header: '#FAE8FF' },
  'Logistics & Transportation': { section: '#F8FAFC', header: '#F1F5F9' },
  'Professional Services': { section: '#F8FAFC', header: '#F1F5F9' },
  'Financial Services': { section: '#FFFBEB', header: '#FEF3C7' },
  'Tourism & Travel': { section: '#EFF6FF', header: '#DBEAFE' },
  'Media & Entertainment': { section: '#FDF4FF', header: '#FAE8FF' },
  'NGO & Government': { section: '#F0FDF4', header: '#DCFCE7' },
  Agriculture: { section: '#F0FDF4', header: '#DCFCE7' },
  Manufacturing: { section: '#F8FAFC', header: '#F1F5F9' },
  Telecommunications: { section: '#EFF6FF', header: '#DBEAFE' },
  'Energy & Utilities': { section: '#FFFBEB', header: '#FEF3C7' },
  'Mining & Resources': { section: '#F8FAFC', header: '#F1F5F9' },
  Automotive: { section: '#F8FAFC', header: '#F1F5F9' },
  'Beauty & Wellness': { section: '#FDF4FF', header: '#FAE8FF' },
  'Sports & Recreation': { section: '#F0FDF4', header: '#DCFCE7' },
  'Home Services': { section: '#F8FAFC', header: '#F1F5F9' },
  'Retail & Shopping': { section: '#FDF4FF', header: '#FAE8FF' },
  Other: { section: '#F8FAFC', header: '#F1F5F9' },
};

export const POPULAR_BUSINESS_TYPE_IDS = [
  'technology_company',
  'restaurant',
  'hospital',
  'school',
  'ecommerce_business',
] as const;

export const RECENT_BUSINESS_TYPES_KEY = 'sr_recent_business_types';

function type(
  id: string,
  label: string,
  icon: string,
  industry: string,
  keywords: string[] = [],
  description?: string
): TypeDef {
  return { id, label, icon, industry, keywords, description };
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
    type('grocery_store', 'Grocery Store', '🥬', 'RETAIL', ['grocery', 'supermarket', 'food']),
    type('convenience_store', 'Convenience Store', '🏪', 'RETAIL', ['convenience', 'store', 'retail']),
    type('wholesale_business', 'Wholesale Business', '📦', 'RETAIL', ['wholesale', 'distribution']),
    type('fashion_brand', 'Fashion Brand', '👗', 'RETAIL', ['fashion', 'clothing', 'brand']),
    type('online_marketplace', 'Online Marketplace', '🛍️', 'ECOMMERCE', ['marketplace', 'ecommerce', 'online']),
    type('bar', 'Bar', '🍺', 'RESTAURANT', ['bar', 'nightlife', 'drinks']),
    type('nightclub', 'Nightclub', '🎵', 'RESTAURANT', ['nightclub', 'club', 'entertainment']),
    type('food_truck', 'Food Truck', '🚚', 'RESTAURANT', ['food truck', 'street food', 'restaurant']),
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
    type('textile_manufacturer', 'Textile Manufacturer', '🧵', 'SERVICE_BUSINESS', ['textile', 'manufacturing', 'fabric']),
    type('food_processing', 'Food Processing Company', '🥫', 'SERVICE_BUSINESS', ['food processing', 'manufacturing']),
  ],
  Telecommunications: [
    type('telecom_company', 'Telecommunications Company', '📡', 'SERVICE_BUSINESS', ['telecom', 'telecommunications', 'mobile']),
    type('internet_service_provider', 'Internet Service Provider', '🌐', 'SERVICE_BUSINESS', ['isp', 'internet', 'broadband']),
    type('mobile_operator', 'Mobile Network Operator', '📱', 'SERVICE_BUSINESS', ['mobile', 'cellular', 'telecom']),
    type('call_center', 'Call Center', '☎️', 'SERVICE_BUSINESS', ['call center', 'bpo', 'support']),
  ],
  'Energy & Utilities': [
    type('solar_company', 'Solar Energy Company', '☀️', 'SERVICE_BUSINESS', ['solar', 'energy', 'renewable']),
    type('power_utility', 'Power Utility', '⚡', 'SERVICE_BUSINESS', ['power', 'electricity', 'utility']),
    type('oil_gas_company', 'Oil & Gas Company', '🛢️', 'SERVICE_BUSINESS', ['oil', 'gas', 'energy']),
    type('water_utility', 'Water Utility', '💧', 'SERVICE_BUSINESS', ['water', 'utility', 'services']),
  ],
  'Mining & Resources': [
    type('mining_company', 'Mining Company', '⛏️', 'SERVICE_BUSINESS', ['mining', 'minerals', 'resources']),
    type('quarry_business', 'Quarry Business', '🪨', 'SERVICE_BUSINESS', ['quarry', 'stone', 'mining']),
  ],
  Automotive: [
    type('car_dealership', 'Car Dealership', '🚗', 'SERVICE_BUSINESS', ['car', 'dealership', 'automotive']),
    type('auto_repair_shop', 'Auto Repair Shop', '🔧', 'SERVICE_BUSINESS', ['auto repair', 'mechanic', 'garage']),
    type('car_rental', 'Car Rental', '🚙', 'TRAVEL_AGENCY', ['car rental', 'transport', 'automotive']),
    type('auto_parts_store', 'Auto Parts Store', '⚙️', 'RETAIL', ['auto parts', 'automotive', 'retail']),
    type('car_wash', 'Car Wash', '🧽', 'SERVICE_BUSINESS', ['car wash', 'automotive', 'cleaning']),
  ],
  'Beauty & Wellness': [
    type('beauty_salon', 'Beauty Salon', '💇', 'SALON', ['beauty', 'salon', 'hair']),
    type('barber_shop', 'Barber Shop', '💈', 'SALON', ['barber', 'hair', 'grooming']),
    type('spa', 'Spa & Wellness', '🧖', 'SALON', ['spa', 'wellness', 'massage']),
    type('nail_salon', 'Nail Salon', '💅', 'SALON', ['nail', 'salon', 'beauty']),
    type('gym', 'Gym & Fitness Center', '🏋️', 'SERVICE_BUSINESS', ['gym', 'fitness', 'workout']),
    type('yoga_studio', 'Yoga Studio', '🧘', 'SERVICE_BUSINESS', ['yoga', 'fitness', 'wellness']),
  ],
  'Sports & Recreation': [
    type('sports_club', 'Sports Club', '⚽', 'SERVICE_BUSINESS', ['sports', 'club', 'recreation']),
    type('fitness_studio', 'Fitness Studio', '🤸', 'SERVICE_BUSINESS', ['fitness', 'studio', 'training']),
    type('stadium_venue', 'Stadium & Arena', '🏟️', 'SERVICE_BUSINESS', ['stadium', 'sports', 'venue']),
    type('swimming_pool', 'Swimming Pool', '🏊', 'SERVICE_BUSINESS', ['swimming', 'pool', 'sports']),
  ],
  'Home Services': [
    type('cleaning_service', 'Cleaning Service', '🧹', 'SERVICE_BUSINESS', ['cleaning', 'home', 'services']),
    type('plumbing_service', 'Plumbing Service', '🔧', 'SERVICE_BUSINESS', ['plumbing', 'home', 'repair']),
    type('electrical_service', 'Electrical Service', '💡', 'SERVICE_BUSINESS', ['electrical', 'electrician', 'home']),
    type('hvac_service', 'HVAC Service', '❄️', 'SERVICE_BUSINESS', ['hvac', 'air conditioning', 'heating']),
    type('landscaping_service', 'Landscaping Service', '🌿', 'SERVICE_BUSINESS', ['landscaping', 'garden', 'lawn']),
    type('pest_control', 'Pest Control', '🐜', 'SERVICE_BUSINESS', ['pest control', 'home', 'services']),
    type('security_service', 'Security Service', '🛡️', 'SERVICE_BUSINESS', ['security', 'guards', 'protection']),
  ],
  'Retail & Shopping': [
    type('electronics_store', 'Electronics Store', '📺', 'RETAIL', ['electronics', 'store', 'retail']),
    type('furniture_store', 'Furniture Store', '🛋️', 'RETAIL', ['furniture', 'home', 'retail']),
    type('jewelry_store', 'Jewelry Store', '💎', 'RETAIL', ['jewelry', 'store', 'retail']),
    type('bookstore', 'Bookstore', '📚', 'RETAIL', ['bookstore', 'books', 'retail']),
    type('liquor_store', 'Liquor Store', '🍷', 'RETAIL', ['liquor', 'alcohol', 'retail']),
    type('pharmacy_retail', 'Pharmacy Retail', '💊', 'RETAIL', ['pharmacy', 'drugstore', 'retail']),
    type('pet_store', 'Pet Store', '🐾', 'RETAIL', ['pet', 'store', 'animals']),
    type('florist', 'Florist', '💐', 'RETAIL', ['florist', 'flowers', 'retail']),
    type('hardware_store', 'Hardware Store', '🔨', 'RETAIL', ['hardware', 'tools', 'retail']),
    type('toy_store', 'Toy Store', '🧸', 'RETAIL', ['toys', 'store', 'retail']),
  ],
  Other: [
    type('freelancer', 'Freelancer', '👤', 'SERVICE_BUSINESS', ['freelancer', 'solo', 'independent']),
    type('personal_brand', 'Personal Brand', '⭐', 'SERVICE_BUSINESS', ['personal', 'brand', 'influencer']),
    type('community_organization', 'Community Organization', '👥', 'NGO', ['community', 'organization']),
    type('religious_organization', 'Religious Organization', '🕌', 'NGO', ['religious', 'church', 'mosque', 'faith']),
    type('salon', 'Salon', '💇', 'SALON', ['salon', 'beauty', 'hair']),
    type('veterinary_clinic', 'Veterinary Clinic', '🐕', 'CLINIC', ['veterinary', 'vet', 'animals']),
    type('coworking_space', 'Coworking Space', '🏢', 'SERVICE_BUSINESS', ['coworking', 'office', 'workspace']),
    type('printing_shop', 'Printing Shop', '🖨️', 'SERVICE_BUSINESS', ['printing', 'copy', 'design']),
    type('photography_studio', 'Photography Studio', '📷', 'SERVICE_BUSINESS', ['photography', 'photo', 'studio']),
    type('event_planning', 'Event Planning', '🎉', 'SERVICE_BUSINESS', ['event', 'planning', 'wedding']),
    type('import_export', 'Import & Export', '🌍', 'LOGISTICS', ['import', 'export', 'trade']),
    type('laundry_service', 'Laundry Service', '👕', 'SERVICE_BUSINESS', ['laundry', 'dry cleaning', 'cleaning']),
    type('daycare', 'Daycare Center', '👶', 'SCHOOL', ['daycare', 'childcare', 'education']),
    type('other', 'Other', '📋', 'OTHER', ['other', 'misc', 'general']),
  ],
};

export const BUSINESS_TYPE_CATEGORIES = Object.entries(CATALOG).map(([category, types]) => ({
  category,
  types: types.map((t) => ({
    ...t,
    category,
    description: t.description ?? CATEGORY_DESCRIPTIONS[category] ?? category,
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
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q) || q.includes(k))
  );
}

export function getPopularBusinessTypes(): BusinessTypeOption[] {
  return POPULAR_BUSINESS_TYPE_IDS.map((id) => findBusinessType(id)).filter(
    (t): t is BusinessTypeOption => Boolean(t)
  );
}

export function getRecentBusinessTypeIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_BUSINESS_TYPES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function getRecentBusinessTypes(): BusinessTypeOption[] {
  return getRecentBusinessTypeIds()
    .map((id) => findBusinessType(id))
    .filter((t): t is BusinessTypeOption => Boolean(t));
}

export function addRecentBusinessType(id: string): void {
  if (typeof window === 'undefined') return;
  const next = [id, ...getRecentBusinessTypeIds().filter((item) => item !== id)].slice(0, 5);
  localStorage.setItem(RECENT_BUSINESS_TYPES_KEY, JSON.stringify(next));
}
