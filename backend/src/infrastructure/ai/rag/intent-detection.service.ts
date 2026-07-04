import type { CustomerIntent } from './types';
import {
  classifyAiResourceRoute,
  type AiResourceRoute,
  type RouteContext,
} from '../ai-intent-router.service';

const INTENT_PATTERNS: Array<{ intent: CustomerIntent; patterns: RegExp[] }> = [
  {
    intent: 'pricing',
    patterns: [/\b(price|pricing|cost|fee|qiimo|lacag|how much)\b/i, /\b(qiimaha|lacagta)\b/i],
  },
  {
    intent: 'booking',
    patterns: [/\b(book|appointment|schedule|ballan|waqti)\b/i],
  },
  {
    intent: 'services',
    patterns: [/\b(service|adeeg|what do you offer)\b/i],
  },
  {
    intent: 'products',
    patterns: [/\b(product|alab|catalog)\b/i],
  },
  {
    intent: 'support',
    patterns: [/\b(help|support|problem|issue|caawin)\b/i],
  },
  {
    intent: 'contact',
    patterns: [/\b(contact|phone|email|whatsapp|address|xiriir)\b/i],
  },
  {
    intent: 'menu',
    patterns: [/\b(menu|option|doorasho)\b/i],
  },
  {
    intent: 'policy',
    patterns: [/\b(policy|refund|terms|shuruud)\b/i],
  },
  {
    intent: 'lead',
    patterns: [/\b(interested|demo|trial|sign up|register)\b/i],
  },
];

export interface IntentDetectionResult {
  intent: CustomerIntent;
  route: AiResourceRoute;
  categoryHints: string[];
  confidence: number;
}

export function detectCustomerIntent(
  message: string,
  context: RouteContext
): IntentDetectionResult {
  const route = classifyAiResourceRoute(message, context);
  const trimmed = message.trim();

  if (route === 'business_profile') {
    const isContact = /\b(contact|phone|email|whatsapp|address|xiriir)\b/i.test(trimmed);
    return {
      intent: isContact ? 'contact' : 'company_intro',
      route,
      categoryHints: ['profile', 'company'],
      confidence: 0.9,
    };
  }

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(trimmed))) {
      return {
        intent,
        route: 'knowledge_base',
        categoryHints: categoryHintsForIntent(intent),
        confidence: 0.85,
      };
    }
  }

  return {
    intent: 'general',
    route: 'knowledge_base',
    categoryHints: [],
    confidence: 0.6,
  };
}

function categoryHintsForIntent(intent: CustomerIntent): string[] {
  switch (intent) {
    case 'pricing':
      return ['pricing', 'FAQ', 'PDF'];
    case 'services':
      return ['service', 'services'];
    case 'products':
      return ['product', 'products'];
    case 'booking':
      return ['appointment', 'booking'];
    case 'policy':
      return ['policy', 'terms'];
    default:
      return [];
  }
}
